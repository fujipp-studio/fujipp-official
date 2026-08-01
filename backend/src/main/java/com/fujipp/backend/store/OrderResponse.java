package com.fujipp.backend.store;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        String orderNumber,
        String status,
        long totalSatang,
        String currency,
        OffsetDateTime paidAt,
        List<UUID> licenseIds
) {
}
