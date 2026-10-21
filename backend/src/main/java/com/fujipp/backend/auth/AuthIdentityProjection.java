package com.fujipp.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Mirrors identity/display fields from an already verified Supabase JWT.
 * This is never an authentication store and must never project roles or status.
 */
@Service
public class AuthIdentityProjection {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final boolean enabled;

    public AuthIdentityProjection(JdbcTemplate jdbc, ObjectMapper mapper,
            @Value("${app.auth.identity-projection-enabled:false}") boolean enabled) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.enabled = enabled;
    }

    @Transactional
    public void ensureIdentity(Jwt verifiedToken) {
        if (!enabled) return;
        UUID id;
        try {
            id = UUID.fromString(verifiedToken.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new InvalidTokenSubjectException();
        }
        Map<String, Object> metadata = verifiedToken.getClaimAsMap("user_metadata");
        Map<String, String> displayFields = new LinkedHashMap<>();
        if (metadata != null) {
            for (String key : new String[]{"display_name", "full_name", "name", "first_name", "last_name", "avatar_url", "picture"}) {
                Object value = metadata.get(key);
                if (value instanceof String text && text.length() <= 2048) displayFields.put(key, text);
            }
        }
        // The existing INSERT trigger provisions a profile and a USER account.
        // Conflict updates never modify an existing profile, role, or status.
        // Older still-valid JWTs cannot overwrite a newer cached email.
        jdbc.update("""
                INSERT INTO auth.users(id, email, raw_user_meta_data, projected_token_issued_at)
                VALUES (?, ?, ?::jsonb, ?)
                ON CONFLICT (id) DO UPDATE
                   SET email = EXCLUDED.email,
                       projected_token_issued_at = EXCLUDED.projected_token_issued_at
                 WHERE (auth.users.projected_token_issued_at IS NULL
                        OR auth.users.projected_token_issued_at < EXCLUDED.projected_token_issued_at)
                """, id, verifiedToken.getClaimAsString("email"), mapper.writeValueAsString(displayFields),
                verifiedToken.getIssuedAt() == null ? null : java.time.OffsetDateTime.ofInstant(
                        verifiedToken.getIssuedAt(), java.time.ZoneOffset.UTC));
    }
}
