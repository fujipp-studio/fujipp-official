package com.fujipp.backend.work.admin;

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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminWorkController.class)
@Import({
        SecurityConfig.class,
        AdminWorkExceptionHandler.class,
        ApiExceptionHandler.class
})
class AdminWorkControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminWorkService adminWorkService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private SecurityAuditService securityAuditService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void adminApiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/admin/works"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void regularUserCannotManageWorks() throws Exception {
        authorizeAs(AppRole.USER);

        mockMvc.perform(get("/api/v1/admin/works").with(jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void editorCanListWorks() throws Exception {
        authorizeAs(AppRole.EDITOR);
        when(adminWorkService.list()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/works").with(jwt()))
                .andExpect(status().isOk());
    }

    @Test
    void adminCanListWorks() throws Exception {
        authorizeAs(AppRole.ADMIN);
        when(adminWorkService.list()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/works").with(jwt()))
                .andExpect(status().isOk());
    }

    @Test
    void editorCanLoadWorkCatalog() throws Exception {
        authorizeAs(AppRole.EDITOR);
        when(adminWorkService.catalog()).thenReturn(new AdminWorkCatalogResponse(
                List.of(), List.of(), List.of(), List.of()
        ));

        mockMvc.perform(get("/api/v1/admin/works/catalog").with(jwt()))
                .andExpect(status().isOk());
    }

    @Test
    void editorCanCreateCatalogTechnology() throws Exception {
        authorizeAs(AppRole.EDITOR);
        when(adminWorkService.createTechnology(any(CreateTechnologyRequest.class)))
                .thenReturn(new AdminWorkCatalogResponse.Technology(
                        "spring-boot", "Spring Boot", "backend", "Backend"
                ));

        mockMvc.perform(post("/api/v1/admin/works/catalog/technologies")
                        .with(jwt())
                        .contentType("application/json")
                        .content("""
                                {
                                  "slug": "spring-boot",
                                  "name": "Spring Boot",
                                  "groupCode": "backend",
                                  "iconUrl": "https://cdn.simpleicons.org/springboot",
                                  "officialUrl": "https://spring.io/projects/spring-boot"
                                }
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void createValidatesRequiredFields() throws Exception {
        authorizeAs(AppRole.EDITOR);

        mockMvc.perform(post("/api/v1/admin/works")
                        .with(jwt())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private void authorizeAs(AppRole role) {
        when(currentUserService.getActiveAccount(anyString()))
                .thenReturn(new CurrentUserRepository.AccountProfile(
                        UUID.randomUUID(),
                        role,
                        AccountStatus.ACTIVE,
                        "editor",
                        "Editor",
                        null,
                        null,
                        null,
                        null
                ));
    }
}
