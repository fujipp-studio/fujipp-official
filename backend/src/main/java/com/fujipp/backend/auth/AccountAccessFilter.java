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
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
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
    private final AuthIdentityProjection identityProjection;
    private final ImpersonationService impersonation;

    public AccountAccessFilter(
            CurrentUserService currentUserService,
            SecurityAuditService securityAuditService,
            ObjectMapper objectMapper,
            AuthIdentityProjection identityProjection,
            ImpersonationService impersonation
    ) {
        this.currentUserService = currentUserService;
        this.securityAuditService = securityAuditService;
        this.objectMapper = objectMapper;
        this.identityProjection = identityProjection;
        this.impersonation = impersonation;
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
            identityProjection.ensureIdentity(jwtAuthentication.getToken());
            CurrentUserRepository.AccountProfile account =
                    currentUserService.getActiveAccount(jwtAuthentication.getToken().getSubject());
            Jwt effective = jwtAuthentication.getToken();
            String capability = request.getHeader(ImpersonationService.HEADER);
            boolean stopping = ImpersonationService.PATH.equals(request.getRequestURI())
                    && "DELETE".equals(request.getMethod());
            boolean acting = capability != null && !stopping;
            UUID operationId = UUID.randomUUID();
            if (acting) {
                // Starting while already impersonating must never regain admin privileges.
                effective = impersonation.resolve(effective, capability);
                account = currentUserService.getActiveAccount(effective.getSubject());
                securityAuditService.recordRequired(SecurityEventType.IMPERSONATION_REQUEST,
                        AuditOutcome.SUCCESS, UUID.fromString(jwtAuthentication.getToken().getSubject()),
                        account.id(), request.getRemoteAddr(), request.getHeader("User-Agent"),
                        Map.of("method", request.getMethod(), "path", request.getRequestURI(), "phase", "AUTHORIZED", "operationId", operationId.toString()));
                response.setHeader("Cache-Control", "no-store");
            }
            var authorities = acting
                    ? new ArrayList<GrantedAuthority>()
                    : new ArrayList<>(jwtAuthentication.getAuthorities());
            authorities.add(new SimpleGrantedAuthority("ROLE_" + account.role().name()));
            JwtAuthenticationToken authorizedAuthentication = new JwtAuthenticationToken(
                    effective, authorities, effective.getSubject());
            authorizedAuthentication.setDetails(jwtAuthentication.getDetails());
            SecurityContextHolder.getContext().setAuthentication(authorizedAuthentication);
            boolean completed = false;
            try {
                filterChain.doFilter(request, response);
                completed = true;
            } finally {
                if (acting) {
                    securityAuditService.record(SecurityEventType.IMPERSONATION_RESULT,
                            completed && response.getStatus() < 400 ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
                            UUID.fromString(jwtAuthentication.getToken().getSubject()), account.id(),
                            request.getRemoteAddr(), request.getHeader("User-Agent"),
                            Map.of("method", request.getMethod(), "path", request.getRequestURI(),
                                    "operationId", operationId.toString(), "status", completed ? response.getStatus() : 500));
                }
            }
        } catch (ImpersonationService.EndedException exception) {
            writeProblem(response, HttpStatus.FORBIDDEN, "Impersonation ended",
                    "Return to your administrator account and start a new session", null);

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
        if ("Impersonation ended".equals(title)) problem.setProperty("reason", "IMPERSONATION_ENDED");
        if (accountStatus != null) {
            problem.setProperty("accountStatus", accountStatus);
        }

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
