package com.fujipp.backend.auth;

import com.fujipp.backend.security.AuditOutcome;
import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.security.SecurityEventType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;

@Component
public class AccountAccessFilter extends OncePerRequestFilter {

    private final CurrentUserService currentUserService;
    private final SecurityAuditService securityAuditService;
    private final ObjectMapper objectMapper;

    public AccountAccessFilter(
            CurrentUserService currentUserService,
            SecurityAuditService securityAuditService,
            ObjectMapper objectMapper
    ) {
        this.currentUserService = currentUserService;
        this.securityAuditService = securityAuditService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            CurrentUserRepository.AccountProfile account =
                    currentUserService.getActiveAccount(jwtAuthentication.getToken().getSubject());
            var authorities = new ArrayList<>(jwtAuthentication.getAuthorities());
            authorities.add(new SimpleGrantedAuthority("ROLE_" + account.role().name()));

            JwtAuthenticationToken authorizedAuthentication = new JwtAuthenticationToken(
                    jwtAuthentication.getToken(),
                    authorities,
                    jwtAuthentication.getName()
            );
            authorizedAuthentication.setDetails(jwtAuthentication.getDetails());
            SecurityContextHolder.getContext().setAuthentication(authorizedAuthentication);

            filterChain.doFilter(request, response);
        } catch (AccountNotActiveException exception) {
            recordDeniedAccess(
                    request,
                    jwtAuthentication.getToken().getSubject(),
                    Map.of("accountStatus", exception.getStatus().name())
            );
            writeProblem(
                    response,
                    HttpStatus.FORBIDDEN,
                    "Account is not active",
                    "This account cannot access the application",
                    exception.getStatus()
            );
        } catch (UserAccountNotFoundException exception) {
            recordDeniedAccess(
                    request,
                    jwtAuthentication.getToken().getSubject(),
                    Map.of("reason", "ACCOUNT_NOT_FOUND")
            );
            writeProblem(
                    response,
                    HttpStatus.FORBIDDEN,
                    "Account is unavailable",
                    "No application account exists for this authenticated user",
                    null
            );
        } catch (InvalidTokenSubjectException exception) {
            recordDeniedAccess(
                    request,
                    jwtAuthentication.getToken().getSubject(),
                    Map.of("reason", "INVALID_TOKEN_SUBJECT")
            );
            writeProblem(
                    response,
                    HttpStatus.UNAUTHORIZED,
                    "Invalid access token",
                    "The token subject is not a valid user ID",
                    null
            );
        }
    }

    private void recordDeniedAccess(
            HttpServletRequest request,
            String subject,
            Map<String, ?> details
    ) {
        UUID userId = parseUserId(subject);
        securityAuditService.record(
                SecurityEventType.ACCOUNT_ACCESS_DENIED,
                AuditOutcome.DENIED,
                userId,
                userId,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                details
        );
    }

    private UUID parseUserId(String subject) {
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException | NullPointerException exception) {
            return null;
        }
    }

    private void writeProblem(
            HttpServletResponse response,
            HttpStatus status,
            String title,
            String detail,
            AccountStatus accountStatus
    ) throws IOException {
        SecurityContextHolder.clearContext();
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        if (accountStatus != null) {
            problem.setProperty("accountStatus", accountStatus);
        }

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
