package com.fujipp.backend.voucher;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class VoucherRepository {

    private final JdbcTemplate jdbcTemplate;

    VoucherRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    Optional<String> findRecipientPhone(UUID botId) {
        List<String> values = jdbcTemplate.query(
                """
                SELECT COALESCE(config_value.value, definition.default_value) #>> '{}'
                  FROM private.bot_feature_installations AS installation
                  JOIN private.feature_licenses AS license
                    ON license.id = installation.license_id
                   AND license.status = 'ACTIVE'
                   AND (license.expires_at IS NULL OR license.expires_at > now())
                  JOIN shop.feature_products AS product
                    ON product.id = installation.feature_product_id
                   AND product.code = 'wallet-topup'
                  JOIN private.feature_config_sets AS config
                    ON config.license_id = license.id
                   AND config.feature_version_id = installation.feature_version_id
                  JOIN shop.feature_config_definitions AS definition
                    ON definition.feature_version_id = config.feature_version_id
                   AND definition.config_key = 'TRUEMONEY_PHONE'
                   AND definition.is_secret = false
                  LEFT JOIN private.feature_config_values AS config_value
                    ON config_value.config_set_id = config.id
                   AND config_value.definition_id = definition.id
                  JOIN bots.bot_instances AS bot
                    ON bot.id = installation.bot_id
                   AND bot.status NOT IN ('SUSPENDED', 'DECOMMISSIONED')
                 WHERE installation.bot_id = ?
                   AND installation.status = 'ACTIVE'
                   AND installation.removed_at IS NULL
                   AND COALESCE(config_value.value, definition.default_value) IS NOT NULL
                """,
                (resultSet, rowNumber) -> resultSet.getString(1),
                botId
        );
        return values.stream().findFirst();
    }

    Optional<UUID> claim(
            RedeemTrueMoneyVoucherRequest request,
            String phone,
            String voucherHash,
            String requestFingerprint
    ) {
        return jdbcTemplate.query(
                """
                INSERT INTO private.truemoney_voucher_redemptions (
                    bot_id, member_discord_id, recipient_phone, voucher_hash,
                    request_fingerprint, idempotency_key
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                RETURNING id
                """,
                resultSet -> resultSet.next()
                        ? Optional.of(resultSet.getObject(1, UUID.class))
                        : Optional.empty(),
                request.botId(), request.memberDiscordId(), phone, voucherHash,
                requestFingerprint, request.idempotencyKey()
        );
    }

    Optional<RedemptionRow> findById(UUID id) {
        return find("WHERE id = ?", id);
    }

    Optional<RedemptionRow> findByIdempotency(UUID botId, String idempotencyKey) {
        return find("WHERE bot_id = ? AND idempotency_key = ?", botId, idempotencyKey);
    }

    Optional<RedemptionRow> findByVoucherHash(String voucherHash) {
        return find("WHERE voucher_hash = ?", voucherHash);
    }

    RedemptionRow succeed(UUID id, long amountSatang, String issuer, String reference) {
        return update(
                """
                UPDATE private.truemoney_voucher_redemptions
                   SET status = 'SUCCEEDED',
                       amount_satang = ?,
                       issuer = ?,
                       upstream_reference = ?,
                       completed_at = now()
                 WHERE id = ? AND status = 'REDEEMING'
                RETURNING *
                """,
                amountSatang, issuer, reference, id
        );
    }

    RedemptionRow fail(UUID id, VoucherStatus status, String code, String message) {
        return update(
                """
                UPDATE private.truemoney_voucher_redemptions
                   SET status = ?::private.voucher_redemption_status,
                       failure_code = ?,
                       failure_message = ?,
                       completed_at = now()
                 WHERE id = ? AND status = 'REDEEMING'
                RETURNING *
                """,
                status.name(), code, message, id
        );
    }

    RedemptionRow reconcileStale(UUID id) {
        return fail(
                id,
                VoucherStatus.RECONCILIATION_REQUIRED,
                "STALE_REDEEMING",
                "TrueMoney may have accepted this voucher; verify it before any recovery"
        );
    }

    private Optional<RedemptionRow> find(String whereClause, Object... arguments) {
        return jdbcTemplate.query(
                "SELECT * FROM private.truemoney_voucher_redemptions " + whereClause,
                resultSet -> resultSet.next() ? Optional.of(map(resultSet)) : Optional.empty(),
                arguments
        );
    }

    private RedemptionRow update(String sql, Object... arguments) {
        return jdbcTemplate.queryForObject(sql, (resultSet, rowNumber) -> map(resultSet), arguments);
    }

    private RedemptionRow map(java.sql.ResultSet resultSet) throws java.sql.SQLException {
        return new RedemptionRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("bot_id", UUID.class),
                resultSet.getString("member_discord_id"),
                resultSet.getString("request_fingerprint"),
                VoucherStatus.valueOf(resultSet.getString("status")),
                resultSet.getObject("amount_satang", Long.class),
                resultSet.getString("currency"),
                resultSet.getString("issuer"),
                resultSet.getString("upstream_reference"),
                resultSet.getString("failure_code"),
                resultSet.getString("failure_message"),
                resultSet.getObject("processing_started_at", OffsetDateTime.class),
                resultSet.getObject("completed_at", OffsetDateTime.class),
                resultSet.getObject("created_at", OffsetDateTime.class)
        );
    }

    record RedemptionRow(
            UUID id,
            UUID botId,
            String memberDiscordId,
            String requestFingerprint,
            VoucherStatus status,
            Long amountSatang,
            String currency,
            String issuer,
            String reference,
            String failureCode,
            String failureMessage,
            OffsetDateTime processingStartedAt,
            OffsetDateTime completedAt,
            OffsetDateTime createdAt
    ) {
        VoucherRedemptionResponse response() {
            return new VoucherRedemptionResponse(
                    id, botId, memberDiscordId, status.name(), amountSatang, currency,
                    issuer, reference, failureCode, failureMessage,
                    processingStartedAt, completedAt, createdAt
            );
        }
    }
}
