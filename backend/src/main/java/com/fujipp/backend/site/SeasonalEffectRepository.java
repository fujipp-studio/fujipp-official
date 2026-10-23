package com.fujipp.backend.site;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
class SeasonalEffectRepository {
    private final JdbcTemplate jdbc;

    SeasonalEffectRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    SeasonalEffectSettings get() {
        return jdbc.queryForObject("""
                SELECT effect, updated_at FROM private.website_effect_settings WHERE id = 1
                """, (rs, row) -> new SeasonalEffectSettings(
                SeasonalEffect.valueOf(rs.getString("effect")),
                rs.getObject("updated_at", OffsetDateTime.class)
        ));
    }

    SeasonalEffectSettings update(SeasonalEffect effect, UUID actor) {
        return jdbc.queryForObject("""
                UPDATE private.website_effect_settings
                   SET effect = ?, updated_by = ?, updated_at = clock_timestamp()
                 WHERE id = 1
                 RETURNING effect, updated_at
                """, (rs, row) -> new SeasonalEffectSettings(
                SeasonalEffect.valueOf(rs.getString("effect")),
                rs.getObject("updated_at", OffsetDateTime.class)
        ), effect.name(), actor);
    }
}
