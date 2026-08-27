package com.fujipp.backend.topup;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.Map;

@Component
class PromptPayQrGenerator {
    private static final String PROMPTPAY_AID = "A000000677010111";

    PaymentQr generate(String configuredId, long amountSatang) {
        String target = normalize(configuredId);
        String targetTag = target.length() == 13 && target.startsWith("0066") ? "01" : "02";
        String merchantAccount = tlv("00", PROMPTPAY_AID) + tlv(targetTag, target);
        String amount = BigDecimal.valueOf(amountSatang, 2).toPlainString();
        String withoutCrc = tlv("00", "01")
                + tlv("01", "12")
                + tlv("29", merchantAccount)
                + tlv("53", "764")
                + tlv("54", amount)
                + tlv("58", "TH")
                + "6304";
        String payload = withoutCrc + String.format("%04X", crc16(withoutCrc));
        return new PaymentQr(payload, pngDataUri(payload));
    }

    String pngDataUri(String payload) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, 512, 512,
                    Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 2));
            BufferedImage image = new BufferedImage(matrix.getWidth(), matrix.getHeight(), BufferedImage.TYPE_BYTE_BINARY);
            for (int y = 0; y < matrix.getHeight(); y++) {
                for (int x = 0; x < matrix.getWidth(); x++) image.setRGB(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "PNG", output);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (WriterException | IOException exception) {
            throw new TopupException("PROMPTPAY_QR_FAILED", "Could not generate PromptPay QR", TopupException.Kind.CONFIGURATION);
        }
    }

    private static String normalize(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (digits.length() == 10 && digits.startsWith("0")) return "0066" + digits.substring(1);
        if (digits.length() == 11 && digits.startsWith("66")) return "00" + digits;
        if (digits.length() == 13) return digits;
        throw new TopupException("INVALID_PROMPTPAY_ID",
                "PromptPay ID must be a Thai mobile number or 13-digit national/tax ID",
                TopupException.Kind.CONFIGURATION);
    }

    private static String tlv(String tag, String value) { return tag + String.format("%02d", value.length()) + value; }

    private static int crc16(String value) {
        int crc = 0xFFFF;
        for (byte current : value.getBytes(java.nio.charset.StandardCharsets.US_ASCII)) {
            crc ^= (current & 0xFF) << 8;
            for (int bit = 0; bit < 8; bit++) crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }
        return crc;
    }

    record PaymentQr(String payload, String imageDataUri) {}
}
