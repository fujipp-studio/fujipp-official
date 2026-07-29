package com.fujipp.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fujipp.backend.config.SecurityConfig;
import com.fujipp.backend.security.SecurityAuditService;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, AuthExceptionHandler.class})
class AuthControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private SecurityAuditService securityAuditService;

    @Test
    void meRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsAuthenticatedActiveUser() throws Exception {
        UUID userId = UUID.randomUUID();
        CurrentUserRepository.AccountProfile account = account(userId, AppRole.USER);
        when(currentUserService.getActiveAccount(anyString())).thenReturn(account);
        when(currentUserService.getActiveUser(any())).thenReturn(new CurrentUser(
                userId,
                "user@example.com",
                AppRole.USER,
                AccountStatus.ACTIVE,
                "fujipp",
                "Fujipp",
                null,
                null,
                "https://example.com/avatar.png",
                null
        ));

        mockMvc.perform(get("/api/v1/auth/me").with(jwt().jwt(builder -> builder
                        .subject(userId.toString())
                        .claim("email", "user@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.email").value("user@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.username").value("fujipp"));
    }

    @Test
    void meReturnsForbiddenForInactiveAccount() throws Exception {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(anyString()))
                .thenThrow(new AccountNotActiveException(AccountStatus.BANNED));

        mockMvc.perform(get("/api/v1/auth/me").with(jwt().jwt(builder -> builder
                        .subject(userId.toString())
                        .claim("email", "user@example.com"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Account is not active"))
                .andExpect(jsonPath("$.accountStatus").value("BANNED"));
    }

    @Test
    void corsAllowsConfiguredFrontendOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/auth/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        "Access-Control-Allow-Origin",
                        "http://localhost:5173"
                ));
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/auth/me")
                        .header("Origin", "https://attacker.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    private CurrentUserRepository.AccountProfile account(UUID userId, AppRole role) {
        return new CurrentUserRepository.AccountProfile(
                userId,
                role,
                AccountStatus.ACTIVE,
                "fujipp",
                "Fujipp",
                null,
                null,
                null,
                null
        );
    }
}
