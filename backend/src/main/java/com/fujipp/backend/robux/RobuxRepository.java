package com.fujipp.backend.robux;

import tools.jackson.databind.ObjectMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Repository
class RobuxRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    RobuxRepository(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}

    boolean featureActive(UUID botId){
        Boolean active=jdbc.queryForObject("""
          SELECT EXISTS(SELECT 1 FROM private.bot_feature_installations i
          JOIN private.feature_licenses l ON l.id=i.license_id AND l.status='ACTIVE'
            AND (l.expires_at IS NULL OR l.expires_at>now())
          JOIN shop.feature_products p ON p.id=i.feature_product_id AND p.code='roblox-robux-payout'
          WHERE i.bot_id=? AND i.status='ACTIVE' AND i.removed_at IS NULL)
          """,Boolean.class,botId);
        return Boolean.TRUE.equals(active);
    }

    @Transactional
    RobuxResponses.Job begin(RobuxRequests.Begin request){
        try {
            BeginResult result=jdbc.queryForObject("""
              SELECT job_id,balance_satang,created FROM private.begin_robux_payout(?,?,?,?,?,?,?,?,?)
              """,(rs,n)->new BeginResult(rs.getObject(1,UUID.class),rs.getLong(2),rs.getBoolean(3)),
              request.botId(),request.memberDiscordId(),request.robloxUserId(),request.robloxUsername(),
              request.groupKey(),request.groupId(),request.robuxAmount(),request.priceSatang(),request.idempotencyKey());
            return find(request.botId(),Objects.requireNonNull(result).id(),result.balance(),result.created());
        } catch(DataAccessException error){
            String message=Optional.ofNullable(error.getMostSpecificCause()).map(Throwable::getMessage).orElse(error.getMessage());
            if(message!=null&&message.contains("insufficient wallet balance")) throw new RobuxException("INSUFFICIENT_FUNDS","ยอดเงินในกระเป๋าไม่เพียงพอ");
            if(message!=null&&message.contains("idempotency conflict")) throw new RobuxException("IDEMPOTENCY_CONFLICT","คำขอซ้ำมีข้อมูลไม่ตรงกับรายการเดิม");
            throw error;
        }
    }

    Optional<RobuxResponses.Job> claim(UUID botId,UUID jobId){
        int changed=jdbc.update("""
          UPDATE private.robux_payout_jobs SET status='PROCESSING',processing_started_at=now()
          WHERE id=? AND bot_id=? AND status='DEBITED'
          """,jobId,botId);
        if(changed==0)return Optional.empty();
        return Optional.of(find(botId,jobId,balance(botId,member(botId,jobId)),false));
    }

    RobuxResponses.Outcome outcome(UUID botId,UUID jobId,RobuxRequests.Outcome body){
        String resultJson;
        try{resultJson=json.writeValueAsString(body.result());}catch(Exception error){throw new RobuxException("INVALID_RESULT","ผลลัพธ์ไม่ถูกต้อง");}
        int changed=jdbc.update("""
          UPDATE private.robux_payout_jobs SET status=?::private.robux_payout_status,result=?::jsonb,
            error_code=?,error_message=?,completed_at=CASE WHEN ?='SUCCEEDED' THEN now() ELSE NULL END
          WHERE id=? AND bot_id=? AND status='PROCESSING'
          """,body.status(),resultJson,body.errorCode(),body.errorMessage(),body.status(),jobId,botId);
        if(changed==0)throw new RobuxException("INVALID_JOB_STATE","ไม่สามารถเปลี่ยนสถานะรายการได้");
        return new RobuxResponses.Outcome(jobId,body.status(),body.result());
    }

    RobuxResponses.Refund refund(UUID botId,UUID jobId,RobuxRequests.Failure body){
        try {
            RefundResult result=jdbc.queryForObject("SELECT balance_satang,created FROM private.refund_robux_payout(?,?,?,?)",
              (rs,n)->new RefundResult(rs.getLong(1),rs.getBoolean(2)),botId,jobId,body.errorCode(),body.errorMessage());
            return new RobuxResponses.Refund(jobId,Objects.requireNonNull(result).balance(),result.created(),"REFUNDED");
        }catch(DataAccessException error){throw new RobuxException("INVALID_JOB_STATE","ไม่สามารถคืนเงินรายการนี้ได้");}
    }

    RobuxResponses.Recoverable recoverable(UUID botId){
        List<RobuxResponses.Job> jobs=jdbc.query("""
          SELECT j.id,j.member_discord_id,j.roblox_user_id,j.roblox_username,j.group_key,j.group_id,
            j.robux_amount,j.price_satang,j.status::text,w.balance_satang,j.created_at
          FROM private.robux_payout_jobs j JOIN private.member_wallets w
            ON w.bot_id=j.bot_id AND w.member_discord_id=j.member_discord_id
          WHERE j.bot_id=? AND j.status IN ('DEBITED','PROCESSING') ORDER BY j.created_at
          """,(rs,n)->new RobuxResponses.Job(rs.getObject(1,UUID.class),rs.getString(2),rs.getLong(3),rs.getString(4),
            rs.getString(5),rs.getLong(6),rs.getLong(7),rs.getLong(8),rs.getString(9),rs.getLong(10),false,
            rs.getObject(11,OffsetDateTime.class)),botId);
        return new RobuxResponses.Recoverable(jobs);
    }

    private RobuxResponses.Job find(UUID botId,UUID jobId,long balance,boolean created){
        return jdbc.queryForObject("""
          SELECT id,member_discord_id,roblox_user_id,roblox_username,group_key,group_id,
            robux_amount,price_satang,status::text,created_at FROM private.robux_payout_jobs WHERE bot_id=? AND id=?
          """,(rs,n)->new RobuxResponses.Job(rs.getObject(1,UUID.class),rs.getString(2),rs.getLong(3),rs.getString(4),
            rs.getString(5),rs.getLong(6),rs.getLong(7),rs.getLong(8),rs.getString(9),balance,created,
            rs.getObject(10,OffsetDateTime.class)),botId,jobId);
    }
    private String member(UUID botId,UUID jobId){return jdbc.queryForObject("SELECT member_discord_id FROM private.robux_payout_jobs WHERE bot_id=? AND id=?",String.class,botId,jobId);}
    private long balance(UUID botId,String memberId){Long value=jdbc.queryForObject("SELECT balance_satang FROM private.member_wallets WHERE bot_id=? AND member_discord_id=?",Long.class,botId,memberId);return value==null?0:value;}
    record BeginResult(UUID id,long balance,boolean created){}
    record RefundResult(long balance,boolean created){}
}
