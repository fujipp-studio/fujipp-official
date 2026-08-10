package com.fujipp.backend.wallet;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.UUID;

final class WalletRequests {
    private WalletRequests() {}

    record VoucherTopup(
            @NotNull UUID botId,
            @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String memberDiscordId,
            @NotBlank @Pattern(regexp = "^https://gift\\.truemoney\\.com/campaign/\\?v=[A-Za-z0-9_-]+$") String giftUrl,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey
    ) {}

    record CreatePromptPay(
            @NotNull UUID botId,
            @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String memberDiscordId,
            @Positive long amountSatang
    ) {}

    record VerifySlip(
            @NotNull UUID botId,
            UUID sessionId,
            @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String memberDiscordId,
            @NotBlank @Pattern(
                    regexp = "^https://(cdn\\.discordapp\\.com|media\\.discordapp\\.net)/attachments/.+$",
                    message = "slipImageUrl must be a Discord attachment URL"
            ) String slipImageUrl,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey
    ) {}

    record Adjustment(
            @NotNull UUID botId,
            @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String memberDiscordId,
            @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String actorDiscordId,
            @NotBlank @Pattern(regexp = "^(ADD|REMOVE|SET)$") String operation,
            @PositiveOrZero long amountSatang,
            @NotBlank @Size(max = 300) String reason,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey
    ) {}
}
