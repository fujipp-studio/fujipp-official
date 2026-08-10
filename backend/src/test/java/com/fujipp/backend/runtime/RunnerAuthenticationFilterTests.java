package com.fujipp.backend.runtime;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RunnerAuthenticationFilterTests {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void acceptsCurrentAndPreviousTokensDuringRotation() throws Exception {
        String current = "current-runner-token-with-at-least-32-characters";
        String previous = "previous-runner-token-with-at-least-32-characters";
        RunnerAuthenticationFilter filter = new RunnerAuthenticationFilter(current + "," + previous);

        assertThat(perform(filter, current).getStatus()).isEqualTo(200);
        SecurityContextHolder.clearContext();
        assertThat(perform(filter, previous).getStatus()).isEqualTo(200);
    }

    @Test
    void rejectsMissingOrUnknownTokens() throws Exception {
        RunnerAuthenticationFilter filter = new RunnerAuthenticationFilter("current-runner-token-with-at-least-32-characters,");

        assertThat(perform(filter, null).getStatus()).isEqualTo(401);
        assertThat(perform(filter, "unknown").getStatus()).isEqualTo(401);
    }

    @Test
    void rejectsWeakConfiguredTokens() {
        assertThatThrownBy(() -> new RunnerAuthenticationFilter("short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 32");
    }

    private MockHttpServletResponse perform(RunnerAuthenticationFilter filter, String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/runtime/bootstrap");
        if (token != null) request.addHeader("X-Runner-Token", token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
