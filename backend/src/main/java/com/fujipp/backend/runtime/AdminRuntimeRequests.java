package com.fujipp.backend.runtime;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class AdminRuntimeRequests {
    private AdminRuntimeRequests() {}
    public record UpdatePlanRequest(@NotBlank @Size(max=100) String name, @Min(1) int durationDays,
                                    @Min(1) long priceSatang, boolean active, @Min(0) int sortOrder) {}
    public record GrantRequest(@NotNull UUID ownerUserId, @NotNull UUID planId, UUID botId,
                               OffsetDateTime periodEnd, boolean autoRenew) {}
    public record UpdateSubscriptionRequest(@NotBlank String status, @NotNull UUID planId, UUID botId,
                                            @NotNull OffsetDateTime periodEnd, boolean autoRenew) {}
}
