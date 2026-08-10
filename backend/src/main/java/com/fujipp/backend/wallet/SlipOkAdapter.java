package com.fujipp.backend.wallet;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;

@Component
class SlipOkAdapter {
    private final RestClient http = RestClient.builder().baseUrl("https://api.slipok.com").build();
    private final tools.jackson.databind.ObjectMapper mapper;

    SlipOkAdapter(tools.jackson.databind.ObjectMapper mapper) {
        this.mapper = mapper;
    }

    Result verify(String branchId, String apiKey, String imageUrl, long amountSatang) {
        JsonNode response = http.post().uri("/api/line/apikey/{branchId}", branchId)
                .header("x-authorization", apiKey).contentType(MediaType.APPLICATION_JSON)
                .body(java.util.Map.of(
                        "url", imageUrl,
                        "log", true,
                        "amount", BigDecimal.valueOf(amountSatang, 2)
                )).exchange((request, upstream) -> {
                    byte[] body = upstream.getBody().readAllBytes();
                    JsonNode json = body.length == 0 ? mapper.createObjectNode() : mapper.readTree(body);
                    if (!upstream.getStatusCode().is2xxSuccessful()) {
                        int code = json.path("code").asInt(0);
                        String safe = switch (code) {
                            case 1010 -> "ธนาคารกำลังประมวลผลสลิป กรุณาลองใหม่ภายหลัง";
                            case 1012 -> "สลิปนี้ถูกใช้เติมเงินแล้ว";
                            case 1013 -> "ยอดเงินในสลิปไม่ตรงกับรายการ";
                            case 1014 -> "บัญชีผู้รับในสลิปไม่ถูกต้อง";
                            default -> "SlipOK ไม่สามารถยืนยันสลิปได้";
                        };
                        throw new WalletException(code == 0 ? "SLIPOK_REJECTED" : "SLIPOK_" + code, safe);
                    }
                    return json;
                });
        if (response == null || !response.path("success").asBoolean(false)) {
            throw new WalletException("SLIPOK_REJECTED", "SlipOK rejected the slip");
        }
        JsonNode data = response.path("data");
        String reference = firstText(data, "transRef", "reference", "qrcodeData");
        if (reference == null) throw new WalletException("SLIPOK_INVALID_RESPONSE", "SlipOK returned no reference");
        return new Result(reference);
    }

    private static String firstText(JsonNode node, String... keys) {
        for (String key : keys) {
            String value = node.path(key).asString("");
            if (!value.isBlank()) return value;
        }
        return null;
    }
    record Result(String reference) {}
}
