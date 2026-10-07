package com.fujipp.backend.topup;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class TopupRepositoryTests {
    @Test
    void filtersOwnedHistoryBeforeLimitingAndKeepsStableCursorOrder() {
        var jdbc=new CapturingJdbc();
        UUID owner=UUID.randomUUID();
        UUID lastId=UUID.randomUUID();
        OffsetDateTime from=OffsetDateTime.parse("2026-10-01T00:00:00Z");
        OffsetDateTime before=from.plusDays(3);
        new TopupRepository(jdbc).list(owner,before,lastId,11,TopupRequests.Status.SUCCESS,from);
        assertThat(jdbc.expiryOwner).isEqualTo(owner);
        assertThat(jdbc.sql).contains("WHERE c.user_id=?", "AND i.status=?::billing.topup_status", "AND i.created_at>=?", "AND (i.created_at,i.id)<(?,?)", "ORDER BY i.created_at DESC,i.id DESC LIMIT ?");
        assertThat(jdbc.parameters).containsExactly(owner,"SUCCESS",from,before,lastId,11);
    }

    @Test
    void unfilteredHistoryRetainsItsOriginalQuery() {
        var jdbc=new CapturingJdbc();
        UUID owner=UUID.randomUUID();
        new TopupRepository(jdbc).list(owner,null,null,11,null,null);
        assertThat(jdbc.sql).doesNotContain("AND i.status", "AND i.created_at>=", "AND (i.created_at,i.id)");
        assertThat(jdbc.parameters).containsExactly(owner,11);
    }

    private static class CapturingJdbc extends JdbcTemplate {
        String sql;
        Object[] parameters;
        Object expiryOwner;
        @Override public int update(String sql,Object... args) {
            expiryOwner=args[0];
            return 0;
        }
        @Override public <T> List<T> query(String sql, RowMapper<T> mapper, Object... args) {
            this.sql=sql;
            this.parameters=args;
            return List.of();
        }
    }
}
