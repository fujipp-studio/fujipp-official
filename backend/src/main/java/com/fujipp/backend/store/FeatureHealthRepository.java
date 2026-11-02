package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class FeatureHealthRepository {
    private final JdbcTemplate jdbc;
    FeatureHealthRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    boolean botExists(UUID botId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM bots.bot_instances WHERE id=? AND status<>'DECOMMISSIONED')", Boolean.class, botId));
    }

    List<Row> list(UUID botId) {
        return jdbc.query("""
                SELECT i.id,i.license_id,i.owner_user_id,i.status::text,i.last_error_code,i.last_error_message,
                       i.last_error_category,coalesce(i.last_error_at,i.updated_at) AS last_error_at,
                       i.recovery_attempts,i.next_retry_at,p.code,p.name,v.version,l.status::text AS license_status,l.expires_at,
                       b.desired_state::text,b.discord_guild_id,
                       EXISTS(SELECT 1 FROM private.runtime_subscriptions s WHERE s.bot_id=b.id AND s.status IN ('ACTIVE','GRACE')
                         AND now()<CASE WHEN s.status='GRACE' THEN s.grace_until ELSE s.current_period_end+interval '3 hours' END) AS runtime_active
                  FROM private.bot_feature_installations i
                  JOIN shop.feature_products p ON p.id=i.feature_product_id
                  JOIN shop.feature_versions v ON v.id=i.feature_version_id
                  JOIN private.feature_licenses l ON l.id=i.license_id
                  JOIN bots.bot_instances b ON b.id=i.bot_id AND b.owner_user_id=i.owner_user_id
                 WHERE i.bot_id=? AND i.removed_at IS NULL
                 ORDER BY CASE WHEN i.status='ERROR' THEN 0 ELSE 1 END,p.name,i.id
                """, (rs,n) -> new Row(rs.getObject("id",UUID.class),rs.getObject("license_id",UUID.class),rs.getObject("owner_user_id",UUID.class),
                rs.getString("status"),rs.getString("last_error_code"),rs.getString("last_error_message"),rs.getString("last_error_category"),
                rs.getObject("last_error_at",OffsetDateTime.class),rs.getInt("recovery_attempts"),rs.getObject("next_retry_at",OffsetDateTime.class),
                rs.getString("code"),rs.getString("name"),rs.getString("version"),rs.getString("license_status"),rs.getObject("expires_at",OffsetDateTime.class),
                rs.getString("desired_state"),rs.getString("discord_guild_id"),rs.getBoolean("runtime_active")),botId);
    }

    boolean retry(UUID botId, UUID installationId, UUID owner) {
        return jdbc.update("""
                UPDATE private.bot_feature_installations i
                   SET status='INSTALLING',last_error_code=NULL,last_error_message=NULL,last_error_category=NULL,
                       recovery_attempts=0,next_retry_at=NULL
                  FROM private.feature_licenses l,bots.bot_instances b
                 WHERE i.id=? AND i.bot_id=? AND i.owner_user_id=? AND i.status='ERROR' AND i.removed_at IS NULL
                   AND i.last_error_code='FEATURE_ACTIVATION_FAILED' AND l.id=i.license_id AND l.status='ACTIVE'
                   AND (l.expires_at IS NULL OR l.expires_at>now())
                   AND b.id=i.bot_id AND b.owner_user_id=i.owner_user_id AND b.desired_state='RUNNING' AND b.status<>'DECOMMISSIONED'
                   AND EXISTS(SELECT 1 FROM private.runtime_subscriptions s WHERE s.bot_id=b.id AND s.status IN ('ACTIVE','GRACE')
                       AND now()<CASE WHEN s.status='GRACE' THEN s.grace_until ELSE s.current_period_end+interval '3 hours' END)
                """,installationId,botId,owner)==1;
    }

    int retryDue() {
        return jdbc.update("""
                UPDATE private.bot_feature_installations i
                   SET status='INSTALLING',recovery_attempts=recovery_attempts+1,next_retry_at=NULL
                  FROM private.feature_licenses l,bots.bot_instances b,shop.feature_products p
                 WHERE i.status='ERROR' AND i.removed_at IS NULL AND i.last_error_category='TRANSIENT'
                   AND i.last_error_code='FEATURE_ACTIVATION_FAILED' AND i.recovery_attempts<3 AND i.next_retry_at<=now()
                   AND p.id=i.feature_product_id AND p.code IN ('price-reader','bot-presence','review-credit','voice-keeper')
                   AND l.id=i.license_id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>now())
                   AND b.id=i.bot_id AND b.owner_user_id=i.owner_user_id AND b.desired_state='RUNNING' AND b.status<>'DECOMMISSIONED'
                   AND EXISTS(SELECT 1 FROM private.runtime_subscriptions s WHERE s.bot_id=b.id AND s.status IN ('ACTIVE','GRACE')
                       AND now()<CASE WHEN s.status='GRACE' THEN s.grace_until ELSE s.current_period_end+interval '3 hours' END)
                """);
    }

    Optional<Credential> credential(UUID botId) {
        return jdbc.query("SELECT ciphertext,nonce,encryption_key_version FROM private.bot_credentials WHERE bot_id=? AND credential_key='DISCORD_TOKEN'",
                (rs,n)->new Credential(rs.getBytes(1),rs.getBytes(2),rs.getString(3)),botId).stream().findFirst();
    }
    record Credential(byte[] ciphertext,byte[] nonce,String keyVersion) {}
    record Row(UUID id,UUID licenseId,UUID owner,String status,String errorCode,String errorMessage,String category,
               OffsetDateTime lastErrorAt,int attempts,OffsetDateTime nextRetryAt,String code,String name,String version,
               String licenseStatus,OffsetDateTime expiresAt,String desiredState,String guildId,boolean runtimeActive) {
        boolean canRetry() { return status.equals("ERROR") && "FEATURE_ACTIVATION_FAILED".equals(errorCode)
                && licenseStatus.equals("ACTIVE") && (expiresAt==null || expiresAt.isAfter(OffsetDateTime.now())) && desiredState.equals("RUNNING") && runtimeActive; }
        FeatureHealthResponse response() {
            String kind=FeatureFailurePolicy.category(category,errorCode,errorMessage);
            return new FeatureHealthResponse(id,licenseId,code,name,version,status,kind,errorCode,FeatureFailurePolicy.safeMessage(errorMessage),
                    FeatureFailurePolicy.hint(kind),errorCode==null?null:lastErrorAt,attempts,nextRetryAt,canRetry());
        }
    }
}
