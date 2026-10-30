package com.fujipp.backend.store;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AdminUserController;
import com.fujipp.backend.auth.AdminUserService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = {
        StoreCatalogController.class,
        BotController.class,
        TicketHistoryController.class,
        AdminTicketHistoryController.class,
        RuntimeTicketController.class,
        TicketCounterController.class,
        AdminTicketCounterController.class,
        StoreOrderController.class,
        FeatureLicenseController.class,
        AdminFeatureController.class,
        AdminBotController.class,
        AdminUserController.class
}, properties = "app.runtime.runner-tokens=test-runner-token-with-at-least-32-characters")
@Import({SecurityConfig.class, ApiExceptionHandler.class, StoreExceptionHandler.class})
class StoreControllerTests {

    @MockitoBean
    private com.fujipp.backend.auth.AuthIdentityProjection identityProjection;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StoreService storeService;
    @MockitoBean
    private TicketHistoryService ticketHistoryService;
    @MockitoBean
    private RuntimeTicketService runtimeTickets;
    @MockitoBean
    private TicketCounterService ticketCounters;

    @MockitoBean
    private AdminFeatureService adminFeatureService;

    @MockitoBean
    private AdminBotService adminBotService;

    @MockitoBean
    private AdminUserService adminUserService;

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
    void ticketRegistryAndArchivesRequireTheRunnerCredential() throws Exception {
        String path="/internal/v1/runtime/bots/"+UUID.randomUUID()+"/tickets?installationId="+UUID.randomUUID();
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        authorizeUser();
        mockMvc.perform(get(path).with(jwt())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(path).header("X-Runner-Token","test-runner-token-with-at-least-32-characters"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control","no-store"));
        mockMvc.perform(put("/internal/v1/runtime/bots/"+UUID.randomUUID()+"/tickets/111111111111111111/archive")
                .with(jwt()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ticketCounterUsesAuthenticatedOwnerScopeAndValidatesResetRange() throws Exception {
        UUID botId=UUID.randomUUID();
        String path="/api/v1/bots/"+botId+"/ticket-counter";
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        authorizeUser();
        when(ticketCounters.read(botId)).thenReturn(new TicketCounterService.Counter(42,false));
        mockMvc.perform(get(path).with(jwt())).andExpect(status().isOk()).andExpect(jsonPath("$.nextNumber").value(42));
        verify(ticketHistoryService).authorizeBot(anyString(),org.mockito.ArgumentMatchers.eq(botId),org.mockito.ArgumentMatchers.eq(false));
        mockMvc.perform(put(path).with(jwt()).contentType("application/json").content("{\"nextNumber\":100000}")).andExpect(status().isBadRequest());
        mockMvc.perform(put(path.replace("/bots/","/admin/bots/")).with(jwt()).contentType("application/json").content("{\"nextNumber\":0}")).andExpect(status().isForbidden());
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

    @Test
    void regularUsersCannotRemoveFeaturesFromCustomerBots() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(delete(
                        "/api/v1/admin/bots/11111111-1111-4111-8111-111111111111/installations/22222222-2222-4222-8222-222222222222"
                ).with(jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanRemoveFeatureFromCustomerBot() throws Exception {
        authorizeAs(AppRole.ADMIN);
        UUID botId = UUID.fromString("11111111-1111-4111-8111-111111111111");
        UUID installationId = UUID.fromString("22222222-2222-4222-8222-222222222222");

        mockMvc.perform(delete(
                        "/api/v1/admin/bots/{botId}/installations/{installationId}",
                        botId,
                        installationId
                ).with(jwt()))
                .andExpect(status().isNoContent());

        verify(adminBotService).removeFeature(botId, installationId);
    }

    @Test
    void regularUsersCannotDeleteCustomerBots() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(delete(
                        "/api/v1/admin/bots/11111111-1111-4111-8111-111111111111"
                ).with(jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanDeleteCustomerBot() throws Exception {
        authorizeAs(AppRole.ADMIN);
        UUID botId = UUID.fromString("11111111-1111-4111-8111-111111111111");

        mockMvc.perform(delete("/api/v1/admin/bots/{botId}", botId).with(jwt()))
                .andExpect(status().isNoContent());

        verify(adminBotService).delete(botId);
    }

    @Test
    void onlyAdministratorsCanRemoveUserFeatureLicenses() throws Exception {
        String path = "/api/v1/admin/users/11111111-1111-4111-8111-111111111111/features/22222222-2222-4222-8222-222222222222";
        mockMvc.perform(delete(path)).andExpect(status().isUnauthorized());
        for (AppRole role : new AppRole[]{AppRole.USER, AppRole.TESTER, AppRole.EDITOR}) {
            authorizeAs(role);
            mockMvc.perform(delete(path).with(jwt())).andExpect(status().isForbidden());
        }
        org.mockito.Mockito.verifyNoInteractions(adminUserService);
    }

    @Test
    void administratorCanRemoveOneLicenseFromTheSpecifiedUser() throws Exception {
        authorizeAs(AppRole.ADMIN);
        UUID userId = UUID.randomUUID(), licenseId = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/admin/users/{userId}/features/{licenseId}", userId, licenseId).with(jwt()))
                .andExpect(status().isNoContent());
        verify(adminUserService).removeFeature(userId, licenseId);
    }

    private void authorizeUser() {
        authorizeAs(AppRole.USER);
    }

    @Test
    void ticketHistoryRequiresLoginAndNeverAllowsRegularUsersIntoAdminEndpoints() throws Exception {
        String path = "/api/v1/bots/11111111-1111-4111-8111-111111111111/tickets";
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        authorizeAs(AppRole.USER);
        mockMvc.perform(get("/api/v1/admin/bots/11111111-1111-4111-8111-111111111111/tickets").with(jwt()))
            .andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(ticketHistoryService);
    }

    @Test
    void ticketHistoryIsNeverCachedAndPassesTheAuthenticatedSubject() throws Exception {
        authorizeUser(); UUID botId = UUID.randomUUID();
        when(ticketHistoryService.list("ticket-user", botId, false)).thenReturn(List.of());
        mockMvc.perform(get("/api/v1/bots/{botId}/tickets", botId).with(jwt().jwt(jwt -> jwt.subject("ticket-user"))))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        verify(ticketHistoryService).list("ticket-user", botId, false);
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
