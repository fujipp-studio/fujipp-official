package com.fujipp.backend.spending;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public class MemberSpendingRepository {
    private final JdbcTemplate jdbc;
    public MemberSpendingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Entry add(UUID botId,String memberId,long delta){return jdbc.queryForObject("""
        INSERT INTO private.member_spending(bot_id,member_discord_id,amount_satang,tx_count)
        VALUES(?,?,?,1) ON CONFLICT(bot_id,member_discord_id) DO UPDATE SET
        amount_satang=private.member_spending.amount_satang+EXCLUDED.amount_satang,
        tx_count=private.member_spending.tx_count+1,updated_at=now()
        RETURNING member_discord_id,amount_satang,tx_count""",mapper(),botId,memberId,delta);}
    public Entry set(UUID botId,String memberId,Long amount,Integer count){return jdbc.queryForObject("""
        INSERT INTO private.member_spending(bot_id,member_discord_id,amount_satang,tx_count)
        VALUES(?,?,COALESCE(?,0),COALESCE(?,0)) ON CONFLICT(bot_id,member_discord_id) DO UPDATE SET
        amount_satang=COALESCE(?,private.member_spending.amount_satang),
        tx_count=COALESCE(?,private.member_spending.tx_count),updated_at=now()
        RETURNING member_discord_id,amount_satang,tx_count""",mapper(),botId,memberId,amount,count,amount,count);}
    public Entry get(UUID botId,String memberId){return jdbc.query("SELECT member_discord_id,amount_satang,tx_count FROM private.member_spending WHERE bot_id=? AND member_discord_id=?",mapper(),botId,memberId).stream().findFirst().orElse(null);}
    public boolean remove(UUID botId,String memberId){return jdbc.update("DELETE FROM private.member_spending WHERE bot_id=? AND member_discord_id=?",botId,memberId)>0;}
    public List<Entry> leaderboard(UUID botId,int limit){return jdbc.query("SELECT member_discord_id,amount_satang,tx_count FROM private.member_spending WHERE bot_id=? ORDER BY amount_satang DESC,tx_count DESC,member_discord_id LIMIT ?",mapper(),botId,limit);}
    public Totals totals(UUID botId){return jdbc.queryForObject("SELECT COALESCE(sum(amount_satang),0),COALESCE(sum(tx_count),0) FROM private.member_spending WHERE bot_id=?",(rs,row)->new Totals(rs.getLong(1),rs.getLong(2)),botId);}
    private org.springframework.jdbc.core.RowMapper<Entry> mapper(){return(rs,row)->new Entry(rs.getString(1),rs.getLong(2),rs.getInt(3));}
    public record Entry(String memberDiscordId,long amountSatang,int txCount){}
    public record Totals(long amountSatang,long txCount){}
}
