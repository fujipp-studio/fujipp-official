package com.fujipp.backend.auth;

import com.fujipp.backend.config.SecurityConfig;
import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.security.SecurityEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({ImpersonationController.class, AuthController.class, AdminUserController.class})
@Import({SecurityConfig.class, AuthExceptionHandler.class, ImpersonationService.class})
class ImpersonationControllerTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean CurrentUserService users;
    @MockitoBean AdminUserService adminUsers;
    @MockitoBean AuthIdentityProjection projection;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean JdbcTemplate jdbc;
    @MockitoBean SecurityAuditService audit;
    private final UUID actor = UUID.randomUUID(), target = UUID.randomUUID();

    @BeforeEach
    void setup() {
        when(users.getActiveAccount(actor.toString())).thenReturn(ImpersonationServiceTests.account(actor, AppRole.ADMIN));
        when(users.getActiveAccount(target.toString())).thenReturn(ImpersonationServiceTests.account(target, AppRole.USER));
        when(users.getActiveUser(any())).thenAnswer(call -> {
            Jwt effective = call.getArgument(0);
            UUID id = UUID.fromString(effective.getSubject());
            return new CurrentUser(id, effective.getClaimAsString("email"),
                    id.equals(actor) ? AppRole.ADMIN : AppRole.USER, AccountStatus.ACTIVE,
                    null, "Test user", null, null, null, null, 0L);
        });
    }

    private String start() throws Exception {
        var response = mvc.perform(post(ImpersonationService.PATH).with(jwt().jwt(j -> j.subject(actor.toString())))
                        .contentType("application/json").content("{\"userId\":\"" + target + "\"}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.user.id").value(target.toString()))
                .andReturn().getResponse();
        return mapper.readTree(response.getContentAsString()).get("token").asString();
    }

    @Test
    void effectiveSubjectOwnsAllRequestsAndAdminAuthorityIsRemoved() throws Exception {
        String token = start();
        mvc.perform(get("/api/v1/auth/me").with(jwt().jwt(j -> j.subject(actor.toString())
                                .claim("email", "admin@example.invalid")).authorities(() -> "ROLE_ADMIN"))
                        .header(ImpersonationService.HEADER, token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(target.toString()))
                .andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.email").isEmpty());
        mvc.perform(get("/api/v1/admin/users").with(jwt().jwt(j -> j.subject(actor.toString()))
                        .authorities(() -> "ROLE_ADMIN")).header(ImpersonationService.HEADER, token))
                .andExpect(status().isForbidden());
        mvc.perform(post(ImpersonationService.PATH).with(jwt().jwt(j -> j.subject(actor.toString())))
                        .header(ImpersonationService.HEADER, token).contentType("application/json")
                        .content("{\"userId\":\"" + target + "\"}"))
                .andExpect(status().isForbidden());
        verify(projection, never()).ensureIdentity(argThat(j -> j.getSubject().equals(target.toString())));
        verify(audit, atLeastOnce()).recordRequired(eq(SecurityEventType.IMPERSONATION_REQUEST), any(),
                eq(actor), eq(target), any(), any(), any());
    }

    @Test
    void userCannotStartAndCapabilityCannotBeReplayedAfterStop() throws Exception {
        mvc.perform(post(ImpersonationService.PATH).with(jwt().jwt(j -> j.subject(target.toString())))
                        .contentType("application/json").content("{\"userId\":\"" + actor + "\"}"))
                .andExpect(status().isForbidden());
        String token = start();
        mvc.perform(delete(ImpersonationService.PATH).with(jwt().jwt(j -> j.subject(actor.toString())))
                        .header(ImpersonationService.HEADER, token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/auth/me").with(jwt().jwt(j -> j.subject(actor.toString())))
                        .header(ImpersonationService.HEADER, token))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.reason").value("IMPERSONATION_ENDED"));
        mvc.perform(get("/api/v1/admin/users").with(jwt().jwt(j -> j.subject(actor.toString()))))
                .andExpect(status().isOk());
    }

    @Test
    void auditFailureBlocksTheEffectiveUserOperationBeforeControllerExecution() throws Exception {
        String token = start();
        clearInvocations(users);
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("audit unavailable"))
                .when(audit).recordRequired(eq(SecurityEventType.IMPERSONATION_REQUEST), any(),
                        any(), any(), any(), any(), any());
        assertThatThrownBy(() -> mvc.perform(get("/api/v1/auth/me")
                .with(jwt().jwt(j -> j.subject(actor.toString())))
                .header(ImpersonationService.HEADER, token)))
                .hasMessageContaining("audit unavailable");
        verify(users, never()).getActiveUser(any());
    }

    @Test
    void corsAllowsOnlyApprovedOriginsWithImpersonationHeader() throws Exception {
        mvc.perform(options(ImpersonationService.PATH).header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type,X-Impersonation-Token"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options(ImpersonationService.PATH).header("Origin", "https://untrusted.invalid")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
