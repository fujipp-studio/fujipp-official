package com.fujipp.backend.runtime;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RuntimeSubscriptionResponse(
        UUID id, int slotNumber, UUID planId, String planName, int durationDays,
        long priceSatang, String currency, UUID botId, String botName, String status,
        boolean autoRenew, OffsetDateTime currentPeriodEnd, OffsetDateTime graceUntil
) {}
