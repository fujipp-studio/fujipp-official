package com.fujipp.backend.work;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkRepositoryTests {
    @Test
    void loadsOneHundredProjectsWithFourQueriesAndPreservesRelationsAndCursorOrder() {
        var jdbc = new FixtureJdbc(100);
        var rows = new WorkRepository(jdbc).findPublishedPage("en", null, null, List.of(), 101);
        assertThat(jdbc.queries).hasSize(4);
        assertThat(rows).hasSize(100);
        assertThat(rows.getFirst().item().positions()).extracting(WorkRepository.Position::code).containsExactly("dev");
        assertThat(rows.getFirst().item().technologies()).extracting(WorkRepository.Technology::slug).containsExactly("vue");
        assertThat(rows.getFirst().item().cover().url()).isEqualTo("cover.webp");
        assertThat(rows.get(1).item().cover()).isNull();
        assertThat(rows.get(1).item().positions()).isEmpty();
        assertThat(rows).extracting(WorkRepository.WorkPageRow::slug)
                .containsExactlyElementsOf(java.util.stream.IntStream.range(0, 100).mapToObj(i -> "work-" + i).toList());
        assertThat(jdbc.queries.getLast()).contains("DISTINCT ON (project_id)", "ORDER BY project_id, sort_order, id");
    }

    @Test
    void emptyPagesDoNotQueryRelations() {
        var jdbc = new FixtureJdbc(0);
        assertThat(new WorkRepository(jdbc).findPublishedPage("th", "web", true, List.of(), 10)).isEmpty();
        assertThat(jdbc.queries).hasSize(1);
    }

    @Test
    void legacyFeaturedListAlsoUsesBulkRelations() {
        var jdbc = new FixtureJdbc(20);
        assertThat(new WorkRepository(jdbc).findPublished("en", null, true)).hasSize(20);
        assertThat(jdbc.queries).hasSize(4);
    }

    private static class FixtureJdbc extends JdbcTemplate {
        final List<String> queries = new ArrayList<>();
        final int count;
        final UUID first = UUID.fromString("00000000-0000-0000-0000-000000000001");
        FixtureJdbc(int count) { this.count = count; }

        @Override public <T> List<T> query(String sql, RowMapper<T> mapper, Object... args) {
            queries.add(sql);
            try {
                if (sql.contains("FROM portfolio.projects")) {
                    List<T> result = new ArrayList<>();
                    for (int i = 0; i < count; i++) {
                        ResultSet rs = mock(ResultSet.class);
                        when(rs.getObject("id", UUID.class)).thenReturn(i == 0 ? first : new UUID(0, i + 1));
                        when(rs.getString("slug")).thenReturn("work-" + i);
                        when(rs.getString("name")).thenReturn("Work " + i);
                        when(rs.getString("category_code")).thenReturn("web");
                        when(rs.getObject("published_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.parse("2026-01-01T00:00:00Z"));
                        result.add(mapper.mapRow(rs, i));
                    }
                    return result;
                }
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject("project_id", UUID.class)).thenReturn(first);
                when(rs.getString("code")).thenReturn("dev");
                when(rs.getString("slug")).thenReturn("vue");
                when(rs.getString("secure_url")).thenReturn("cover.webp");
                List<T> result = new ArrayList<>();
                result.add(mapper.mapRow(rs, 0));
                return result;
            } catch (SQLException exception) { throw new AssertionError(exception); }
        }
    }
}
