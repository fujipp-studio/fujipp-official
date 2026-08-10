package com.fujipp.backend.runtime;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Arrays;

@Component
public class RunnerAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Runner-Token";
    private final List<byte[]> expectedTokenHashes;

    public RunnerAuthenticationFilter(@Value("${app.runtime.runner-tokens:}") String tokens) {
        List<String> configuredTokens = tokens == null ? List.of() : Arrays.stream(tokens.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .toList();
        if (configuredTokens.stream().anyMatch(token -> token.length() < 32)) {
            throw new IllegalArgumentException("Runner API tokens must contain at least 32 characters");
        }
        this.expectedTokenHashes = configuredTokens.stream().map(RunnerAuthenticationFilter::hash).toList();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/v1/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String supplied = request.getHeader(HEADER);
        byte[] suppliedHash = supplied == null ? null : hash(supplied);
        if (suppliedHash == null || expectedTokenHashes.stream()
                .noneMatch(expected -> MessageDigest.isEqual(expected, suppliedHash))) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write("{\"title\":\"Runner authentication failed\",\"status\":401}");
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(
                "bot-runner",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_RUNNER"))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private static byte[] hash(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
