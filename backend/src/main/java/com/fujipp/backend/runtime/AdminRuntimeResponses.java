package com.fujipp.backend.runtime;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class AdminRuntimeResponses {
    private AdminRuntimeResponses() {}
    public record Plan(UUID id,String code,String name,int durationDays,long priceSatang,String currency,
                       boolean active,int sortOrder) {}
    public record Subscription(UUID id,int slotNumber,UUID ownerUserId,String ownerDisplayName,
                               UUID planId,String planName,UUID botId,String botName,String status,
                               boolean autoRenew,OffsetDateTime periodStart,OffsetDateTime periodEnd,
                               OffsetDateTime graceUntil) {}
}
