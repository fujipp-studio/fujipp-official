package com.fujipp.backend.topup;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptPayQrGeneratorTests {
    private final PromptPayQrGenerator generator = new PromptPayQrGenerator();

    @Test
    void createsStandardDynamicPromptPayPayloadForFormattedMobileNumber() {
        PromptPayQrGenerator.PaymentQr qr=generator.generate("081-234-5678",1000);

        assertEquals("00020101021229370016A000000677010111011300668123456785303764540510.005802TH6304CA25",
                qr.payload());
        assertTrue(qr.imageDataUri().startsWith("data:image/png;base64,"));
    }

    @Test
    void rejectsUnsupportedPromptPayIdentifiers() {
        TopupException exception=assertThrows(TopupException.class,()->generator.generate("1234",1000));
        assertEquals("INVALID_PROMPTPAY_ID",exception.code());
    }
}
