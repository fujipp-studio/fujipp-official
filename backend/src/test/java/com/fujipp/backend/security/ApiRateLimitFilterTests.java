package com.fujipp.backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ApiRateLimitFilterTests {

    private final Instant now = Instant.parse("2026-07-29T00:00:00Z");
    private final SecurityAuditService securityAuditService = mock(SecurityAuditService.class);
    private final ApiRateLimitFilter filter = new ApiRateLimitFilter(
            new ObjectMapper(),
            securityAuditService,
            2,
            1,
            Clock.fixed(now, ZoneOffset.UTC)
    );

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void allowsRequestsWithinUserLimit() throws Exception {
        authenticate(UUID.randomUUID());
        MockHttpServletResponse response = perform("GET");

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("2");
        assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("1");
    }

    @Test
    void blocksUserAfterWriteLimitIsReached() throws Exception {
        authenticate(UUID.randomUUID());

        assertThat(perform("PUT").getStatus()).isEqualTo(200);
        MockHttpServletResponse blocked = perform("PUT");

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blocked.getContentAsString()).contains("\"title\":\"Rate limit exceeded\"");
    }

    @Test
    void keepsLimitsSeparateBetweenUsers() throws Exception {
        authenticate(UUID.randomUUID());
        assertThat(perform("PUT").getStatus()).isEqualTo(200);
        assertThat(perform("PUT").getStatus()).isEqualTo(429);

        authenticate(UUID.randomUUID());

        assertThat(perform("PUT").getStatus()).isEqualTo(200);
    }

    private MockHttpServletResponse perform(String method) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, "/api/v1/auth/me/profile");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private void authenticate(UUID userId) {
        Instant issuedAt = now.minusSeconds(60);
        Jwt jwt = new Jwt(
                "token",
                issuedAt,
                now.plusSeconds(300),
                Map.of("alg", "ES256"),
                Map.of("sub", userId.toString())
        );
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of())
        );
    }
}
