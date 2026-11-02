package com.fujipp.backend.store;

import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;

/** Metadata only; never sends messages or performs customer operations. */
@Component
class FeatureDiscordClient {
    private final RestClient http;
    FeatureDiscordClient() {
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        http=RestClient.builder().baseUrl("https://discord.com/api/v10").requestFactory(factory).build();
    }
    JsonNode get(String token,String path) {
        try {
            var value=http.get().uri(path).header("Authorization","Bot "+token).retrieve().body(JsonNode.class);
            if (value==null) throw new StoreValidationException("Discord returned no permission metadata");
            return value;
        } catch (RestClientResponseException error) {
            int status=error.getStatusCode().value();
            if (status==429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Discord จำกัดคำขอ กรุณารอแล้วลองใหม่");
            if (status==401) throw new StoreValidationException("Discord token ใช้งานไม่ได้ กรุณาแก้ในตั้งค่าบอท");
            if (status==403 || status==404) throw new StoreValidationException("บอทเข้าถึงเซิร์ฟเวอร์หรือห้องไม่ได้ ตรวจสอบสิทธิ์และ Channel ID");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Discord ไม่พร้อมให้ตรวจสิทธิ์ กรุณาลองภายหลัง");
        } catch (RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"เชื่อมต่อ Discord เพื่อตรวจสิทธิ์ไม่ได้ กรุณาลองภายหลัง");
        }
    }
}
