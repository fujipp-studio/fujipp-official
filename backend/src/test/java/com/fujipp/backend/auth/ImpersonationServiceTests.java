package com.fujipp.backend.auth;

import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.security.SecurityEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ImpersonationServiceTests {
    private final CurrentUserService users = mock(CurrentUserService.class);
    private final SecurityAuditService audit = mock(SecurityAuditService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final Clock clock = mock(Clock.class);
    private final UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), other = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-11-01T00:00:00Z");
    private final ImpersonationService service = new ImpersonationService(users, jdbc, audit, clock);
    private final MockHttpServletRequest request = new MockHttpServletRequest();

    @BeforeEach
    void setup() {
        when(clock.instant()).thenReturn(now);
        when(users.getActiveAccount(actor.toString())).thenReturn(account(actor, AppRole.ADMIN));
        when(users.getActiveAccount(target.toString())).thenReturn(account(target, AppRole.USER));
        when(users.getActiveAccount(other.toString())).thenReturn(account(other, AppRole.ADMIN));
    }

    @Test
    void requiresActiveAdminAndRejectsAdminTargets() {
        when(users.getActiveAccount(actor.toString())).thenReturn(account(actor, AppRole.USER));
        assertThatThrownBy(() -> service.start(jwt(actor), target, request))
                .isInstanceOf(ImpersonationService.EndedException.class);
        when(users.getActiveAccount(actor.toString())).thenReturn(account(actor, AppRole.ADMIN));
        assertThatThrownBy(() -> service.start(jwt(actor), other, request)).hasMessageContaining("administrator");
        assertThatThrownBy(() -> service.start(jwt(actor), actor, request)).hasMessageContaining("administrator");
    }

    @Test
    void capabilityIsBoundToActorAndNeverCarriesTheirEmailOrMetadata() {
        var started = service.start(jwt(actor), target, request);
        assertThat(started.expiresAt()).isEqualTo(now.plusSeconds(900));
        Jwt effective = service.resolve(jwt(actor), started.token());
        assertThat(effective.getSubject()).isEqualTo(target.toString());
        assertThat(effective.getClaims()).doesNotContainKeys("email", "user_metadata", "role", "scope");
        assertThatThrownBy(() -> service.resolve(jwt(other), started.token()))
                .isInstanceOf(ImpersonationService.EndedException.class);
        assertThatThrownBy(() -> service.resolve(jwt(actor), "x".repeat(43)))
                .isInstanceOf(ImpersonationService.EndedException.class);
    }

    @Test
    void expiresRevokesAndReplacesSessions() {
        var first = service.start(jwt(actor), target, request);
        var second = service.start(jwt(actor), target, request);
        assertThatThrownBy(() -> service.resolve(jwt(actor), first.token()))
                .isInstanceOf(ImpersonationService.EndedException.class);
        service.stop(jwt(actor), first.token(), request); // An old tab cannot revoke the new session.
        assertThat(service.resolve(jwt(actor), second.token()).getSubject()).isEqualTo(target.toString());
        when(clock.instant()).thenReturn(now.plusSeconds(900));
        assertThatThrownBy(() -> service.resolve(jwt(actor), second.token()))
                .isInstanceOf(ImpersonationService.EndedException.class);
        when(clock.instant()).thenReturn(now);
        service.stop(jwt(actor), second.token(), request);
        assertThatThrownBy(() -> service.resolve(jwt(actor), second.token()))
                .isInstanceOf(ImpersonationService.EndedException.class);
    }

    @Test
    void checksLiveActorAndTargetPermissionsOnEveryRequest() {
        var started = service.start(jwt(actor), target, request);
        when(users.getActiveAccount(target.toString())).thenThrow(new AccountNotActiveException(AccountStatus.BANNED));
        assertThatThrownBy(() -> service.resolve(jwt(actor), started.token())).isInstanceOf(AccountNotActiveException.class);
        doReturn(account(target, AppRole.ADMIN)).when(users).getActiveAccount(target.toString());
        assertThatThrownBy(() -> service.resolve(jwt(actor), started.token())).isInstanceOf(ImpersonationService.EndedException.class);
        when(users.getActiveAccount(actor.toString())).thenReturn(account(actor, AppRole.USER));
        assertThatThrownBy(() -> service.resolve(jwt(actor), started.token())).isInstanceOf(ImpersonationService.EndedException.class);
    }

    @Test
    void cannotStartWithoutDurableAuditAndRestartRevokesSessions() {
        doThrow(new IllegalStateException("audit unavailable")).when(audit).recordRequired(
                eq(SecurityEventType.IMPERSONATION_STARTED), any(), any(), any(), any(), any(), any());
        assertThatThrownBy(() -> service.start(jwt(actor), target, request)).hasMessageContaining("audit unavailable");
        reset(audit);
        var started = service.start(jwt(actor), target, request);
        var restarted = new ImpersonationService(users, jdbc, audit, Clock.fixed(now, ZoneOffset.UTC));
        assertThatThrownBy(() -> restarted.resolve(jwt(actor), started.token())).isInstanceOf(ImpersonationService.EndedException.class);
        verify(audit).recordRequired(eq(SecurityEventType.IMPERSONATION_STARTED), any(), eq(actor), eq(target), any(), any(),
                argThat(details -> !details.containsKey("token")));
    }

    static CurrentUserRepository.AccountProfile account(UUID id, AppRole role) {
        return new CurrentUserRepository.AccountProfile(id, role, AccountStatus.ACTIVE, null, null, null, null, null, null);
    }
    static Jwt jwt(UUID id) {
        Instant now = Instant.parse("2026-11-01T00:00:00Z");
        return new Jwt("verified-token", now, now.plusSeconds(3600), Map.of("alg", "ES256"),
                Map.of("sub", id.toString(), "email", "admin@example.invalid", "role", "ADMIN", "scope", "admin",
                        "user_metadata", Map.of("display_name", "Administrator")));
    }
}
