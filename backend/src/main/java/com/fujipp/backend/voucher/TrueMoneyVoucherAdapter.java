package com.fujipp.backend.voucher;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
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

    TrueMoneyVoucherAdapter(ObjectMapper objectMapper, RestClient restClient) {
        this.objectMapper = objectMapper;
        this.restClient = restClient;
        this.userAgent = "voucher-test";
    }

    Outcome redeem(String phone, String giftUrl) {
        return redeem(phone, giftUrl, null, null);
    }

    Outcome redeemPayment(String phone, String giftUrl, long expectedAmountSatang) {
        return redeem(phone, giftUrl, expectedAmountSatang, null);
    }

    Outcome redeemWallet(String phone, String giftUrl, VoucherFee fee) {
        return redeem(phone, giftUrl, null, fee);
    }

    private Outcome redeem(String phone, String giftUrl, Long expectedAmountSatang, VoucherFee fee) {
        String voucherCode = voucherCode(giftUrl);
        JsonNode verification = request(
                HttpMethod.GET,
                BASE_URL + "/" + voucherCode + "/verify?mobile=" + phone,
                null
        );
        if (!"active".equals(verification.path("data").path("voucher").path("status").asString(""))) {
            throw new VoucherException("VOUCHER_INVALID", "Voucher is not active");
        }
        JsonNode verifiedVoucher = verification.path("data").path("voucher");
        long verifiedAmount;
        try {
            validateSingleRecipient(verifiedVoucher);
            verifiedAmount = amountSatang(verifiedVoucher.path("amount_baht"));
            if (expectedAmountSatang != null) validatePaymentVoucher(verifiedVoucher, expectedAmountSatang);
            if (fee != null) fee.net(verifiedAmount);
        } catch (IllegalArgumentException error) {
            throw new VoucherException("VOUCHER_INVALID", "ไม่สามารถตรวจสอบยอดซองได้ ยังไม่ได้รับเงินจากซอง");
        }

        String evidence = null;
        try {
            // A POST timeout/400 is not evidence that the irreversible operation failed.
            // Send exactly once and preserve uncertainty instead of receiving again.
            JsonNode redeemed = request(HttpMethod.POST, BASE_URL + "/" + voucherCode + "/redeem", Map.of("mobile", phone));
            JsonNode voucher = redeemed.path("data").path("voucher");
            JsonNode amount = voucher.has("redeemed_amount_baht")
                    ? voucher.get("redeemed_amount_baht") : voucher.path("amount_baht");
            String issuer = text(redeemed.path("data").path("owner_profile").path("full_name"));
            String reference = text(voucher.path("voucher_id"));
            // Retain only bounded receipt fields. Never persist a full response,
            // gift code, owner profile, mobile number or ticket history.
            evidence = objectMapper.writeValueAsString(Map.of("status", "SUCCESS",
                    "amountBaht", bounded(amount.asString("").replaceAll("[^0-9.,+Ee -]", "?"), 40),
                    "voucherId", bounded(reference == null ? "" : reference, 255)));
            long received = amountSatang(amount);
            if (reference == null || reference.length() > 255 || received != verifiedAmount
                    || (text(verifiedVoucher.path("voucher_id")) != null
                        && !reference.equals(text(verifiedVoucher.path("voucher_id"))))) {
                throw new VoucherException("REDEMPTION_OUTCOME_UNKNOWN", "ผลรับซองไม่ตรงกับข้อมูลที่ตรวจสอบ กรุณาอย่าส่งซ้ำและติดต่อผู้ดูแล", true);
            }
            return new Outcome(BigDecimal.valueOf(received, 2), issuer == null ? null : bounded(issuer,255), reference, evidence);
        } catch (VoucherException error) {
            throw new VoucherException(error.code(), "รายการรับซองอยู่ระหว่างตรวจสอบ กรุณาอย่าส่งซ้ำและติดต่อผู้ดูแล", true, evidence);
        } catch (RuntimeException error) {
            throw new VoucherException("REDEMPTION_OUTCOME_UNKNOWN", "ผลรับซองยังยืนยันไม่ได้ กรุณาอย่าส่งซ้ำและติดต่อผู้ดูแล", true, evidence);
        }
    }

    static void validatePaymentVoucher(JsonNode voucher, long expectedAmountSatang) {
        validateSingleRecipient(voucher);
        try {
            long amount = amountSatang(voucher.path("amount_baht"));
            if (amount != expectedAmountSatang) {
                throw new VoucherException("VOUCHER_AMOUNT_MISMATCH", "ยอดซองอั่งเปาต้องตรงกับยอดรายการ โดยไม่มีค่าธรรมเนียมเพิ่มเติม");
            }
        } catch (IllegalArgumentException error) {
            throw new VoucherException("VOUCHER_INVALID", "ไม่สามารถตรวจสอบยอดซองอั่งเปาได้ ยังไม่ได้รับเงินจากซอง");
        }
    }

    private static void validateSingleRecipient(JsonNode voucher) {
        if (!"1".equals(voucher.path("member").asString(""))) {
            throw new VoucherException("VOUCHER_NOT_SINGLE_RECIPIENT", "กรุณาสร้างซองอั่งเปาสำหรับผู้รับ 1 คนเท่านั้น");
        }
    }

    static long amountSatang(JsonNode value) {
        String amount = value == null ? "" : value.asString("").strip();
        if (amount.length() > 40 || !amount.matches("(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\\.[0-9]{1,2})?")) {
            throw new IllegalArgumentException("Unsupported TrueMoney amount format");
        }
        try {
            long satang = new BigDecimal(amount.replace(",", "")).movePointRight(2).longValueExact();
            if (satang <= 0 || satang > 9_007_199_254_740_991L) throw new IllegalArgumentException("Amount out of range");
            return satang;
        } catch (ArithmeticException error) {
            throw new IllegalArgumentException("Amount out of range");
        }
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
                byte[] content = response.getBody().readNBytes(65_537);
                if (content.length > 65_536) throw new VoucherException("UPSTREAM_INVALID_RESPONSE", "TrueMoney response is too large");
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
        String canonical = VoucherService.canonicalGiftUrl(giftUrl);
        return canonical.substring(canonical.indexOf("?v=") + 3);
    }

    private static String text(JsonNode value) {
        return value != null && value.isTextual() && !value.asString().isBlank()
                ? value.asString()
                : null;
    }

    private static String bounded(String value, int max) { return value.length() <= max ? value : value.substring(0,max); }

    record Outcome(BigDecimal amountBaht, String issuer, String reference, String evidence) {
        Outcome(BigDecimal amountBaht, String issuer, String reference) { this(amountBaht, issuer, reference, null); }
    }
}
