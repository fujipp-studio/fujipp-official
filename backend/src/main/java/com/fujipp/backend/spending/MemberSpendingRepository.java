package com.fujipp.backend.spending;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Repository
public class MemberSpendingRepository {
    private final JdbcTemplate jdbc;
    public MemberSpendingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public MemberSpendingMonthlySettings monthlySettings(UUID botId) {
        return jdbc.queryForObject("""
            SELECT COALESCE(bool_or(CASE WHEN d.config_key='SPENDING_MONTHLY_ENABLED'
                       THEN COALESCE(v.value,d.default_value)='true'::jsonb ELSE false END),false),
                   COALESCE(max(CASE WHEN d.config_key='SPENDING_MONTHLY_START_DAY'
                       THEN (COALESCE(v.value,d.default_value)::text)::integer END),1)
              FROM private.bot_feature_installations i
              JOIN shop.feature_products p ON p.id=i.feature_product_id AND p.code='member-spending'
              JOIN private.feature_config_sets c ON c.license_id=i.license_id
              JOIN shop.feature_config_definitions d ON d.feature_version_id=c.feature_version_id
              LEFT JOIN private.feature_config_values v ON v.config_set_id=c.id AND v.definition_id=d.id
             WHERE i.bot_id=? AND i.removed_at IS NULL
               AND d.config_key IN ('SPENDING_MONTHLY_ENABLED','SPENDING_MONTHLY_START_DAY')
            """, (rs,row)->new MemberSpendingMonthlySettings(rs.getBoolean(1),rs.getInt(2)),botId);
    }

