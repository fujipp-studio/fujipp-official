package com.fujipp.backend.topup;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Component
class SlipOkClient {
    private static final ZoneId BANGKOK = ZoneId.of("Asia/Bangkok");

    private final RestClient http;
    private final ObjectMapper mapper;
    private final String branchId;
    private final String apiKey;

    SlipOkClient(
            ObjectMapper mapper,
            @Value("${app.topup.slipok.branch-id:}") String branchId,
            @Value("${app.topup.slipok.api-key:}") String apiKey
    ) {
        this.mapper = mapper;
        this.branchId = branchId;
        this.apiKey = apiKey;
        this.http = RestClient.builder().baseUrl("https://api.slipok.com").build();
    }

    Result verify(byte[] bytes, String filename, MediaType contentType, long expectedSatang) {
        if (branchId.isBlank() || apiKey.isBlank()) {
            throw new TopupException("SLIPOK_NOT_CONFIGURED", "SlipOK is not configured", TopupException.Kind.CONFIGURATION);
        }

        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("files", new NamedResource(bytes, filename)).contentType(contentType);
        body.part("log", "true");
        body.part("amount", BigDecimal.valueOf(expectedSatang, 2).toPlainString());

        JsonNode response;
        try {
            response = http.post()
                    .uri("/api/line/apikey/{branchId}", branchId)
                    .header("x-authorization", apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body.build())
                    .exchange((request, upstream) -> {
                        byte[] responseBytes = upstream.getBody().readAllBytes();
                        JsonNode json = responseBytes.length == 0
                                ? mapper.createObjectNode()
                                : mapper.readTree(responseBytes);
                        if (!upstream.getStatusCode().is2xxSuccessful()) {
                            int slipOkCode = json.path("code").asInt(0);
                            throw rejected(slipOkCode);
                        }
                        return json;
                    });
        } catch (TopupException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new TopupException("SLIPOK_UNAVAILABLE", "SlipOK is temporarily unavailable", TopupException.Kind.UPSTREAM);
        }

        if (response == null || !response.path("success").asBoolean(false)) {
            throw new TopupException("SLIPOK_REJECTED", "SlipOK rejected the slip", TopupException.Kind.UPSTREAM);
        }
        JsonNode data = response.path("data");
        String reference = text(data, "transRef");
        if (reference == null) {
            throw new TopupException("SLIPOK_INVALID_RESPONSE", "SlipOK returned no transaction reference", TopupException.Kind.UPSTREAM);
        }
        long amountSatang;
        try {
            amountSatang = data.path("amount").decimalValue().movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            throw new TopupException("SLIPOK_INVALID_RESPONSE", "SlipOK returned an invalid amount", TopupException.Kind.UPSTREAM);
        }
        return new Result(
                reference,
                transactionAt(data),
                text(data, "sendingBank"),
                text(data, "receivingBank"),
                text(data.path("sender"), "displayName"),
                text(data.path("receiver"), "displayName"),
                amountSatang,
                response.toString()
        );
    }

    private static TopupException rejected(int code) {
        return switch (code) {
            case 1010 -> new TopupException("SLIPOK_1010", "ธนาคารกำลังประมวลผลสลิป กรุณาลองใหม่ภายหลัง", TopupException.Kind.UPSTREAM);
            case 1012 -> new TopupException("SLIP_ALREADY_USED", "สลิปนี้ถูกใช้เติมเงินแล้ว", TopupException.Kind.CONFLICT);
            case 1013 -> new TopupException("SLIP_AMOUNT_MISMATCH", "ยอดเงินในสลิปไม่ตรงกับรายการ", TopupException.Kind.VALIDATION);
            case 1014 -> new TopupException("SLIP_RECEIVER_MISMATCH", "บัญชีผู้รับในสลิปไม่ถูกต้อง", TopupException.Kind.VALIDATION);
            default -> new TopupException(code == 0 ? "SLIPOK_REJECTED" : "SLIPOK_" + code,
                    "SlipOK ไม่สามารถยืนยันสลิปได้", TopupException.Kind.VALIDATION);
        };
    }

    private static OffsetDateTime transactionAt(JsonNode data) {
        String date = text(data, "transDate");
        String time = text(data, "transTime");
        if (date == null || time == null) return OffsetDateTime.now(BANGKOK);
        try {
            DateTimeFormatter dateFormat = date.contains("-")
                    ? DateTimeFormatter.ISO_LOCAL_DATE
                    : DateTimeFormatter.BASIC_ISO_DATE;
            return LocalDate.parse(date, dateFormat).atTime(LocalTime.parse(time)).atZone(BANGKOK).toOffsetDateTime();
        } catch (RuntimeException ignored) {
            return OffsetDateTime.now(BANGKOK);
        }
    }

    private static String text(JsonNode node, String key) {
        String value = node.path(key).asString("");
        return value.isBlank() ? null : value;
    }

    record Result(String reference, OffsetDateTime transactionAt, String sendingBank,
                  String receivingBank, String senderName, String receiverName,
                  long amountSatang, String rawJson) {}

    private static final class NamedResource extends ByteArrayResource {
        private final String filename;
        private NamedResource(byte[] bytes, String filename) {
            super(bytes);
            this.filename = filename == null || filename.isBlank() ? "slip.png" : filename;
        }
        @Override public String getFilename() { return filename; }
    }
}
