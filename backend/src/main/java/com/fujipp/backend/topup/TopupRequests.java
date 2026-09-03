package com.fujipp.backend.topup;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

final class TopupRequests {
    private TopupRequests() {}

    record Create(
            @Positive long amountSatang,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey,
            UUID donationId
    ) {}
}
