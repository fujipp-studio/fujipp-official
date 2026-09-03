package com.fujipp.backend.donation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

final class DonationRequests {
    private DonationRequests() {}

    enum FundingMethod { WALLET, TOPUP }

    record Create(
            @Positive long amountSatang,
            @Size(max = 60) String donorName,
            @Size(max = 280) String message,
            boolean anonymous,
            @NotNull FundingMethod fundingMethod,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey
    ) {}

    record UpdateSettings(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 500) String description,
            long goalSatang
    ) {}
}
