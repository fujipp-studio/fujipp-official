package com.fujipp.backend.wallet;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WalletRequestsValidationTests {

    private static final UUID BOT_ID = UUID.fromString("1759fb50-3b68-49f4-89f9-e43623029941");
    private static final String MEMBER_ID = "1494842858132471980";
    private static final String IDEMPOTENCY_KEY = "discord:1494842858132471980";

    @Test
    void acceptsTrueMoneyCampaignUrlWithOrWithoutTrailingSlash() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();

            assertThat(validator.validate(request("https://gift.truemoney.com/campaign?v=voucherCode")))
                    .isEmpty();
            assertThat(validator.validate(request("https://gift.truemoney.com/campaign/?v=voucherCode")))
                    .isEmpty();
        }
    }

    @Test
    void rejectsUnexpectedTrueMoneyCampaignUrlVariants() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();

            assertThat(validator.validate(request("http://gift.truemoney.com/campaign?v=voucherCode")))
                    .extracting(violation -> violation.getPropertyPath().toString())
                    .contains("giftUrl");
            assertThat(validator.validate(request("https://gift.truemoney.com/campaign?v=voucherCode&extra=true")))
                    .extracting(violation -> violation.getPropertyPath().toString())
                    .contains("giftUrl");
        }
    }

    private WalletRequests.VoucherTopup request(String giftUrl) {
        return new WalletRequests.VoucherTopup(BOT_ID, MEMBER_ID, giftUrl, IDEMPOTENCY_KEY);
    }
}
