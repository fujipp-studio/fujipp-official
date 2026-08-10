package com.fujipp.backend.store;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@Component
class DiscordBotProfileClient {

    private final RestClient http = RestClient.builder()
            .baseUrl("https://discord.com/api/v10")
            .build();

    Profile fetch(String token) {
        JsonNode user = http.get()
                .uri("/users/@me")
                .header("Authorization", "Bot " + token)
                .retrieve()
                .body(JsonNode.class);
        if (user == null || user.path("id").asString("").isBlank()) {
            throw new StoreValidationException("Discord returned an invalid bot profile");
        }
        String id = user.path("id").asString();
        String username = user.path("global_name").asString("");
        if (username.isBlank()) username = user.path("username").asString("Discord Bot");
        String avatar = user.path("avatar").asString("");
        String avatarUrl = avatar.isBlank()
                ? null
                : "https://cdn.discordapp.com/avatars/" + id + "/" + avatar + ".png?size=256";
        return new Profile(username, avatarUrl);
    }

    record Profile(String username, String avatarUrl) {}
}
