package com.fujipp.backend.voucher;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
class TrueMoneyVoucherAdapter {

    private static final String BASE_URL = "https://gift.truemoney.com/campaign/vouchers";
    private static final List<MediaType> ACCEPT =
            MediaType.parseMediaTypes("application/json, text/plain, */*");

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String userAgent;

    TrueMoneyVoucherAdapter(
            ObjectMapper objectMapper,
            @Value("${app.voucher.truemoney.user-agent:fujipp-voucher/1.0}") String userAgent,
            @Value("${app.voucher.truemoney.timeout-ms:12000}") long timeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.userAgent = userAgent;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    Outcome redeem(String phone, String giftUrl) {
        String voucherCode = voucherCode(giftUrl);
        JsonNode verification = request(
                HttpMethod.GET,
                BASE_URL + "/" + voucherCode + "/verify?mobile=" + phone,
                null
        );
        if (!"active".equals(verification.path("data").path("voucher").path("status").asString(""))) {
            throw new VoucherException("VOUCHER_INVALID", "Voucher is not active");
        }

        JsonNode redeemed = redeemWithOneBadRequestRetry(voucherCode, phone);
        JsonNode voucher = redeemed.path("data").path("voucher");
        String amount = voucher.has("redeemed_amount_baht")
                ? voucher.get("redeemed_amount_baht").asString("")
                : voucher.path("amount_baht").asString("");
        String issuer = text(redeemed.path("data").path("owner_profile").path("full_name"));
        String reference = text(voucher.path("voucher_id"));
        if (reference == null) {
            reference = text(redeemed.path("data").path("my_ticket").path("update_date"));
        }
        try {
            return new Outcome(new BigDecimal(amount), issuer, reference);
        } catch (NumberFormatException exception) {
            throw new VoucherException("UPSTREAM_INVALID_AMOUNT", "TrueMoney returned an invalid amount");
        }
    }

    private JsonNode redeemWithOneBadRequestRetry(String voucherCode, String phone) {
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                return request(
                        HttpMethod.POST,
                        BASE_URL + "/" + voucherCode + "/redeem",
                        Map.of("mobile", phone)
                );
            } catch (VoucherException exception) {
                // TrueMoney sometimes answers 400 without a conclusive redemption result.
                // Retry exactly once: credit is still issued only after an explicit SUCCESS.
                if (attempt == 1 && "UPSTREAM_HTTP_400".equals(exception.code())) {
                    continue;
                }
                break;
            }
        }

        // Both requests failed to provide SUCCESS. The voucher may already have been
        // consumed, so do not keep retrying and do not credit the wallet automatically.
        throw new VoucherException(
                "REDEMPTION_OUTCOME_UNKNOWN",
                "TrueMoney may have accepted this voucher, but the result could not be confirmed"
        );
    }

    private JsonNode request(HttpMethod method, String url, Object body) {
        try {
            RestClient.RequestBodySpec request = restClient.method(method)
                    .uri(url)
                    .headers(headers -> {
                        headers.set("User-Agent", userAgent);
                        headers.setAccept(ACCEPT);
                    });
            RestClient.RequestHeadersSpec<?> prepared = body == null
                    ? request
                    : request.contentType(MediaType.APPLICATION_JSON).body(body);
            return prepared.exchange((ignored, response) -> {
                int status = response.getStatusCode().value();
                if (!response.getStatusCode().is2xxSuccessful()) {
                    if (status == 429) {
                        throw new VoucherException("UPSTREAM_RATE_LIMIT", "TrueMoney rate limit reached");
                    }
                    throw new VoucherException("UPSTREAM_HTTP_" + status, "TrueMoney request failed");
                }
                byte[] content = response.getBody().readAllBytes();
                JsonNode json = content.length == 0
                        ? objectMapper.createObjectNode()
                        : objectMapper.readTree(content);
                if (!"SUCCESS".equals(json.path("status").path("code").asString(""))) {
                    throw new VoucherException("VOUCHER_INVALID", "TrueMoney rejected the voucher");
                }
                return json;
            });
        } catch (ResourceAccessException exception) {
            throw new VoucherException("UPSTREAM_TIMEOUT", "TrueMoney request timed out");
        }
    }

    private static String voucherCode(String giftUrl) {
        String value = UriComponentsBuilder.fromUriString(giftUrl)
                .build().getQueryParams().getFirst("v");
        if (value == null || value.isBlank()) {
            throw new VoucherException("BAD_GIFT_URL", "Voucher code is missing");
        }
        return value;
    }

    private static String text(JsonNode value) {
        return value != null && value.isTextual() && !value.asString().isBlank()
                ? value.asString()
                : null;
    }

    record Outcome(BigDecimal amountBaht, String issuer, String reference) {
    }
}
