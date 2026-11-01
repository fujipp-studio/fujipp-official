package com.fujipp.backend.site;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.config.ApiExceptionHandler;
import com.fujipp.backend.config.SecurityConfig;
import com.fujipp.backend.security.SecurityAuditService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({SeasonalEffectController.class, AdminSeasonalEffectController.class})
@Import({SecurityConfig.class, ApiExceptionHandler.class})
class SeasonalEffectControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean
    private com.fujipp.backend.auth.ImpersonationService impersonationService;

    @MockitoBean SeasonalEffectRepository repository;
    @MockitoBean CurrentUserService currentUserService;
    @MockitoBean com.fujipp.backend.auth.AuthIdentityProjection identityProjection;
    @MockitoBean SecurityAuditService securityAuditService;
    @MockitoBean JwtDecoder jwtDecoder;
    private static final UUID ACTOR = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final OffsetDateTime TIME = OffsetDateTime.parse("2026-10-23T00:00:00Z");
    private static final String ADMIN_PATH = "/api/v1/admin/site/seasonal-effects";

    @Test
    void anonymousVisitorsReadOnlyThePublicSettingsWithRevalidation() throws Exception {
        when(repository.get()).thenReturn(new SeasonalEffectSettings(SeasonalEffect.NONE, TIME));
        mvc.perform(get("/api/v1/site/seasonal-effects"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache"))
                .andExpect(jsonPath("$.effect").value("NONE"))
                .andExpect(jsonPath("$.updatedAt").exists())
                .andExpect(jsonPath("$.updatedBy").doesNotExist());
    }

    @Test
    void anonymousUsersCannotReadOrWriteAdminSettingsOrWriteThePublicEndpoint() throws Exception {
        mvc.perform(get(ADMIN_PATH)).andExpect(status().isUnauthorized());
        mvc.perform(put(ADMIN_PATH).contentType("application/json").content("{\"effect\":\"HALLOWEEN\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/site/seasonal-effects").contentType("application/json")
                        .content("{\"effect\":\"HALLOWEEN\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @EnumSource(value = AppRole.class, names = {"ADMIN"}, mode = EnumSource.Mode.EXCLUDE)
    void otherRolesCannotReadOrWriteAdminSettings(AppRole role) throws Exception {
        authorize(role);
        mvc.perform(get(ADMIN_PATH).with(jwt().jwt(builder -> builder.subject(ACTOR.toString()))))
                .andExpect(status().isForbidden());
        mvc.perform(put(ADMIN_PATH).with(jwt().jwt(builder -> builder.subject(ACTOR.toString())))
                        .contentType("application/json").content("{\"effect\":\"HALLOWEEN\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @EnumSource(SeasonalEffect.class)
    void adminCanSaveAndReadEachEffectAndTheActorComesFromTheToken(SeasonalEffect effect) throws Exception {
        authorize(AppRole.ADMIN);
        var value = new SeasonalEffectSettings(effect, TIME);
        when(repository.update(effect, ACTOR)).thenReturn(value);
        when(repository.get()).thenReturn(value);
        mvc.perform(put(ADMIN_PATH).with(jwt().jwt(builder -> builder.subject(ACTOR.toString())))
                        .contentType("application/json").content("{\"effect\":\"" + effect + "\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.effect").value(effect.name()));
        mvc.perform(get(ADMIN_PATH).with(jwt().jwt(builder -> builder.subject(ACTOR.toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.effect").value(effect.name()));
        verify(repository).update(effect, ACTOR);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"effect\":null}", "{\"effect\":\"CUSTOM\"}", "{\"effect\":0}"})
    void invalidValuesAreRejectedWithoutWriting(String body) throws Exception {
        authorize(AppRole.ADMIN);
        mvc.perform(put(ADMIN_PATH).with(jwt().jwt(builder -> builder.subject(ACTOR.toString())))
                        .contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    private void authorize(AppRole role) {
        when(currentUserService.getActiveAccount(anyString())).thenReturn(
                new CurrentUserRepository.AccountProfile(ACTOR, role, AccountStatus.ACTIVE,
                        "admin", "Admin", null, null, null, null));
    }
}
