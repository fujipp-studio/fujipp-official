package com.fujipp.backend.store;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
class WalletQrConfigurationValidatorTests {
    @Test void validatesOptionalBrandingBeforeSavingAnyFeatureConfiguration() {
        var json=JsonMapper.builder().build();
        WalletQrConfigurationValidator.validate(Map.of());
        WalletQrConfigurationValidator.validate(Map.of("PROMPTPAY_QR_WATERMARK",json.readTree("{\"mode\":\"NONE\"}")));
        WalletQrConfigurationValidator.validate(Map.of("PROMPTPAY_QR_WATERMARK",json.readTree("{\"mode\":\"TEXT\",\"text\":\"ร้านขนม\"}")));
        assertThatThrownBy(()->WalletQrConfigurationValidator.validate(Map.of("PROMPTPAY_QR_WATERMARK",json.readTree("{\"mode\":\"LOGO\"}"))))
            .isInstanceOf(StoreValidationException.class);
    }
}
