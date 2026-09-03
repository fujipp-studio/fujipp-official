package com.fujipp.backend.donation;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Repository
class DonationRepository {
    private final JdbcTemplate jdbc;

    DonationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Campaign campaign() {
        return jdbc.query("""
                SELECT settings.title,
                       settings.description,
                       settings.goal_satang,
                       settings.updated_at,
                       COALESCE(stats.raised_satang, 0) AS raised_satang,
                       COALESCE(stats.supporter_count, 0) AS supporter_count
                  FROM support.donation_settings AS settings
                  LEFT JOIN LATERAL (
                        SELECT sum(donation.amount_satang) AS raised_satang,
                               count(DISTINCT donation.user_id) AS supporter_count
                          FROM support.donations AS donation
                         WHERE donation.status = 'SUCCESS'
                  ) AS stats ON true
                 WHERE settings.id = 1
                """, (rs, row) -> new Campaign(
                rs.getString("title"),
                rs.getString("description"),
                rs.getLong("goal_satang"),
                rs.getLong("raised_satang"),
                rs.getLong("supporter_count"),
                rs.getObject("updated_at", OffsetDateTime.class)
        )).stream().findFirst().orElseThrow(() -> new DonationException(
                "DONATION_SETTINGS_NOT_FOUND",
                "Donation settings were not found",
                DonationException.Kind.CONFIGURATION
        ));
    }

    List<LeaderboardEntry> leaderboard(int limit) {
        return jdbc.query("""
                WITH eligible AS (
                    SELECT CASE
                               WHEN NOT donation.anonymous
                                   THEN 'user:' || donation.user_id::text
                               ELSE 'donation:' || donation.id::text
                           END AS supporter_key,
                           CASE WHEN donation.anonymous THEN 'Anonymous' ELSE donation.donor_name END AS display_name,
                           donation.amount_satang,
                           donation.succeeded_at
                      FROM support.donations AS donation
                     WHERE donation.status = 'SUCCESS'
                )
                SELECT (array_agg(display_name ORDER BY succeeded_at DESC))[1] AS display_name,
                       sum(amount_satang) AS total_satang,
                       count(*) AS donation_count,
                       max(succeeded_at) AS last_donated_at
                  FROM eligible
                 GROUP BY supporter_key
                 ORDER BY total_satang DESC, last_donated_at ASC, supporter_key ASC
                 LIMIT ?
                """, (rs, row) -> new LeaderboardEntry(
                rs.getString("display_name"),
                rs.getLong("total_satang"),
                rs.getLong("donation_count"),
                rs.getObject("last_donated_at", OffsetDateTime.class)
        ), limit);
    }

    @Transactional
    Donation create(
            UUID userId,
            String donorName,
            String message,
            boolean anonymous,
            long amountSatang,
            DonationRequests.FundingMethod fundingMethod,
            String idempotencyKey
    ) {
        jdbc.query(
                "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                resultSet -> null,
                idempotencyKey
        );

        Optional<Donation> existing = byIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return validateRetry(
                    existing.get(), userId, donorName, message, anonymous, amountSatang, fundingMethod
            );
        }

        Wallet wallet = wallet(userId, true).orElseThrow(() -> new DonationException(
                "WALLET_NOT_FOUND",
                "Active THB wallet was not found",
                DonationException.Kind.NOT_FOUND
        ));
        if (fundingMethod == DonationRequests.FundingMethod.WALLET
                && wallet.balanceSatang() < amountSatang) {
            throw new DonationException(
                    "INSUFFICIENT_WALLET_BALANCE",
                    "Wallet balance is not enough for this donation",
                    DonationException.Kind.CONFLICT
            );
        }

