package com.fujipp.backend.voucher;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class TrueMoneyVoucherAdapterTests {
    private final ObjectMapper json=new ObjectMapper();
    private final RestClient.Builder builder=RestClient.builder();
    private final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
    private final TrueMoneyVoucherAdapter adapter=new TrueMoneyVoucherAdapter(json,builder.build());
    private static final String GIFT="https://gift.truemoney.com/campaign/?v=syntheticVoucher";
    private static final String BASE="https://gift.truemoney.com/campaign/vouchers/syntheticVoucher";
    private String response(String amount,int member) {
        return "{\"status\":{\"code\":\"SUCCESS\"},\"data\":{\"voucher\":{\"status\":\"active\",\"member\":"+member+
                ",\"amount_baht\":\""+amount+"\",\"voucher_id\":\"synthetic-id\"}}}";
    }
    private void verifyGift(String amount,int member) {
        server.expect(requestTo(BASE+"/verify?mobile=0812345678")).andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(response(amount,member),MediaType.APPLICATION_JSON));
    }
    @Test void exactAmountsSupportGroupedThousandsWithoutFloatingPoint() {
        for(String value:new String[]{"2000","2000.00","2,000.00","2,000.0"})
            assertThat(TrueMoneyVoucherAdapter.amountSatang(json.valueToTree(value))).isEqualTo(200000);
        for(String value:new String[]{"2,00.00","-1","0","1.001","1e3","NaN","9,007,199,254,740,992.00","2 000","", "1,0000"})
            assertThatThrownBy(()->TrueMoneyVoucherAdapter.amountSatang(json.valueToTree(value))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void walletRejectsMultipleRecipientsAndExcessFeeBeforeReceiving() {
        verifyGift("2,000.00",2);
        assertThatThrownBy(()->adapter.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500)))
                .isInstanceOf(VoucherException.class).hasMessageContaining("1 คน");
        server.verify(); server.reset();
        verifyGift("5.00",1);
        assertThatThrownBy(()->adapter.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500)))
                .isInstanceOf(VoucherException.class).hasMessageContaining("ค่าธรรมเนียม");
        server.verify();
    }
    @Test void ambiguous400SendsOnlyOneIrreversiblePost() {
        verifyGift("2,000.00",1);
        server.expect(requestTo(BASE+"/redeem")).andExpect(method(HttpMethod.POST)).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(()->adapter.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500)))
                .isInstanceOfSatisfying(VoucherException.class,e->assertThat(e.reconciliationRequired()).isTrue());
        server.verify();
    }
    @Test void acceptedButMalformedAmountRequiresReviewInsteadOfRetry() {
        verifyGift("2,000.00",1);
        server.expect(requestTo(BASE+"/redeem")).andRespond(withSuccess(response("not-an-amount",1),MediaType.APPLICATION_JSON));
        assertThatThrownBy(()->adapter.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500)))
                .isInstanceOfSatisfying(VoucherException.class,e->{
                    assertThat(e.reconciliationRequired()).isTrue();
                    assertThat(json.readTree(e.evidence()).path("status").asString()).isEqualTo("SUCCESS");
                    assertThat(e.evidence()).doesNotContain("syntheticVoucher","0812345678");
                });
        server.verify();
    }
    @Test void validSingleRecipientReceiptReturnsExactGrossAndStableReference() {
        verifyGift("2,000.00",1);
        server.expect(requestTo(BASE+"/redeem")).andRespond(withSuccess(response("2000.00",1),MediaType.APPLICATION_JSON));
        var result=adapter.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500));
        assertThat(result.amountBaht()).isEqualByComparingTo("2000.00");
        assertThat(result.reference()).isEqualTo("synthetic-id"); server.verify();
        assertThat(new VoucherFee("PERCENT",3).net(101)).isEqualTo(98);
    }
    @Test void realHttpTransportDoesNotReplayPostAfterAConnectionDrops() throws Exception {
        var upstream=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        var posts=new java.util.concurrent.atomic.AtomicInteger();
        upstream.createContext("/",exchange->{
            if (exchange.getRequestMethod().equals("POST")) {
                exchange.getRequestBody().readAllBytes(); posts.incrementAndGet();
                exchange.close(); // Server accepted the body, then lost the response.
            } else {
                byte[] bytes=response("2000.00",1).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(200,bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
            }
        });
        upstream.start();
        try {
            var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(java.time.Duration.ofSeconds(2)); factory.setReadTimeout(java.time.Duration.ofSeconds(2));
            var client=RestClient.builder().requestFactory(factory).requestInterceptor((request,body,execution)->
                execution.execute(new org.springframework.http.client.support.HttpRequestWrapper(request) {
                    @Override public java.net.URI getURI() {
                        return java.net.URI.create("http://127.0.0.1:"+upstream.getAddress().getPort()+request.getURI().getRawPath());
                    }
                },body)).build();
            var real=new TrueMoneyVoucherAdapter(json,client);
            assertThatThrownBy(()->real.redeemWallet("0812345678",GIFT,new VoucherFee("FIXED",500)))
                .isInstanceOfSatisfying(VoucherException.class,e->assertThat(e.reconciliationRequired()).isTrue());
            assertThat(posts.get()).isEqualTo(1);
        } finally { upstream.stop(0); }
    }

    @Test void rejectsHostAndCodeTricksBeforeAnyHttpRequest() {
        for(String url:new String[]{"https://gift.truemoney.com.evil/campaign/?v=a","https://gift.truemoney.com/campaign/?v=a&v=b",
                "http://gift.truemoney.com/campaign/?v=a","https://gift.truemoney.com/campaign/?v=../a"})
            assertThatThrownBy(()->adapter.redeem("0812345678",url)).isInstanceOf(VoucherException.class);
        assertThat(VoucherService.canonicalGiftUrl("https://gift.truemoney.com/campaign?v=AbC"))
                .isEqualTo("https://gift.truemoney.com/campaign/?v=AbC"); server.verify();
    }
}
