package com.fujipp.backend.work;

import com.fujipp.backend.auth.CurrentUserService;
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

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorkController.class)
@Import({SecurityConfig.class, WorkExceptionHandler.class})
class WorkControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WorkService workService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private SecurityAuditService securityAuditService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void publishedWorksArePublic() throws Exception {
        when(workService.listPublished(WorkLocale.th, null, null)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/works"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void listAcceptsFiltersAndLocale() throws Exception {
        when(workService.listPublished(WorkLocale.en, "web-app", true)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/works")
                        .queryParam("locale", "en")
                        .queryParam("category", "web-app")
                        .queryParam("featured", "true"))
                .andExpect(status().isOk());
    }

    @Test
    void detailReturnsNotFoundProblem() throws Exception {
        when(workService.getPublished("missing", WorkLocale.th))
                .thenThrow(new WorkNotFoundException());

        mockMvc.perform(get("/api/v1/works/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Work not found"));
    }

    @Test
    void rejectsUnsupportedLocale() throws Exception {
        mockMvc.perform(get("/api/v1/works").queryParam("locale", "jp"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void nonWorkApisRemainProtected() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }
}
