package com.fujipp.backend.runtime;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class RuntimeSlotRepository {
    private final JdbcTemplate jdbc;

    public RuntimeSlotRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<RuntimePlanResponse> plans() {
        return jdbc.query("""
            SELECT id,code,name,duration_days,price_satang,currency
              FROM shop.runtime_plans WHERE is_active ORDER BY sort_order, duration_days
            """, (rs,n) -> new RuntimePlanResponse(rs.getObject(1,UUID.class),rs.getString(2),
                rs.getString(3),rs.getInt(4),rs.getLong(5),rs.getString(6)));
    }

    public int availableSlots() {
        return jdbc.queryForObject("""
            SELECT count(*) FROM private.runtime_slots slot WHERE slot.is_enabled
              AND NOT EXISTS (SELECT 1 FROM private.runtime_subscriptions subscription
                WHERE subscription.runtime_slot_id=slot.id AND subscription.status IN ('ACTIVE','GRACE'))
            """, Integer.class);
    }

    public RuntimeAvailabilityResponse availability() {
        List<RuntimeAvailabilityResponse.Slot> slots = jdbc.query("""
            SELECT slot.slot_number,
                   CASE WHEN subscription.id IS NULL THEN 'AVAILABLE' ELSE 'OCCUPIED' END
              FROM private.runtime_slots slot
              LEFT JOIN private.runtime_subscriptions subscription
                ON subscription.runtime_slot_id=slot.id
               AND subscription.status IN ('ACTIVE','GRACE')
             WHERE slot.is_enabled ORDER BY slot.slot_number
            """, (rs,n) -> new RuntimeAvailabilityResponse.Slot(rs.getInt(1),rs.getString(2)));
        int used = (int) slots.stream().filter(slot -> "OCCUPIED".equals(slot.occupancy())).count();
        return new RuntimeAvailabilityResponse(slots.size(), used, slots.size()-used, slots);
    }

    public List<RuntimeSubscriptionResponse> subscriptions(UUID ownerId) {
        return jdbc.query("""
            SELECT subscription.id,slot.slot_number,plan.id,plan.name,plan.duration_days,
                   plan.price_satang,plan.currency,subscription.bot_id,bot.name,
                   subscription.status::text,subscription.auto_renew,
                   subscription.current_period_end,subscription.grace_until
              FROM private.runtime_subscriptions subscription
              JOIN private.runtime_slots slot ON slot.id=subscription.runtime_slot_id
              JOIN shop.runtime_plans plan ON plan.id=subscription.plan_id
              LEFT JOIN bots.bot_instances bot ON bot.id=subscription.bot_id
             WHERE subscription.owner_user_id=? ORDER BY subscription.created_at DESC
            """, (rs,n) -> new RuntimeSubscriptionResponse(rs.getObject(1,UUID.class),rs.getInt(2),
                rs.getObject(3,UUID.class),rs.getString(4),rs.getInt(5),rs.getLong(6),rs.getString(7),
                rs.getObject(8,UUID.class),rs.getString(9),rs.getString(10),rs.getBoolean(11),
                rs.getObject(12,java.time.OffsetDateTime.class),rs.getObject(13,java.time.OffsetDateTime.class)), ownerId);
    }

    public UUID purchase(UUID ownerId, UUID planId) {
        return jdbc.queryForObject("SELECT private.purchase_runtime_subscription(?,?)", UUID.class, ownerId, planId);
    }

    public boolean assign(UUID subscriptionId, UUID ownerId, UUID botId) {
        return jdbc.update("""
            UPDATE private.runtime_subscriptions subscription SET bot_id=?,updated_at=now()
             WHERE subscription.id=? AND subscription.owner_user_id=?
               AND subscription.status IN ('ACTIVE','GRACE')
               AND EXISTS (SELECT 1 FROM bots.bot_instances bot WHERE bot.id=?
                   AND bot.owner_user_id=? AND bot.status<>'DECOMMISSIONED')
            """, botId,subscriptionId,ownerId,botId,ownerId) > 0;
    }

    public boolean setAutoRenew(UUID subscriptionId, UUID ownerId, boolean enabled) {
        return jdbc.update("UPDATE private.runtime_subscriptions SET auto_renew=?,updated_at=now() WHERE id=? AND owner_user_id=? AND status IN ('ACTIVE','GRACE')",
                enabled,subscriptionId,ownerId) > 0;
    }

    public boolean renew(UUID subscriptionId, UUID ownerId) {
        Boolean owned = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM private.runtime_subscriptions WHERE id=? AND owner_user_id=?)", Boolean.class, subscriptionId, ownerId);
        return Boolean.TRUE.equals(owned) && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT private.renew_runtime_subscription(?,true)", Boolean.class, subscriptionId));
    }

    public boolean hasRunnableRuntime(UUID botId, UUID ownerId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM private.runtime_subscriptions
             WHERE bot_id=? AND owner_user_id=? AND status IN ('ACTIVE','GRACE')
               AND now() < CASE WHEN status='GRACE' THEN grace_until
                                ELSE current_period_end + interval '3 hours' END)
            """, Boolean.class, botId, ownerId));
    }

    public List<UUID> dueAutoRenewals() {
        return jdbc.query("""
            SELECT id FROM private.runtime_subscriptions
             WHERE status IN ('ACTIVE','GRACE') AND auto_renew AND current_period_end<=now()
               AND (last_renewal_attempt_at IS NULL OR last_renewal_attempt_at<now()-interval '5 minutes')
            """, (rs,n)->rs.getObject(1,UUID.class));
    }

    public void renewAutomatically(UUID id) {
        jdbc.queryForObject("SELECT private.renew_runtime_subscription(?,false)", Boolean.class, id);
    }

    public void reconcileExpiry() {
        jdbc.update("""
            UPDATE private.runtime_subscriptions SET status='GRACE',
              grace_until=current_period_end+interval '3 hours',updated_at=now()
             WHERE status='ACTIVE' AND current_period_end<=now()
            """);
        jdbc.update("""
            WITH expired AS (
              UPDATE private.runtime_subscriptions SET status='EXPIRED',updated_at=now()
               WHERE status='GRACE' AND grace_until<=now() RETURNING bot_id
            )
            UPDATE bots.bot_instances SET desired_state='STOPPED'
             WHERE id IN (SELECT bot_id FROM expired WHERE bot_id IS NOT NULL)
            """);
    }
}
