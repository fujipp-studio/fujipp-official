package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
class TicketCounterService {
    private final JdbcTemplate jdbc;
    TicketCounterService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    record Counter(int nextNumber, boolean exhausted) {}
    Counter read(UUID botId) {
        var values=jdbc.queryForList("SELECT next_value FROM private.ticket_counters WHERE bot_id=?",Integer.class,botId);
        int next=values.isEmpty()?0:values.getFirst();
        return new Counter(next,next>99999);
    }
    Counter reset(UUID botId,int next) {
        if(next<0||next>99999) throw new StoreValidationException("Ticket number must be 0–99999");
        jdbc.update("""
            INSERT INTO private.ticket_counters(bot_id,next_value) VALUES (?,?)
            ON CONFLICT(bot_id) DO UPDATE SET next_value=EXCLUDED.next_value,updated_at=now()
            """,botId,next);
        return new Counter(next,false);
    }
    int reserve(UUID botId) {
        var values=jdbc.query("""
            INSERT INTO private.ticket_counters(bot_id,next_value) VALUES (?,1)
            ON CONFLICT(bot_id) DO UPDATE SET next_value=private.ticket_counters.next_value+1,updated_at=now()
            WHERE private.ticket_counters.next_value<=99999
            RETURNING next_value-1
            """,(rs,n)->rs.getInt(1),botId);
        if(values.isEmpty()) throw new StoreValidationException("Ticket numbers reached 99999; reset the counter in bot settings");
        return values.getFirst();
    }
}
