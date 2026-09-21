package com.fujipp.backend.wallet;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class SlipOkAdapterTests {
    private MockRestServiceServer server;
    private SlipOkAdapter adapter;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder=RestClient.builder().baseUrl("https://slipok.test");
        server=MockRestServiceServer.bindTo(builder).build();
        adapter=new SlipOkAdapter(new ObjectMapper(),builder.build());
    }

    @Test
    void convertsNonJsonUpstreamResponseToServiceError() {
        server.expect(once(),requestTo("https://slipok.test/api/line/apikey/branch-1"))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("error code: upstream unavailable"));

        WalletException exception=assertThrows(WalletException.class,
                () -> adapter.verify("branch-1","api-key","https://cdn.discordapp.com/attachments/slip.png",5000));

        assertEquals("SLIPOK_UNAVAILABLE",exception.code());
        assertEquals("ระบบตรวจสลิปขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง",exception.getMessage());
        server.verify();
    }

    @Test
    void preservesStructuredSlipOkFailureCode() {
        server.expect(once(),requestTo("https://slipok.test/api/line/apikey/branch-1"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"success\":false,\"code\":1013}"));

        WalletException exception=assertThrows(WalletException.class,
                () -> adapter.verify("branch-1","api-key","https://cdn.discordapp.com/attachments/slip.png",5000));

        assertEquals("SLIPOK_1013",exception.code());
        assertEquals("ยอดเงินในสลิปไม่ตรงกับรายการ",exception.getMessage());
        server.verify();
    }
}
