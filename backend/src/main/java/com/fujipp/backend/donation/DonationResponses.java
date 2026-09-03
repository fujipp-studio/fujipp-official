package com.fujipp.backend.donation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

final class DonationResponses {
    private DonationResponses() {}

    record Campaign(
            String title,
            String description,
            long goalSatang,
            long raisedSatang,
            long supporterCount,
            List<LeaderboardEntry> leaderboard,
            OffsetDateTime updatedAt
    ) {}

    record LeaderboardEntry(
            int rank,
            String displayName,
            long totalSatang,
            long donationCount,
            OffsetDateTime lastDonatedAt
    ) {}

    record Donation(
            UUID donationId,
            String donationNumber,
            String donorName,
            String message,
            boolean anonymous,
            long amountSatang,
            String currency,
            String fundingMethod,
            String status,
            long balanceSatang,
            OffsetDateTime completedAt,
            OffsetDateTime createdAt
    ) {}
}
