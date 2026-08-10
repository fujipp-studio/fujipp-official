package com.fujipp.backend.store;

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

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({
        StoreCatalogController.class,
        BotController.class,
        StoreOrderController.class,
        FeatureLicenseController.class,
        AdminFeatureController.class
})
@Import({SecurityConfig.class, ApiExceptionHandler.class, StoreExceptionHandler.class})
class StoreControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StoreService storeService;

    @MockitoBean
    private AdminFeatureService adminFeatureService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private SecurityAuditService securityAuditService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void featureCatalogIsPublic() throws Exception {
        when(storeService.listFeatures()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/store/features"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void inventoryRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/feature-licenses"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createBotValidatesDiscordIds() throws Exception {
        authorizeUser();

        mockMvc.perform(post("/api/v1/bots")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "My Bot",
                                  "discordApplicationId": "invalid"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    @Test
    void updateBotValidatesDiscordIds() throws Exception {
        authorizeUser();

        mockMvc.perform(put("/api/v1/bots/11111111-1111-4111-8111-111111111111")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "My Bot",
                                  "discordGuildId": "invalid"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    @Test
    void botControlsRequireAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bots/11111111-1111-4111-8111-111111111111/restart"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void checkoutValidatesQuantityAndIdempotencyKey() throws Exception {
        authorizeUser();

        mockMvc.perform(post("/api/v1/store/orders")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {
                                  "offerId": "11111111-1111-4111-8111-111111111111",
                                  "quantity": 0,
                                  "idempotencyKey": ""
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void regularUsersCannotManageFeatureMedia() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(get(
                        "/api/v1/admin/store/features/11111111-1111-4111-8111-111111111111/media"
                ).with(jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanLoadFeatureMedia() throws Exception {
        authorizeAs(AppRole.ADMIN);
        UUID featureId = UUID.fromString("11111111-1111-4111-8111-111111111111");
        when(adminFeatureService.get(featureId)).thenReturn(new FeatureMediaResponse(
                null, null, null, null, null, null, null
        ));

        mockMvc.perform(get(
                        "/api/v1/admin/store/features/11111111-1111-4111-8111-111111111111/media"
                ).with(jwt()))
                .andExpect(status().isOk());
    }

    private void authorizeUser() {
        authorizeAs(AppRole.USER);
    }

    private void authorizeAs(AppRole role) {
        when(currentUserService.getActiveAccount(anyString()))
                .thenReturn(new CurrentUserRepository.AccountProfile(
                        UUID.randomUUID(),
                        role,
                        AccountStatus.ACTIVE,
                        "user",
                        "User",
                        null,
                        null,
                        null,
                        null
                ));
    }
}
