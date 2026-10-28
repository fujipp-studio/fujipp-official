package com.fujipp.backend.voucher;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Max;

import java.util.UUID;

public record RedeemTrueMoneyVoucherRequest(
        @NotNull UUID botId,
        @NotBlank @Pattern(regexp = "^[0-9]{15,30}$") String memberDiscordId,
        @JsonProperty("gift_url")
        @NotBlank
        @Pattern(
                regexp = "^https://gift\\.truemoney\\.com/campaign/\\?v=[A-Za-z0-9_-]+$",
                message = "gift_url must be a TrueMoney campaign URL"
        )
        String giftUrl,
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey,
        @Pattern(regexp = "^[0-9]{15,30}$") String paymentMessageId,
        @Positive @Max(100_000_000) Long expectedAmountSatang
) {
    public RedeemTrueMoneyVoucherRequest(UUID botId, String memberDiscordId, String giftUrl, String idempotencyKey) {
        this(botId, memberDiscordId, giftUrl, idempotencyKey, null, null);
    }

    @AssertTrue(message = "Payment message and expected amount must be supplied together")
    public boolean isPaymentContextValid() {
        return (paymentMessageId == null) == (expectedAmountSatang == null);
    }
}
