package com.fujipp.backend.auth;

import com.fujipp.backend.security.AuditOutcome;
import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.security.SecurityEventType;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Short-lived capabilities for the single Backend instance. Restart revokes all sessions. */
@Service
public class ImpersonationService {
    public static final String HEADER = "X-Impersonation-Token";
    public static final String PATH = "/api/v1/admin/impersonations";
    private static final Duration LIFETIME = Duration.ofMinutes(15);
    private static final int MAX_SESSIONS = 1000;
    private final Map<UUID, ActiveSession> sessions = new HashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final CurrentUserService users;
    private final JdbcTemplate jdbc;
    private final SecurityAuditService audit;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public ImpersonationService(CurrentUserService users, JdbcTemplate jdbc, SecurityAuditService audit) {
        this(users, jdbc, audit, Clock.systemUTC());
    }

    ImpersonationService(CurrentUserService users, JdbcTemplate jdbc, SecurityAuditService audit, Clock clock) {
        this.users = users;
        this.jdbc = jdbc;
        this.audit = audit;
        this.clock = clock;
    }

    public synchronized Started start(Jwt actor, UUID targetId, HttpServletRequest request) {
        var admin = requireAdmin(actor);
        var target = users.getActiveAccount(targetId.toString());
        if (target.id().equals(admin.id()) || target.role() == AppRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot impersonate an administrator");
        }
        Instant now = clock.instant();
        sessions.values().removeIf(value -> !value.expiresAt().isAfter(now));
        if (sessions.size() >= MAX_SESSIONS && !sessions.containsKey(admin.id())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Too many impersonation sessions");
        }
        var emails = jdbc.query("SELECT email FROM auth.users WHERE id = ?",
                (rs, row) -> rs.getString("email"), target.id());
        String email = emails.isEmpty() ? null : emails.getFirst();
        Instant expiresAt = now.plus(LIFETIME);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Jwt effective = effectiveJwt(actor, target.id(), email);
        CurrentUser user = users.getActiveUser(effective);
        audit.recordRequired(SecurityEventType.IMPERSONATION_STARTED, AuditOutcome.SUCCESS,
                admin.id(), target.id(), request.getRemoteAddr(), request.getHeader("User-Agent"),
                Map.of("expiresAt", expiresAt.toString()));
        sessions.put(admin.id(), new ActiveSession(digest(token), target.id(), email, expiresAt));
        return new Started(token, expiresAt, user);
    }

    public synchronized Jwt resolve(Jwt actor, String token) {
        var admin = requireAdmin(actor);
        ActiveSession active = sessions.get(admin.id());
        if (active == null || !active.expiresAt().isAfter(clock.instant())
                || token == null || token.length() != 43
                || !MessageDigest.isEqual(active.digest(), digest(token))) {
            throw new EndedException();
        }
        var target = users.getActiveAccount(active.targetId().toString());
        if (target.role() == AppRole.ADMIN) throw new EndedException();
        return effectiveJwt(actor, target.id(), active.email());
    }

    public synchronized void stop(Jwt actor, String token, HttpServletRequest request) {
        var admin = requireAdmin(actor);
        ActiveSession active = sessions.get(admin.id());
        // Idempotent, including after a restart, expiration or replacement in another tab.
        if (active == null || token == null || token.length() != 43
                || !MessageDigest.isEqual(active.digest(), digest(token))) return;
        audit.recordRequired(SecurityEventType.IMPERSONATION_STOPPED, AuditOutcome.SUCCESS,
                admin.id(), active.targetId(), request.getRemoteAddr(), request.getHeader("User-Agent"), Map.of());
        sessions.remove(admin.id());
    }

    private CurrentUserRepository.AccountProfile requireAdmin(Jwt actor) {
        var admin = users.getActiveAccount(actor.getSubject());
        if (admin.role() != AppRole.ADMIN) throw new EndedException();
        return admin;
    }

    static Jwt effectiveJwt(Jwt original, UUID targetId, String email) {
        // Keep only the verified token's validity and issuer. Never forward the actor's
        // email, metadata, roles or scopes into the effective user's identity.
        var claims = new HashMap<String, Object>();
        claims.put("sub", targetId.toString());
        for (String key : List.of("iss", "aud", "iat", "exp", "nbf")) {
            if (original.hasClaim(key)) claims.put(key, original.getClaim(key));
        }
        if (email != null) claims.put("email", email);
        return new Jwt(original.getTokenValue(), original.getIssuedAt(), original.getExpiresAt(),
                original.getHeaders(), claims);
    }

    private byte[] digest(String token) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record ActiveSession(byte[] digest, UUID targetId, String email, Instant expiresAt) {}
    public record Started(String token, Instant expiresAt, CurrentUser user) {}
    public static class EndedException extends RuntimeException {}
}
