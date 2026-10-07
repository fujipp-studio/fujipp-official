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
import java.util.List;
import java.time.OffsetDateTime;
import com.fujipp.backend.pagination.CursorPage;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Test
    void historyAcceptsStatusAndPeriodAndRejectsInvalidFilters() throws Exception {
        authorize();
        UUID userId=UUID.randomUUID();
        OffsetDateTime from=OffsetDateTime.parse("2026-10-01T00:00:00Z");
        when(service.list(userId.toString(),10,null,TopupRequests.Status.SUCCESS,from))
                .thenReturn(new CursorPage<>(List.of(),null,false));
        mockMvc.perform(get("/api/v1/wallet/topups").with(jwt().jwt(builder->builder.subject(userId.toString())))
                .param("limit","10").param("status","SUCCESS").param("createdFrom",from.toString()))
                .andExpect(status().isOk());
        verify(service).list(userId.toString(),10,null,TopupRequests.Status.SUCCESS,from);
        mockMvc.perform(get("/api/v1/wallet/topups").with(jwt().jwt(builder->builder.subject(userId.toString())))
                .param("status","INVALID")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/wallet/topups").with(jwt().jwt(builder->builder.subject(userId.toString())))
                .param("createdFrom","not-a-date")).andExpect(status().isBadRequest());
    }

    private void authorize() {
        when(currentUserService.getActiveAccount(anyString())).thenReturn(new CurrentUserRepository.AccountProfile(
                UUID.randomUUID(),AppRole.USER,AccountStatus.ACTIVE,"user","User",null,null,null,null));
    }
}
