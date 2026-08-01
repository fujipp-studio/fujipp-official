package com.fujipp.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.store.StoreRepository;
import com.fujipp.backend.runtime.RuntimeRepository;
import com.fujipp.backend.work.WorkRepository;
import com.fujipp.backend.work.admin.AdminWorkRepository;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration",
        "app.runtime.runner-token=test-runner-token"
})
@AutoConfigureMockMvc
class BackendApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CurrentUserRepository currentUserRepository;

    @MockitoBean
    private WorkRepository workRepository;

    @MockitoBean
    private AdminWorkRepository adminWorkRepository;

    @MockitoBean
    private StoreRepository storeRepository;

    @MockitoBean
    private RuntimeRepository runtimeRepository;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private SecurityAuditService securityAuditService;

    @Test
    void contextLoads() {
    }

    @Test
    void healthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    void apiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/private"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void runtimeApiRejectsMissingRunnerToken() throws Exception {
        mockMvc.perform(get("/internal/v1/runtime/bootstrap"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void runtimeApiAcceptsConfiguredRunnerToken() throws Exception {
        mockMvc.perform(get("/internal/v1/runtime/bootstrap")
                        .header("X-Runner-Token", "test-runner-token"))
                .andExpect(status().isOk());
    }

    @Test
    void localFrontendOriginsAreAllowedByCors() throws Exception {
        mockMvc.perform(options("/api/v1/works")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        "Access-Control-Allow-Origin",
                        "http://localhost:5173"
                ));
    }

}
