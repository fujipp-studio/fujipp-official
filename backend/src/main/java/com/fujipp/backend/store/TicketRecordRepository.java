package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

@Repository
class TicketRecordRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    TicketRecordRepository(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    record Entry(UUID installationId, String channelId, String name, JsonNode state, JsonNode messages, boolean archived) {}
    private Entry entry(java.sql.ResultSet rs,int n) throws java.sql.SQLException {
        return new Entry(rs.getObject("installation_id",UUID.class),rs.getString("channel_id"),rs.getString("name"),json.readTree(rs.getString("state")),
            rs.getString("messages")==null?null:json.readTree(rs.getString("messages")),rs.getBoolean("archived"));
    }
    List<Entry> list(UUID botId) {
        return jdbc.query("SELECT installation_id,channel_id,name,state::text,NULL::text AS messages,archived_at IS NOT NULL AS archived FROM private.ticket_channels WHERE bot_id=? ORDER BY (state->>'openedAt')::bigint DESC,channel_id", this::entry, botId);
    }
    Optional<Entry> find(UUID botId, String channelId) {
        return jdbc.query("SELECT installation_id,channel_id,name,state::text,messages::text,archived_at IS NOT NULL AS archived FROM private.ticket_channels WHERE bot_id=? AND channel_id=?",this::entry,botId,channelId).stream().findFirst();
    }
    void save(UUID botId, UUID installationId, String channelId, String name, JsonNode state) {
        int changed=jdbc.update("""
            INSERT INTO private.ticket_channels(bot_id,installation_id,channel_id,name,state)
            VALUES (?,?,?,?,?::jsonb)
            ON CONFLICT(bot_id,channel_id) DO UPDATE SET name=EXCLUDED.name,state=EXCLUDED.state,updated_at=now()
            WHERE private.ticket_channels.installation_id=EXCLUDED.installation_id
              AND private.ticket_channels.state->>'ownerId'=EXCLUDED.state->>'ownerId'
              AND private.ticket_channels.state->>'categoryKey'=EXCLUDED.state->>'categoryKey'
              AND private.ticket_channels.state->>'openedAt'=EXCLUDED.state->>'openedAt'
              AND (private.ticket_channels.state->>'status'<>'CLOSED' OR EXCLUDED.state->>'status'='CLOSED' OR private.ticket_channels.messages IS NULL)
            """,botId,installationId,channelId,name,state.toString());
        if (changed!=1) throw new StoreValidationException("Ticket identity cannot change");
    }
    void archive(UUID botId, UUID installationId, String channelId, JsonNode messages) {
        int changed=jdbc.update("""
            UPDATE private.ticket_channels SET messages=?::jsonb,archived_at=now(),updated_at=now()
            WHERE bot_id=? AND installation_id=? AND channel_id=? AND state->>'status'='CLOSING'
            """,messages.toString(),botId,installationId,channelId);
        if (changed!=1) throw new StoreValidationException("Ticket must be closing before archiving");
    }
}
