package com.fujipp.backend.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.UUID;

@Service
public class SecurityAuditService {

    private static final Logger log = LoggerFactory.getLogger(SecurityAuditService.class);
    private static final int MAX_USER_AGENT_LENGTH = 512;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public SecurityAuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void record(
            SecurityEventType eventType,
            AuditOutcome outcome,
            UUID actorUserId,
            UUID subjectUserId,
            String ipAddress,
            String userAgent,
            Map<String, ?> details
    ) {
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO private.security_audit_log (
                        event_type,
                        outcome,
                        actor_user_id,
                        subject_user_id,
                        ip_address,
                        user_agent,
                        details
                    )
                    VALUES (?, ?, ?, ?, CAST(? AS inet), ?, CAST(? AS jsonb))
                    """,
                    eventType.name(),
                    outcome.name(),
                    actorUserId,
                    subjectUserId,
                    normalizeIp(ipAddress),
                    truncate(userAgent),
                    objectMapper.writeValueAsString(details == null ? Map.of() : details)
            );
        } catch (DataAccessException | JacksonException exception) {
            log.warn(
                    "Unable to persist security audit event type={} outcome={}",
                    eventType,
                    outcome,
                    exception
            );
        }
    }

    private String normalizeIp(String ipAddress) {
        return ipAddress == null || ipAddress.isBlank() ? null : ipAddress;
    }

    private String truncate(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        return userAgent.length() <= MAX_USER_AGENT_LENGTH
                ? userAgent
                : userAgent.substring(0, MAX_USER_AGENT_LENGTH);
    }
}
