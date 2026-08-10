package com.fujipp.backend.runtime;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminRuntimeRepository {
    private final JdbcTemplate jdbc;
    public AdminRuntimeRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<AdminRuntimeResponses.Plan> plans(){return jdbc.query("""
        SELECT id,code,name,duration_days,price_satang,currency,is_active,sort_order
          FROM shop.runtime_plans ORDER BY sort_order,duration_days
        """,(rs,n)->new AdminRuntimeResponses.Plan(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),
            rs.getInt(4),rs.getLong(5),rs.getString(6),rs.getBoolean(7),rs.getInt(8)));}
    public Optional<AdminRuntimeResponses.Plan> findPlan(UUID id){return plans().stream().filter(x->x.id().equals(id)).findFirst();}
    public boolean updatePlan(UUID id,AdminRuntimeRequests.UpdatePlanRequest r){return jdbc.update("""
        UPDATE shop.runtime_plans SET name=?,duration_days=?,price_satang=?,is_active=?,sort_order=?,updated_at=now() WHERE id=?
        """,r.name().trim(),r.durationDays(),r.priceSatang(),r.active(),r.sortOrder(),id)==1;}
    public List<AdminRuntimeResponses.Subscription> subscriptions(UUID owner){
        String sql="""
            SELECT s.id,slot.slot_number,s.owner_user_id,COALESCE(p.display_name,p.username,'User'),
                   s.plan_id,plan.name,s.bot_id,bot.name,s.status::text,s.auto_renew,
                   s.current_period_start,s.current_period_end,s.grace_until
              FROM private.runtime_subscriptions s JOIN private.runtime_slots slot ON slot.id=s.runtime_slot_id
              JOIN shop.runtime_plans plan ON plan.id=s.plan_id LEFT JOIN public.profiles p ON p.id=s.owner_user_id
              LEFT JOIN bots.bot_instances bot ON bot.id=s.bot_id
            """+(owner==null?" ORDER BY s.created_at DESC":" WHERE s.owner_user_id=? ORDER BY s.created_at DESC");
        return owner==null?jdbc.query(sql,(rs,n)->map(rs)):jdbc.query(sql,(rs,n)->map(rs),owner);
    }
    public Optional<AdminRuntimeResponses.Subscription> findSubscription(UUID id){return jdbc.query("""
        SELECT s.id,slot.slot_number,s.owner_user_id,COALESCE(p.display_name,p.username,'User'),
               s.plan_id,plan.name,s.bot_id,bot.name,s.status::text,s.auto_renew,
               s.current_period_start,s.current_period_end,s.grace_until
          FROM private.runtime_subscriptions s JOIN private.runtime_slots slot ON slot.id=s.runtime_slot_id
          JOIN shop.runtime_plans plan ON plan.id=s.plan_id LEFT JOIN public.profiles p ON p.id=s.owner_user_id
          LEFT JOIN bots.bot_instances bot ON bot.id=s.bot_id WHERE s.id=?
        """,(rs,n)->map(rs),id).stream().findFirst();}
    public UUID grant(UUID owner,UUID plan,UUID bot,OffsetDateTime end,boolean autoRenew){return jdbc.queryForObject("""
        WITH selected_plan AS (SELECT id,duration_days FROM shop.runtime_plans WHERE id=?),
        selected_slot AS (SELECT slot.id FROM private.runtime_slots slot WHERE slot.is_enabled AND NOT EXISTS(
          SELECT 1 FROM private.runtime_subscriptions s WHERE s.runtime_slot_id=slot.id AND s.status IN ('ACTIVE','GRACE'))
          ORDER BY slot.slot_number FOR UPDATE SKIP LOCKED LIMIT 1), inserted AS (
          INSERT INTO private.runtime_subscriptions(owner_user_id,runtime_slot_id,plan_id,bot_id,auto_renew,current_period_end)
          SELECT ?,slot.id,plan.id,?,?,COALESCE(?,now()+make_interval(days=>plan.duration_days)) FROM selected_slot slot CROSS JOIN selected_plan plan
          RETURNING id) SELECT id FROM inserted
        """,UUID.class,plan,owner,bot,autoRenew,end);}
    public boolean updateSubscription(UUID id,String status,AdminRuntimeRequests.UpdateSubscriptionRequest r){
        OffsetDateTime grace="GRACE".equals(status)?r.periodEnd().plusHours(3):null;
        return jdbc.update("""
            UPDATE private.runtime_subscriptions s SET status=?::private.runtime_subscription_status,plan_id=?,bot_id=?,
                   auto_renew=?,current_period_end=?,grace_until=?,updated_at=now()
             WHERE id=? AND EXISTS(SELECT 1 FROM shop.runtime_plans WHERE id=?)
               AND (? IS NULL OR EXISTS(SELECT 1 FROM bots.bot_instances b WHERE b.id=? AND b.owner_user_id=s.owner_user_id AND b.status<>'DECOMMISSIONED'))
            """,status,r.planId(),r.botId(),r.autoRenew(),r.periodEnd(),grace,id,r.planId(),r.botId(),r.botId())==1;
    }
    private AdminRuntimeResponses.Subscription map(java.sql.ResultSet rs)throws java.sql.SQLException{return new AdminRuntimeResponses.Subscription(
        rs.getObject(1,UUID.class),rs.getInt(2),rs.getObject(3,UUID.class),rs.getString(4),rs.getObject(5,UUID.class),rs.getString(6),
        rs.getObject(7,UUID.class),rs.getString(8),rs.getString(9),rs.getBoolean(10),rs.getObject(11,OffsetDateTime.class),
        rs.getObject(12,OffsetDateTime.class),rs.getObject(13,OffsetDateTime.class));}
}
