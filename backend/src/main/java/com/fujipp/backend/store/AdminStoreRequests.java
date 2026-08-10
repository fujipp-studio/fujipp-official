package com.fujipp.backend.store;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class AdminStoreRequests {
    private AdminStoreRequests() {}

    public record UpdateFeatureRequest(
            @NotBlank @Size(max = 150) String name,
            @NotNull @Size(max = 5000) String description,
            @NotBlank @Size(max = 60) String category,
            @Size(max = 100) String iconKey,
            @NotBlank String status,
            boolean featured,
            @Min(0) int sortOrder
    ) {}

    public record UpdateOfferRequest(
            @NotBlank @Size(max = 150) String name,
            @Min(1) long priceSatang,
            @Min(1) int installationLimit,
            boolean active,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt
    ) {}

    public record CreateOfferRequest(
            @NotBlank @Size(max = 80) String code,
            @NotBlank @Size(max = 150) String name,
            @NotBlank String kind,
            @Min(1) long priceSatang,
            @Min(1) int installationLimit,
            @Min(1) Integer billingPeriodDays,
            boolean active,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt
    ) {}

    public record TransferBotRequest(@NotNull UUID newOwnerUserId) {}
}
