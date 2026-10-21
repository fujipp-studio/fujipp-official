package com.fujipp.backend.auth;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthIdentityProjectionTests {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private Jwt token(String subject, Map<String,Object> metadata) {
        return Jwt.withTokenValue("verified-by-security-filter")
                .header("alg", "ES256").subject(subject).issuedAt(Instant.parse("2026-10-21T00:00:00Z"))
                .claim("email", "user@example.com").claim("user_metadata", metadata).build();
    }
    @Test void managedSupabaseModeDoesNotWriteIdentityRows() {
        new AuthIdentityProjection(jdbc, mapper, false).ensureIdentity(token("not-a-uuid", Map.of()));
        verifyNoInteractions(jdbc);
    }
    @Test void rejectsMalformedIdentityBeforeWriting() {
        assertThrows(InvalidTokenSubjectException.class, () -> new AuthIdentityProjection(jdbc, mapper, true)
                .ensureIdentity(token("invalid", Map.of())));
        verifyNoInteractions(jdbc);
    }
    @Test void projectsDisplayFieldsWithoutRolesPasswordsOrProviders() {
        var projection = new AuthIdentityProjection(jdbc, mapper, true);
        projection.ensureIdentity(token("00000000-0000-0000-0000-000000000001",
                Map.of("display_name", "New user", "role", "ADMIN", "status", "ACTIVE",
                        "password", "never-copy", "provider", "never-copy", "picture", "x".repeat(2049))));
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO auth.users"), any(), eq("user@example.com"), json.capture(), any());
        assertEquals(Map.of("display_name", "New user"), mapper.readValue(json.getValue(), Map.class));
    }
}
