package com.fujipp.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000;

    private final ObjectMapper objectMapper;
    private final SecurityAuditService securityAuditService;
    private final int readLimit;
    private final int writeLimit;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong requestCounter = new AtomicLong();

    @Autowired
    public ApiRateLimitFilter(
            ObjectMapper objectMapper,
            SecurityAuditService securityAuditService,
            @Value("${app.security.rate-limit.read-requests-per-minute}") int readLimit,
            @Value("${app.security.rate-limit.write-requests-per-minute}") int writeLimit
    ) {
        this(objectMapper, securityAuditService, readLimit, writeLimit, Clock.systemUTC());
    }

    ApiRateLimitFilter(
            ObjectMapper objectMapper,
            SecurityAuditService securityAuditService,
            int readLimit,
            int writeLimit,
            Clock clock
    ) {
        if (readLimit < 1 || writeLimit < 1) {
            throw new IllegalArgumentException("Rate limits must be positive");
        }
        this.objectMapper = objectMapper;
        this.securityAuditService = securityAuditService;
        this.readLimit = readLimit;
        this.writeLimit = writeLimit;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean readRequest = "GET".equals(request.getMethod())
                || "HEAD".equals(request.getMethod())
                || "OPTIONS".equals(request.getMethod());
        int limit = readRequest ? readLimit : writeLimit;
        JwtAuthenticationToken jwtAuthentication = authentication instanceof JwtAuthenticationToken jwt
                && authentication.isAuthenticated() ? jwt : null;
        String identity = jwtAuthentication == null
                ? "ip:" + clientAddress(request)
                : "user:" + jwtAuthentication.getToken().getSubject();
        String bucketKey = (readRequest ? "read:" : "write:") + identity;
        long now = clock.millis();
        Decision decision = windows.computeIfAbsent(bucketKey, ignored -> new Window())
                .consume(now, limit);

        response.setHeader("X-RateLimit-Limit", Integer.toString(limit));
        response.setHeader("X-RateLimit-Remaining", Integer.toString(decision.remaining()));

        if (!decision.allowed()) {
            response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
            UUID userId = jwtAuthentication == null ? null
                    : parseUserId(jwtAuthentication.getToken().getSubject());
            securityAuditService.record(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    AuditOutcome.DENIED,
                    userId,
                    userId,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent"),
                    Map.of(
                            "requestClass", readRequest ? "READ" : "WRITE",
                            "limitPerMinute", limit
                    )
            );
            writeProblem(response);
            return;
        }

        if (requestCounter.incrementAndGet() % 1_000 == 0) {
            windows.entrySet().removeIf(entry -> entry.getValue().expiredBefore(now));
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    private String clientAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) return request.getRemoteAddr();
        String[] addresses = forwarded.split(",");
        String closest = addresses[addresses.length - 1].trim();
        return closest.isEmpty() || closest.length() > 64 ? request.getRemoteAddr() : closest;
    }

    private void writeProblem(HttpServletResponse response) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.TOO_MANY_REQUESTS,
                "Too many requests were sent in a short period"
        );
        problem.setTitle("Rate limit exceeded");
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }

    private UUID parseUserId(String subject) {
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException | NullPointerException exception) {
            return null;
        }
    }

    private static final class Window {
        private long startedAt;
        private int count;

        synchronized Decision consume(long now, int limit) {
            if (startedAt == 0 || now - startedAt >= WINDOW_MILLIS) {
                startedAt = now;
                count = 0;
            }

            if (count >= limit) {
                long remainingMillis = Math.max(1, WINDOW_MILLIS - (now - startedAt));
                long retryAfterSeconds = Math.max(1, (remainingMillis + 999) / 1_000);
                return new Decision(false, 0, retryAfterSeconds);
            }

            count++;
            return new Decision(true, limit - count, 0);
        }

        synchronized boolean expiredBefore(long now) {
            return now - startedAt >= WINDOW_MILLIS * 2;
        }
    }

    private record Decision(boolean allowed, int remaining, long retryAfterSeconds) {
    }
}
