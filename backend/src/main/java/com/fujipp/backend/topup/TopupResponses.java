package com.fujipp.backend.topup;

import java.time.OffsetDateTime;
import java.util.UUID;

final class TopupResponses {
    private TopupResponses() {}

    record Invoice(
            UUID invoiceId,
            String invoiceNumber,
            long amountSatang,
            String currency,
            String status,
            String promptPayAccountName,
            String qrImageUrl,
            long balanceSatang,
            OffsetDateTime expiresAt,
            OffsetDateTime completedAt,
            OffsetDateTime createdAt
    ) {}

    record Summary(
            UUID invoiceId,
            String invoiceNumber,
            long amountSatang,
            String currency,
            String status,
            OffsetDateTime expiresAt,
            OffsetDateTime completedAt,
            OffsetDateTime createdAt
    ) {}
}
