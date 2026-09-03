package com.fujipp.backend.donation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
class DonationService {
    private final DonationRepository repository;
    private final long minimumSatang;
    private final long maximumSatang;

    DonationService(
            DonationRepository repository,
            @Value("${app.donation.minimum-satang:1000}") long minimumSatang,
            @Value("${app.donation.maximum-satang:10000000}") long maximumSatang
    ) {
        this.repository = repository;
        this.minimumSatang = minimumSatang;
        this.maximumSatang = maximumSatang;
    }

    DonationResponses.Campaign campaign() {
        DonationRepository.Campaign campaign = repository.campaign();
        var rows = repository.leaderboard(10);
        var leaderboard = java.util.stream.IntStream.range(0, rows.size())
                .mapToObj(index -> {
                    DonationRepository.LeaderboardEntry row = rows.get(index);
                    return new DonationResponses.LeaderboardEntry(
                            index + 1,
                            row.displayName(),
                            row.totalSatang(),
                            row.donationCount(),
                            row.lastDonatedAt()
                    );
                })
                .toList();
        return new DonationResponses.Campaign(
                campaign.title(),
                campaign.description(),
                campaign.goalSatang(),
                campaign.raisedSatang(),
                campaign.supporterCount(),
                leaderboard,
                campaign.updatedAt()
        );
    }

    DonationResponses.Donation create(String subject, DonationRequests.Create request) {
        if (request.amountSatang() < minimumSatang || request.amountSatang() > maximumSatang) {
            throw new DonationException(
                    "INVALID_DONATION_AMOUNT",
                    "Donation amount must be between configured minimum and maximum",
                    DonationException.Kind.VALIDATION
            );
        }

        String donorName = request.anonymous() ? "Anonymous" : clean(request.donorName());
        if (!request.anonymous() && donorName == null) {
            throw new DonationException(
                    "DONOR_NAME_REQUIRED",
                    "Donor name is required unless donating anonymously",
                    DonationException.Kind.VALIDATION
            );
        }

        return response(repository.create(
                userId(subject),
                donorName,
                clean(request.message()),
                request.anonymous(),
                request.amountSatang(),
                request.fundingMethod(),
                request.idempotencyKey()
        ));
    }

    DonationResponses.Donation get(String subject, UUID donationId) {
        return response(repository.owned(donationId, userId(subject)).orElseThrow(() -> new DonationException(
                "DONATION_NOT_FOUND",
                "Donation was not found",
                DonationException.Kind.NOT_FOUND
        )));
    }

    DonationResponses.Campaign updateSettings(String subject, DonationRequests.UpdateSettings request) {
        if (request.goalSatang() < 0 || request.goalSatang() > maximumSatang * 100) {
            throw new DonationException(
                    "INVALID_DONATION_GOAL",
                    "Donation goal is outside the supported range",
                    DonationException.Kind.VALIDATION
            );
        }
        String title = clean(request.title());
        String description = clean(request.description());
        if (title == null) {
            throw new DonationException(
                    "DONATION_TITLE_REQUIRED",
                    "Donation campaign title is required",
                    DonationException.Kind.VALIDATION
            );
        }
        DonationRepository.Campaign updated = repository.updateSettings(
                title,
                description == null ? "" : description,
                request.goalSatang(),
                userId(subject)
        );
        var leaderboard = campaign().leaderboard();
        return new DonationResponses.Campaign(
                updated.title(),
                updated.description(),
                updated.goalSatang(),
                updated.raisedSatang(),
                updated.supporterCount(),
                leaderboard,
                updated.updatedAt()
        );
    }

    private DonationResponses.Donation response(DonationRepository.Donation donation) {
        return new DonationResponses.Donation(
                donation.id(),
                donation.donationNumber(),
                donation.donorName(),
                donation.message(),
                donation.anonymous(),
                donation.amountSatang(),
                donation.currency(),
                donation.fundingMethod(),
                donation.status(),
                donation.balanceSatang(),
                donation.succeededAt(),
                donation.createdAt()
        );
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static UUID userId(String subject) {
        if (subject == null) {
            throw new DonationException(
                    "AUTHENTICATION_REQUIRED",
                    "Sign in before donating",
                    DonationException.Kind.NOT_FOUND
            );
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException exception) {
            throw new DonationException(
                    "INVALID_AUTHENTICATION",
                    "Authenticated user id is invalid",
                    DonationException.Kind.VALIDATION
            );
        }
    }
}
