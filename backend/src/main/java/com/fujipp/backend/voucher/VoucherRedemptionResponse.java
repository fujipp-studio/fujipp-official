package com.fujipp.backend.voucher;

import java.time.OffsetDateTime;
import java.util.UUID;

public record VoucherRedemptionResponse(
        UUID id,
        UUID botId,
        String memberDiscordId,
        String status,
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
}
