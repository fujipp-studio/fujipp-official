package com.fujipp.backend.store;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;

@Component
class DiscordTicketClient {
    private final RestClient http;
    DiscordTicketClient() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        http = RestClient.builder().baseUrl("https://discord.com/api/v10").requestFactory(factory).build();
    }
    JsonNode channels(String token, String guild) { return get(token, "/guilds/" + guild + "/channels"); }
    JsonNode channel(String token, String channel) { return get(token, "/channels/" + channel); }
    JsonNode messages(String token, String channel, String before, int limit) {
        return get(token, "/channels/" + channel + "/messages?limit=" + limit + (before == null ? "" : "&before=" + before));
    }
    private JsonNode get(String token, String path) {
        try {
            JsonNode result = http.get().uri(path).header("Authorization", "Bot " + token).retrieve().body(JsonNode.class);
            if (result == null) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Discord returned an empty response");
            return result;
        } catch (RestClientResponseException error) {
            int status = error.getStatusCode().value();
            if (status == 429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Discord จำกัดคำขอชั่วคราว กรุณารอสักครู่แล้วลองใหม่");
            if (status == 404) throw new StoreNotFoundException("ไม่พบห้อง Ticket บน Discord ห้องอาจถูกลบแล้ว");
            if (status == 401 || status == 403) throw new StoreValidationException("บอทเข้าถึงประวัติไม่ได้ ตรวจสอบ Token และสิทธิ์ View Channel / Read Message History");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "ไม่สามารถอ่านประวัติจาก Discord ได้");
        } catch (org.springframework.web.client.RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "เชื่อมต่อ Discord ไม่สำเร็จ กรุณาลองใหม่");
        }
    }
}
