package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.*;

@Component
class TicketHistoryRetention {
    private final JdbcTemplate jdbc;
    TicketHistoryRetention(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    // The hourly pass also catches up after downtime at the month boundary.
    @Scheduled(cron="0 0 * * * *",zone="Asia/Bangkok")
    void purge() { purgeAt(Instant.now()); }
    int purgeAt(Instant now) {
        var boundary=now.atZone(ZoneId.of("Asia/Bangkok")).withDayOfMonth(1).toLocalDate().atStartOfDay(ZoneId.of("Asia/Bangkok")).toOffsetDateTime();
        return jdbc.update("""
            DELETE FROM private.ticket_channels
            WHERE state->>'status'='CLOSED' AND archived_at IS NOT NULL AND archived_at<?
            """,boundary);
    }
}
