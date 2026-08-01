package com.fujipp.backend.store;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CheckoutRequest(
        @NotNull UUID offerId,
        @Min(1) @Max(20) int quantity,
        @NotBlank @Size(max = 120) String idempotencyKey
) {
}
