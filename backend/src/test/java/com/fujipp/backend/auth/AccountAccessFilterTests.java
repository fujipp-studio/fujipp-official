package com.fujipp.backend.auth;

import com.fujipp.backend.security.SecurityAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AccountAccessFilterTests {

    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final SecurityAuditService securityAuditService = mock(SecurityAuditService.class);
    private final AccountAccessFilter filter =
            new AccountAccessFilter(currentUserService, securityAuditService, new ObjectMapper());

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void addsDatabaseRoleToAuthenticatedRequest() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwt(userId.toString());
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, AppRole.ADMIN));
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of())
        );
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(
                new MockHttpServletRequest(),
                new MockHttpServletResponse(),
                chain
        );

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    void blocksInactiveAccountBeforeController() throws Exception {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenThrow(new AccountNotActiveException(AccountStatus.SUSPENDED));
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt(userId.toString()), List.of())
        );
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest(), response, chain);

        assertThat(chain.getRequest()).isNull();
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentType()).isEqualTo("application/problem+json");
        assertThat(response.getContentAsString()).contains(
                "\"title\":\"Account is not active\"",
                "\"accountStatus\":\"SUSPENDED\""
        );
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private CurrentUserRepository.AccountProfile account(UUID userId, AppRole role) {
        return new CurrentUserRepository.AccountProfile(
                userId,
                role,
                AccountStatus.ACTIVE,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private Jwt jwt(String subject) {
        Instant issuedAt = Instant.now();
        return new Jwt(
                "token",
                issuedAt,
                issuedAt.plusSeconds(300),
                Map.of("alg", "RS256"),
                Map.of("sub", subject)
        );
    }
}