        UUID id = UUID.randomUUID();
        String number = "DON_" + id.toString().replace("-", "").toUpperCase();
        try {
            jdbc.update("""
                    INSERT INTO support.donations (
                        id, donation_number, user_id, donor_name, message, anonymous,
                        amount_satang, funding_method, idempotency_key
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?::support.donation_funding_method, ?)
                    """, id, number, userId, donorName, message, anonymous, amountSatang,
                    fundingMethod.name(), idempotencyKey);

            if (fundingMethod == DonationRequests.FundingMethod.WALLET) {
                jdbc.queryForObject(
                        "SELECT id FROM support.complete_wallet_donation(?, ?)",
                        UUID.class,
                        id,
                        userId
                );
            }
        } catch (DataIntegrityViolationException exception) {
            throw new DonationException(
                    "DONATION_CONFLICT",
                    "Could not create the donation",
                    DonationException.Kind.CONFLICT
            );
        }
        return owned(id, userId).orElseThrow();
    }

    Optional<Donation> owned(UUID donationId, UUID userId) {
        return jdbc.query(
                DONATION_SELECT + " WHERE donation.id = ? AND donation.user_id = ?",
                this::mapDonation,
                donationId,
                userId
        ).stream().findFirst();
    }

    Campaign updateSettings(String title, String description, long goalSatang, UUID updatedBy) {
        int updated = jdbc.update("""
                UPDATE support.donation_settings
                   SET title = ?, description = ?, goal_satang = ?, updated_by = ?
                 WHERE id = 1
                """, title, description, goalSatang, updatedBy);
        if (updated != 1) throw new DonationException(
                "DONATION_SETTINGS_NOT_FOUND",
                "Donation settings were not found",
                DonationException.Kind.CONFIGURATION
        );
        return campaign();
    }

    private Optional<Wallet> wallet(UUID userId, boolean lock) {
        String suffix = lock ? " FOR UPDATE OF wallet" : "";
        return jdbc.query("""
                SELECT wallet.id, wallet.balance_satang
                  FROM billing.customers AS customer
                  JOIN billing.wallets AS wallet
                    ON wallet.customer_id = customer.id
                   AND wallet.currency = 'THB'
                 WHERE customer.user_id = ?
                   AND customer.status = 'ACTIVE'
                   AND wallet.status = 'ACTIVE'
                """ + suffix, (rs, row) -> new Wallet(
                rs.getObject("id", UUID.class),
                rs.getLong("balance_satang")
        ), userId).stream().findFirst();
    }

    private Optional<Donation> byIdempotencyKey(String idempotencyKey) {
        return jdbc.query(
                DONATION_SELECT + " WHERE donation.idempotency_key = ?",
                this::mapDonation,
                idempotencyKey
        ).stream().findFirst();
    }

    private Donation validateRetry(
            Donation donation,
            UUID userId,
            String donorName,
            String message,
            boolean anonymous,
            long amountSatang,
            DonationRequests.FundingMethod fundingMethod
    ) {
        if (!donation.userId().equals(userId)
                || !donation.donorName().equals(donorName)
                || !Objects.equals(donation.message(), message)
                || donation.anonymous() != anonymous
                || donation.amountSatang() != amountSatang
                || !donation.fundingMethod().equals(fundingMethod.name())) {
            throw new DonationException(
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency key was used for another donation",
                    DonationException.Kind.CONFLICT
            );
        }
        return donation;
    }

    private Donation mapDonation(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Donation(
                rs.getObject("id", UUID.class),
                rs.getString("donation_number"),
                rs.getObject("user_id", UUID.class),
                rs.getString("donor_name"),
                rs.getString("message"),
                rs.getBoolean("anonymous"),
                rs.getLong("amount_satang"),
                rs.getString("currency"),
                rs.getString("funding_method"),
                rs.getString("status"),
                rs.getLong("balance_satang"),
                rs.getObject("succeeded_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class)
        );
    }

    private static final String DONATION_SELECT = """
            SELECT donation.id,
                   donation.donation_number,
                   donation.user_id,
                   donation.donor_name,
                   donation.message,
                   donation.anonymous,
                   donation.amount_satang,
                   donation.currency,
                   donation.funding_method,
                   donation.status,
                   wallet.balance_satang,
                   donation.succeeded_at,
                   donation.created_at
              FROM support.donations AS donation
              JOIN billing.customers AS customer ON customer.user_id = donation.user_id
              JOIN billing.wallets AS wallet
                ON wallet.customer_id = customer.id
               AND wallet.currency = 'THB'
            """;

    record Campaign(
            String title,
            String description,
            long goalSatang,
            long raisedSatang,
            long supporterCount,
            OffsetDateTime updatedAt
    ) {}

    record LeaderboardEntry(
            String displayName,
            long totalSatang,
            long donationCount,
            OffsetDateTime lastDonatedAt
    ) {}

    record Wallet(UUID id, long balanceSatang) {}

    record Donation(
            UUID id,
            String donationNumber,
            UUID userId,
            String donorName,
            String message,
            boolean anonymous,
            long amountSatang,
            String currency,
            String fundingMethod,
            String status,
            long balanceSatang,
            OffsetDateTime succeededAt,
            OffsetDateTime createdAt
    ) {}
}