    // The caller owns the transaction. Serialize even the first write and deletion of a member.
    private void lock(UUID botId, String memberId) {
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?::text || ':' || ?, 0))", Object.class, botId, memberId);
        jdbc.query("SELECT member_discord_id FROM private.member_spending WHERE bot_id=? AND member_discord_id=? FOR UPDATE",
            (rs, row) -> rs.getString(1), botId, memberId);
    }
    private boolean record(UUID botId, String memberId, String operation, String key, Long amount, Integer count, long delta, int countDelta) {
        var existing = jdbc.query("SELECT member_discord_id, operation, requested_amount, requested_count FROM private.member_spending_operations WHERE bot_id=? AND operation_key=?",
            (rs, row) -> new Object[]{rs.getString(1), rs.getString(2), rs.getObject(3, Long.class), rs.getObject(4, Integer.class)}, botId, key);
        if (!existing.isEmpty()) {
            var e = existing.getFirst();
            if (!Objects.equals(e[0], memberId) || !Objects.equals(e[1], operation) || !Objects.equals(e[2], amount) || !Objects.equals(e[3], count))
                throw new IllegalArgumentException("Operation key already used for a different spending operation");
            return false;
        }
        jdbc.update("""
            INSERT INTO private.member_spending_operations(bot_id,operation_key,member_discord_id,operation,requested_amount,requested_count,amount_delta,count_delta)
            VALUES(?,?,?,?,?,?,?,?)""", botId, key, memberId, operation, amount, count, delta, countDelta);
        return true;
    }
    public Entry add(UUID botId, String memberId, long delta, String key, LocalDate period) {
        lock(botId, memberId);
        if (record(botId, memberId, "ADD", key, delta, null, delta, 1)) {
            jdbc.update("""
                INSERT INTO private.member_spending(bot_id,member_discord_id,amount_satang,tx_count)
                VALUES(?,?,?,1) ON CONFLICT(bot_id,member_discord_id) DO UPDATE SET
                amount_satang=private.member_spending.amount_satang+EXCLUDED.amount_satang,
                tx_count=private.member_spending.tx_count+1,updated_at=now()""", botId, memberId, delta);
            if (period != null) jdbc.update("""
                INSERT INTO private.member_spending_monthly(bot_id,member_discord_id,month,amount_satang,tx_count)
                VALUES(?,?,?,?,1) ON CONFLICT(bot_id,member_discord_id,month) DO UPDATE SET
                amount_satang=private.member_spending_monthly.amount_satang+EXCLUDED.amount_satang,
                tx_count=private.member_spending_monthly.tx_count+1""", botId, memberId, period, delta);
        }
        return get(botId, memberId, null, period);
    }
    public Entry set(UUID botId, String memberId, Long amount, Integer count, String key, LocalDate period) {
        lock(botId, memberId);
        var before = get(botId, memberId, null, period);
        long delta = amount == null ? 0 : amount - (before == null ? 0 : before.amountSatang());
        int countDelta = count == null ? 0 : count - (before == null ? 0 : before.txCount());
        if (record(botId, memberId, "SET", key, amount, count, delta, countDelta)) {
            long monthAmount = 0, monthCount = 0;
            if (period != null) {
                try {
                    monthAmount = Math.addExact(before == null ? 0 : before.thisMonthSatang(), delta);
                } catch (ArithmeticException error) {
                    throw new IllegalArgumentException("ยอดของรอบเดือนปัจจุบันเกินขอบเขตที่รองรับ", error);
                }
                monthCount = (long) (before == null ? 0 : before.thisMonthTxCount()) + countDelta;
                if (monthAmount < 0 || monthCount < 0)
                    throw new IllegalArgumentException("ไม่สามารถแก้ยอดได้ เพราะจะทำให้ยอดหรือจำนวนครั้งของรอบเดือนปัจจุบันติดลบ กรุณาตรวจสอบยอดที่จะตั้ง");
                if (monthCount > Integer.MAX_VALUE)
                    throw new IllegalArgumentException("จำนวนครั้งของรอบเดือนปัจจุบันเกินขอบเขตที่รองรับ");
            }
            jdbc.update("""
                INSERT INTO private.member_spending(bot_id,member_discord_id,amount_satang,tx_count)
                VALUES(?,?,COALESCE(?::bigint,0),COALESCE(?::integer,0)) ON CONFLICT(bot_id,member_discord_id) DO UPDATE SET
                amount_satang=COALESCE(?,private.member_spending.amount_satang),
                tx_count=COALESCE(?,private.member_spending.tx_count),updated_at=now()""", botId, memberId, amount, count, amount, count);
            if (period != null && (delta != 0 || countDelta != 0)) jdbc.update("""
                INSERT INTO private.member_spending_monthly(bot_id,member_discord_id,month,amount_satang,tx_count)
                VALUES(?,?,?,?,?) ON CONFLICT(bot_id,member_discord_id,month) DO UPDATE SET
                amount_satang=EXCLUDED.amount_satang,tx_count=EXCLUDED.tx_count""", botId, memberId, period, monthAmount, (int) monthCount);
        }
        return get(botId, memberId, null, period);
    }
    public boolean remove(UUID botId, String memberId, String key) {
        lock(botId, memberId);
        var before = get(botId, memberId, null, null);
        if (!record(botId, memberId, "DELETE", key, null, null,
                before == null ? 0 : -before.amountSatang(), before == null ? 0 : -before.txCount())) return false;
        return jdbc.update("DELETE FROM private.member_spending WHERE bot_id=? AND member_discord_id=?", botId, memberId) > 0;
    }
    private String select(LocalDate month, LocalDate period) {
        return "SELECT s.member_discord_id," + (month == null ? "s.amount_satang,s.tx_count" : "COALESCE(p.amount_satang,0),COALESCE(p.tx_count,0)") +
            ",COALESCE(c.amount_satang,0),COALESCE(c.tx_count,0) FROM private.member_spending s " +
            "LEFT JOIN private.member_spending_monthly c ON c.bot_id=s.bot_id AND c.member_discord_id=s.member_discord_id AND c.month=" + (period == null ? "NULL::date" : "DATE '" + period + "'") +
            (month == null ? "" : " LEFT JOIN private.member_spending_monthly p ON p.bot_id=s.bot_id AND p.member_discord_id=s.member_discord_id AND p.month=DATE '" + month + "'");
    }
    public Entry get(UUID botId, String memberId, LocalDate month, LocalDate period) {
        return jdbc.query(select(month, period) + " WHERE s.bot_id=? AND s.member_discord_id=?", mapper(), botId, memberId).stream().findFirst().orElse(null);
    }
    public List<Entry> leaderboard(UUID botId, int limit, LocalDate month, LocalDate period) {
        return jdbc.query(select(month, period) + " WHERE s.bot_id=?" + (month == null ? "" : " AND p.amount_satang>0") +
            " ORDER BY 2 DESC,3 DESC,s.member_discord_id LIMIT ?", mapper(), botId, limit);
    }
    public Totals totals(UUID botId, LocalDate month) {
        return month == null
            ? jdbc.queryForObject("SELECT COALESCE(sum(amount_satang),0),COALESCE(sum(tx_count),0) FROM private.member_spending WHERE bot_id=?", (rs,row)->new Totals(rs.getLong(1),rs.getLong(2)),botId)
            : jdbc.queryForObject("SELECT COALESCE(sum(amount_satang),0),COALESCE(sum(tx_count),0) FROM private.member_spending_monthly WHERE bot_id=? AND month=?", (rs,row)->new Totals(rs.getLong(1),rs.getLong(2)),botId,month);
    }
    private org.springframework.jdbc.core.RowMapper<Entry> mapper() {
        return (rs,row)->new Entry(rs.getString(1),rs.getLong(2),rs.getInt(3),rs.getLong(4),rs.getInt(5));
    }
    public record Entry(String memberDiscordId,long amountSatang,int txCount,long thisMonthSatang,int thisMonthTxCount) {}
    public record Totals(long amountSatang,long txCount) {}
}
