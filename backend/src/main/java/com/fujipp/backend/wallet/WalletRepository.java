package com.fujipp.backend.wallet;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class WalletRepository {
    private final JdbcTemplate jdbc;
    WalletRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    long balance(UUID botId, String memberId) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE((SELECT balance_satang FROM private.member_wallets WHERE bot_id=? AND member_discord_id=?),0)",
                Long.class, botId, memberId);
        return value == null ? 0 : value;
    }

    Optional<Settings> settings(UUID botId) {
        List<Settings> rows = jdbc.query("""
            SELECT
              max(CASE WHEN d.config_key='MIN_TOPUP_SATANG' THEN (COALESCE(v.value,d.default_value) #>> '{}')::bigint END) min_amount,
              max(CASE WHEN d.config_key='TRUEMONEY_FEE_SATANG' THEN (COALESCE(v.value,d.default_value) #>> '{}')::bigint END) voucher_fee,
              max(CASE WHEN d.config_key='TRUEMONEY_FEE_MODE' THEN COALESCE(v.value,d.default_value) #>> '{}' END) voucher_fee_mode,
              max(CASE WHEN d.config_key='TRUEMONEY_FEE_PERCENT' THEN (COALESCE(v.value,d.default_value) #>> '{}')::integer END) voucher_fee_percent,
              max(CASE WHEN d.config_key='PROMPTPAY_ID' THEN v.value #>> '{}' END) promptpay_id,
              max(CASE WHEN d.config_key='PROMPTPAY_ACCOUNT_NAME' THEN v.value #>> '{}' END) account_name,
              max(CASE WHEN d.config_key='PROMPTPAY_QR_EXPIRY_MINUTES' THEN (COALESCE(v.value,d.default_value) #>> '{}')::integer END) qr_expiry_minutes,
              max(CASE WHEN d.config_key='SLIPOK_BRANCH_ID' THEN encode(s.ciphertext,'base64') END) branch_cipher,
              max(CASE WHEN d.config_key='SLIPOK_BRANCH_ID' THEN encode(s.nonce,'base64') END) branch_nonce,
              max(CASE WHEN d.config_key='SLIPOK_BRANCH_ID' THEN s.encryption_key_version END) branch_version,
              max(CASE WHEN d.config_key='SLIPOK_API_KEY' THEN encode(s.ciphertext,'base64') END) key_cipher,
              max(CASE WHEN d.config_key='SLIPOK_API_KEY' THEN encode(s.nonce,'base64') END) key_nonce,
              max(CASE WHEN d.config_key='SLIPOK_API_KEY' THEN s.encryption_key_version END) key_version
            FROM private.bot_feature_installations i
            JOIN private.feature_licenses l ON l.id=i.license_id AND l.status='ACTIVE'
              AND (l.expires_at IS NULL OR l.expires_at > now())
            JOIN shop.feature_products p ON p.id=i.feature_product_id AND p.code='wallet-topup'
            JOIN private.feature_config_sets c ON c.license_id=l.id
            JOIN shop.feature_config_definitions d ON d.feature_version_id=c.feature_version_id
            LEFT JOIN private.feature_config_values v ON v.config_set_id=c.id AND v.definition_id=d.id
            LEFT JOIN private.feature_secret_values s ON s.config_set_id=c.id AND s.definition_id=d.id
            WHERE i.bot_id=? AND i.status='ACTIVE' AND i.removed_at IS NULL
            HAVING count(*) > 0
            """, (rs,n) -> new Settings(
                rs.getObject("min_amount", Long.class), rs.getObject("voucher_fee", Long.class),
                rs.getString("voucher_fee_mode"), rs.getObject("voucher_fee_percent", Integer.class),
                rs.getString("promptpay_id"), rs.getString("account_name"),
                rs.getObject("qr_expiry_minutes", Integer.class),
                bytes(rs.getString("branch_cipher")), bytes(rs.getString("branch_nonce")), rs.getString("branch_version"),
                bytes(rs.getString("key_cipher")), bytes(rs.getString("key_nonce")), rs.getString("key_version")
        ), botId);
        return rows.stream().findFirst();
    }

    PromptSession createPromptPay(WalletRequests.CreatePromptPay request, int expiryMinutes) {
        return jdbc.queryForObject("""
            INSERT INTO private.topup_sessions (bot_id,member_discord_id,method,requested_satang,expires_at)
            VALUES (?,?,'SLIPOK',?,now()+(? * interval '1 minute'))
            RETURNING id,requested_satang,expires_at
            """, (rs,n) -> new PromptSession(rs.getObject(1,UUID.class),rs.getLong(2),rs.getObject(3,OffsetDateTime.class)),
            request.botId(), request.memberDiscordId(), request.amountSatang(), expiryMinutes);
    }

    Optional<PromptSession> pendingSession(UUID id, UUID botId, String memberId) {
        List<PromptSession> rows = jdbc.query("""
            SELECT id,requested_satang,expires_at FROM private.topup_sessions
            WHERE (?::uuid IS NULL OR id=?) AND bot_id=? AND member_discord_id=? AND method='SLIPOK'
              AND status='PENDING' AND expires_at>now()
            ORDER BY created_at DESC LIMIT 1
            """, (rs,n)->new PromptSession(rs.getObject(1,UUID.class),rs.getLong(2),rs.getObject(3,OffsetDateTime.class)),
            id,id,botId,memberId);
        return rows.stream().findFirst();
    }

    @Transactional
    WalletResponses.Topup settle(UUID sessionId, UUID botId, String memberId, long amount,
                                 String reference, String idempotency, String method) {
        Credit credit = jdbc.queryForObject(
                "SELECT entry_id,balance_satang,created FROM private.credit_member_wallet(?,?,?,?::private.topup_method,?,?,?::jsonb)",
                (rs,n)->new Credit(rs.getObject(1,UUID.class),rs.getLong(2),rs.getBoolean(3)),
                botId,memberId,amount,method,reference,idempotency,"{\"provider\":\""+method+"\"}");
        if (sessionId != null) jdbc.update("""
            UPDATE private.topup_sessions SET status='SUCCEEDED',external_reference=?,completed_at=now()
            WHERE id=? AND status IN ('PENDING','PROCESSING')
            """, reference, sessionId);
        return new WalletResponses.Topup(credit.id(),amount,credit.balance(),"THB",method,credit.created(),OffsetDateTime.now());
    }

    @Transactional
    WalletResponses.Adjustment adjust(WalletRequests.Adjustment request) {
        Adjustment result = jdbc.queryForObject(
                "SELECT entry_id,amount_satang,balance_satang,created FROM private.adjust_member_wallet(?,?,?,?,?,?,?)",
                (rs,n) -> new Adjustment(rs.getObject(1,UUID.class),rs.getLong(2),rs.getLong(3),rs.getBoolean(4)),
                request.botId(), request.memberDiscordId(), request.operation(), request.amountSatang(),
                request.actorDiscordId(), request.reason(), request.idempotencyKey());
        return new WalletResponses.Adjustment(result.id(), result.amount(), result.balance(), "THB",
                request.operation(), result.created(), OffsetDateTime.now());
    }

    WalletResponses.History history(UUID botId, String memberId, int limit) {
        List<WalletResponses.HistoryEntry> entries=jdbc.query("""
            SELECT id,kind::text,amount_satang,balance_after_satang,
                   COALESCE(method::text,''),COALESCE(metadata->>'reason',metadata->>'provider',''),created_at
              FROM private.member_wallet_entries
             WHERE bot_id=? AND member_discord_id=?
             ORDER BY created_at DESC LIMIT ?
            """,(rs,n)->new WalletResponses.HistoryEntry(rs.getObject(1,UUID.class),rs.getString(2),
                rs.getLong(3),rs.getLong(4),rs.getString(5),rs.getString(6),
                rs.getObject(7,OffsetDateTime.class)),botId,memberId,limit);
        return new WalletResponses.History(entries,"THB");
    }

    WalletResponses.MonthlySummary monthlySummary(UUID botId, String memberId) {
        return jdbc.queryForObject("""
            SELECT COALESCE(sum(amount_satang),0),count(*),count(DISTINCT member_discord_id)
              FROM private.member_wallet_entries
             WHERE bot_id=? AND kind='TOPUP' AND amount_satang>0
               AND created_at>=now()-interval '1 month'
               AND (?::text IS NULL OR member_discord_id=?::text)
            """,(rs,n)->new WalletResponses.MonthlySummary(rs.getLong(1),rs.getLong(2),rs.getLong(3),"THB"),
            botId,memberId,memberId);
    }

    WalletResponses.Leaderboard leaderboard(UUID botId, int limit) {
        List<WalletResponses.LeaderboardEntry> entries=jdbc.query("""
            SELECT member_discord_id,sum(amount_satang) total,count(*) entries
              FROM private.member_wallet_entries
             WHERE bot_id=? AND kind='TOPUP' AND amount_satang>0
             GROUP BY member_discord_id
             ORDER BY total DESC,member_discord_id LIMIT ?
            """,(rs,n)->new WalletResponses.LeaderboardEntry(rs.getString(1),rs.getLong(2),rs.getLong(3)),botId,limit);
        return new WalletResponses.Leaderboard(entries,"THB");
    }

    private static byte[] bytes(String value) { return value == null ? null : java.util.Base64.getDecoder().decode(value); }
    record Settings(Long minimum, Long voucherFee, String voucherFeeMode, Integer voucherFeePercent,
                    String promptPayId, String accountName, Integer qrExpiryMinutes,
                    byte[] branchCipher, byte[] branchNonce, String branchVersion,
                    byte[] keyCipher, byte[] keyNonce, String keyVersion) {}
    record PromptSession(UUID id,long amount,OffsetDateTime expiresAt) {}
    record Credit(UUID id,long balance,boolean created) {}
    record Adjustment(UUID id,long amount,long balance,boolean created) {}
}
