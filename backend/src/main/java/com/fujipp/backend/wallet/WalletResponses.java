package com.fujipp.backend.wallet;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

final class WalletResponses {
    private WalletResponses() {}

    record Balance(long balanceSatang, String currency) {}
    record Topup(UUID transactionId, long creditedSatang, long balanceSatang,
                 String currency, String method, boolean created, OffsetDateTime completedAt) {}
    record PromptPaySession(UUID sessionId, long amountSatang, String currency,
                            String accountName, String qrUrl, OffsetDateTime expiresAt) {}
    record Adjustment(UUID transactionId, long adjustmentSatang, long balanceSatang,
                      String currency, String operation, boolean created, OffsetDateTime completedAt) {}
    record HistoryEntry(UUID transactionId, String kind, long amountSatang, long balanceAfterSatang,
                        String method, String reason, OffsetDateTime createdAt) {}
    record History(List<HistoryEntry> entries, String currency) {}
    record MonthlySummary(long totalSatang, long entryCount, long memberCount, String currency) {}
    record LeaderboardEntry(String memberDiscordId, long totalTopupSatang, long entryCount) {}
    record Leaderboard(List<LeaderboardEntry> entries, String currency) {}
}
