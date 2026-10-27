package com.fujipp.backend.store;

import com.fujipp.backend.topup.QrWatermark;
import tools.jackson.databind.JsonNode;
import java.util.Map;

final class WalletQrConfigurationValidator {
    static void validate(Map<String,JsonNode> values) {
        if (!values.containsKey("PROMPTPAY_QR_WATERMARK")) return;
        try { QrWatermark.parse(values.get("PROMPTPAY_QR_WATERMARK"),"Shop"); }
        catch (IllegalArgumentException error) { throw new StoreValidationException(error.getMessage()); }
    }
}
