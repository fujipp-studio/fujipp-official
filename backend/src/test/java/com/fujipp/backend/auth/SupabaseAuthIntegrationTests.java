package com.fujipp.backend.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "SUPABASE_INTEGRATION_TESTS", matches = "true")
class SupabaseAuthIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Test
    void signupCreatesApplicationAccountAndTokenCanCallBackend() throws Exception {
        String supabaseUrl = System.getenv().getOrDefault(
                "SUPABASE_URL",
                "http://127.0.0.1:54321"
        );
        String anonKey = System.getenv("SUPABASE_ANON_KEY");
        assertThat(anonKey)
                .as("SUPABASE_ANON_KEY must be exported for integration tests")
                .isNotBlank();

        String email = "backend-it-" + UUID.randomUUID() + "@example.com";
        String password = "Integration-test-password-123!";
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password,
                "gotrue_meta_security", Map.of(
                        "captcha_token", "XXXX.DUMMY.TOKEN.XXXX"
                )
        ));
        HttpRequest signupRequest = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/auth/v1/signup"))
                .header("apikey", anonKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> signupResponse = httpClient.send(
                signupRequest,
                HttpResponse.BodyHandlers.ofString()
        );
        assertThat(signupResponse.statusCode()).isBetween(200, 299);

        JsonNode signup = objectMapper.readTree(signupResponse.body());
        UUID userId = UUID.fromString(signup.path("user").path("id").asText());

        try {
            jdbcTemplate.update(
                    "UPDATE auth.users SET email_confirmed_at = now() WHERE id = ?",
                    userId
            );

            String tokenRequestBody = objectMapper.writeValueAsString(Map.of(
                    "email", email,
                    "password", password,
                    "gotrue_meta_security", Map.of(
                            "captcha_token", "XXXX.DUMMY.TOKEN.XXXX"
                    )
            ));
            HttpRequest tokenRequest = HttpRequest.newBuilder()
                    .uri(URI.create(supabaseUrl + "/auth/v1/token?grant_type=password"))
                    .header("apikey", anonKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(tokenRequestBody))
                    .build();
            HttpResponse<String> tokenResponse = httpClient.send(
                    tokenRequest,
                    HttpResponse.BodyHandlers.ofString()
            );
            assertThat(tokenResponse.statusCode()).isBetween(200, 299);
            String accessToken = objectMapper.readTree(tokenResponse.body())
                    .path("access_token")
                    .asText();

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + accessToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(userId.toString()))
                    .andExpect(jsonPath("$.email").value(email))
                    .andExpect(jsonPath("$.role").value("USER"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"));
        } finally {
            jdbcTemplate.update("DELETE FROM auth.users WHERE id = ?", userId);
        }
    }
}
