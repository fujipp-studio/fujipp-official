package com.fujipp.backend.donation;

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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({DonationController.class, AdminDonationController.class})
@Import({SecurityConfig.class, ApiExceptionHandler.class, DonationExceptionHandler.class})
class DonationControllerTests {
    @Autowired MockMvc mockMvc;
    @MockitoBean DonationService service;
    @MockitoBean CurrentUserService currentUserService;
    @MockitoBean SecurityAuditService securityAuditService;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void campaignIsPublic() throws Exception {
        when(service.campaign()).thenReturn(new DonationResponses.Campaign(
                "Support Fujipp", "Development", 100000, 25000, 2, List.of(), OffsetDateTime.now()
        ));

        mockMvc.perform(get("/api/v1/donations/campaign"))
                .andExpect(status().isOk());
    }

    @Test
    void donationRequiresAuthenticationBecauseItUsesTheWallet() throws Exception {
        mockMvc.perform(post("/api/v1/donations")
                        .contentType("application/json")
                        .content(validDonation()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedUserCanDonateFromWallet() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(post("/api/v1/donations")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content(validDonation()))
                .andExpect(status().isCreated());
    }

    @Test
    void donationRequiresAFundingMethod() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(post("/api/v1/donations")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {
                                  "amountSatang": 5000,
                                  "donorName": "Supporter",
                                  "anonymous": false,
                                  "idempotencyKey": "donation:test-1"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void regularUserCannotUpdateDonationGoal() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(patch("/api/v1/admin/donations/settings")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {"title":"Support Fujipp","description":"Development","goalSatang":100000}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanUpdateDonationGoal() throws Exception {
        authorizeAs(AppRole.ADMIN);

        mockMvc.perform(patch("/api/v1/admin/donations/settings")
                        .with(jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString())))
                        .contentType("application/json")
                        .content("""
                                {"title":"Support Fujipp","description":"Development","goalSatang":100000}
                                """))
                .andExpect(status().isOk());
    }

    private String validDonation() {
        return """
                {
                  "amountSatang": 5000,
                  "donorName": "Supporter",
                  "message": "Keep going",
                  "anonymous": false,
                  "fundingMethod": "WALLET",
                  "idempotencyKey": "donation:test-1"
                }
                """;
    }

    private void authorizeAs(AppRole role) {
        when(currentUserService.getActiveAccount(anyString())).thenReturn(
                new CurrentUserRepository.AccountProfile(
                        UUID.randomUUID(),
                        role,
                        AccountStatus.ACTIVE,
                        "user",
                        "User",
                        null,
                        null,
                        null,
                        null
                )
        );
    }
}
