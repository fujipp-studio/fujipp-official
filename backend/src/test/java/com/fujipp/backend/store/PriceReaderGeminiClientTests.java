package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class PriceReaderGeminiClientTests {
    private final ObjectMapper json=new ObjectMapper();
    private final RestClient.Builder builder=RestClient.builder();
    private final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
    private final PriceReaderGeminiClient client=new PriceReaderGeminiClient(json,builder.build());
    private static final String KEY="AQ.synthetic-gemini.key-for-tests";
    private static final String VALUE="""
        {"itemName":"Test item","currency":"THB","standardPriceSatang":25000,"originalPriceSatang":null,
         "nitroPriceSatang":20900,"discountPercent":null,"ambiguous":false}
        """;
    private String response(String value) {
        return "{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[{\"text\":"+json.writeValueAsString(value)+"}]}}]}";
    }
    @Test void connectionProbeUsesSelectedModelAndNeverReturnsCredentials() {
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"))
            .andExpect(header("x-goog-api-key",KEY)).andExpect(jsonPath("$.generationConfig.responseMimeType").value("application/json"))
            .andRespond(withSuccess(response(VALUE),MediaType.APPLICATION_JSON));
        var result=client.test(KEY,PriceReaderGeminiClient.DEFAULT_MODEL,null,null);
        assertThat(result.connected()).isTrue(); assertThat(result.result()).isNull();
        assertThat(json.writeValueAsString(result)).doesNotContain(KEY);
        server.verify();
    }
    @Test void imageRehearsalReturnsStructuredPrices() {
        server.expect(anything()).andExpect(jsonPath("$.contents[0].parts[0].inlineData.data").value("dGVzdA=="))
            .andRespond(withSuccess(response(VALUE),MediaType.APPLICATION_JSON));
        var result=client.test(KEY,PriceReaderGeminiClient.DEFAULT_MODEL,"dGVzdA==","image/png");
        assertThat(result.connected()).isTrue();
        assertThat(result.result().path("standardPriceSatang").asInt()).isEqualTo(25000);
        server.verify();
    }
    @Test void providerErrorsAreSanitizedAndNotRetried() {
        for (var status: new HttpStatus[]{HttpStatus.FORBIDDEN,HttpStatus.NOT_FOUND,HttpStatus.TOO_MANY_REQUESTS,HttpStatus.SERVICE_UNAVAILABLE}) {
            server.expect(anything()).andRespond(withStatus(status).body(KEY));
            var result=client.test(KEY,PriceReaderGeminiClient.DEFAULT_MODEL,null,null);
            assertThat(result.connected()).isFalse(); assertThat(result.result()).isNull();
            assertThat(result.errorCode()).isEqualTo(switch(status) {
                case FORBIDDEN -> "GEMINI_KEY_INVALID"; case NOT_FOUND -> "GEMINI_MODEL_UNAVAILABLE";
                case TOO_MANY_REQUESTS -> "GEMINI_QUOTA_EXCEEDED"; default -> "GEMINI_UNAVAILABLE";
            });
            assertThat(json.writeValueAsString(result)).doesNotContain(KEY);
            server.verify(); server.reset();
        }
    }
    @Test void invalidOrIncompleteOutputNeverBecomesAPrice() {
        for (String value: new String[]{"{}",VALUE.replace("25000","-1"),VALUE.replace("25000","250.5"),VALUE.replace("THB","USD")}) {
            assertThat(PriceReaderGeminiClient.validResult(json.readTree(value))).isFalse();
        }
        server.expect(anything()).andRespond(withSuccess(response("{}"),MediaType.APPLICATION_JSON));
        assertThat(client.test(KEY,PriceReaderGeminiClient.DEFAULT_MODEL,null,null).errorCode()).isEqualTo("GEMINI_INVALID_RESPONSE");
        server.verify();
    }
}
