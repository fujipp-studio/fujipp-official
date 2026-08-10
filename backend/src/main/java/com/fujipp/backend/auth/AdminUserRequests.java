package com.fujipp.backend.auth;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public class AdminUserRequests {
    public record AdjustWalletRequest(
            @NotNull String direction,
            @NotBlank String entryType,
            @Min(1) long amountSatang,
            String description,
            @NotBlank @Size(max=150) String idempotencyKey
    ) {}

    public record UpdateAccountRequest(
            @NotBlank String role,
            @NotBlank String status,
            @Size(max=100) String displayName,
            @Size(max=100) String firstName,
            @Size(max=100) String lastName
    ) {}

    public record GrantFeatureRequest(
            @NotNull UUID featureProductId,
            @Min(1) int installationLimit,
            OffsetDateTime expiresAt
    ) {}

    public record UpdateFeatureLicenseRequest(
            @NotBlank String status,
            @Min(1) int installationLimit,
            OffsetDateTime expiresAt
    ) {}
}
