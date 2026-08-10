package com.fujipp.backend.auth;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class AdminUserResponses {
    public record UserSummary(
            UUID customerId,
            UUID userId,
            String customerCode,
            String email,
            String displayName,
            String status,
            String role,
            long balanceSatang,
            OffsetDateTime createdAt
    ) {}

    public record WalletHistoryEntry(
            UUID id,
            String direction,
            String entryType,
            long amountSatang,
            long balanceBeforeSatang,
            long balanceAfterSatang,
            String referenceType,
            UUID referenceId,
            String description,
            OffsetDateTime createdAt
    ) {}

    public record WalletHistoryResponse(
            UUID customerId,
            UUID walletId,
            long currentBalanceSatang,
            List<WalletHistoryEntry> entries
    ) {}

    public record FeatureLicense(
            UUID id, UUID featureProductId, String featureCode, String featureName,
            String version, String status, int installationLimit,
            OffsetDateTime acquiredAt, OffsetDateTime expiresAt
    ) {}
}
