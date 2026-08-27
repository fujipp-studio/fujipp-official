package com.fujipp.backend.topup;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.config.ApiExceptionHandler;
import com.fujipp.backend.config.SecurityConfig;
import com.fujipp.backend.security.SecurityAuditService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TopupController.class)
@Import({SecurityConfig.class,ApiExceptionHandler.class,TopupExceptionHandler.class})
class TopupControllerTests {
    @Autowired MockMvc mockMvc;
    @MockitoBean TopupService service;
    @MockitoBean CurrentUserService currentUserService;
    @MockitoBean SecurityAuditService securityAuditService;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void topupRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/wallet/topups").contentType("application/json")
                .content("{\"amountSatang\":5000,\"idempotencyKey\":\"topup:test\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createTopupValidatesAmountAndIdempotencyKey() throws Exception {
        authorize();
        mockMvc.perform(post("/api/v1/wallet/topups").with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                .contentType("application/json").content("{\"amountSatang\":0,\"idempotencyKey\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    private void authorize() {
        when(currentUserService.getActiveAccount(anyString())).thenReturn(new CurrentUserRepository.AccountProfile(
                UUID.randomUUID(),AppRole.USER,AccountStatus.ACTIVE,"user","User",null,null,null,null));
    }
}
