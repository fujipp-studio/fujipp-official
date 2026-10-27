package com.fujipp.backend.roleshop;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.*;

@Service
class RoleShopService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private static final String SELECT = """
        SELECT p.*,w.balance_satang FROM private.role_shop_purchases p
        JOIN private.member_wallets w ON w.bot_id=p.bot_id AND w.member_discord_id=p.member_discord_id
        """;
    private static final RowMapper<RoleShopPurchase> ROW = (rs,n) -> new RoleShopPurchase(
        rs.getObject("id",UUID.class),rs.getString("member_discord_id"),rs.getString("product_key"),
        rs.getString("product_name"),rs.getString("role_id"),rs.getLong("price_satang"),
        rs.getString("status"),rs.getLong("balance_satang"),rs.getObject("claim_token",UUID.class),
        rs.getObject("created_at",OffsetDateTime.class));

    RoleShopService(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }

    @Transactional
    public RoleShopPurchase begin(RoleShopRequests.Begin request) {
        // Serialize retries before checking configuration or touching the shared Wallet.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",
            request.botId()+":role-shop:"+request.idempotencyKey());
        var existing=jdbc.query(SELECT+" WHERE p.bot_id=? AND p.idempotency_key=?",ROW,request.botId(),request.idempotencyKey());
        if (!existing.isEmpty()) {
            var purchase=existing.getFirst();
            if (!purchase.memberDiscordId().equals(request.memberDiscordId()) || !purchase.productKey().equals(request.productKey())
                    || !purchase.roleId().equals(request.roleId()) || purchase.priceSatang()!=request.priceSatang())
                throw error("IDEMPOTENCY_CONFLICT","คำขอซ้ำมีข้อมูลไม่ตรงกับรายการเดิม");
            return purchase;
        }
        JsonNode product=product(request.botId(),request.productKey());
        String role=product.path("roleId").asText();
        long price=product.path("priceSatang").asLong();
        if (!role.equals(request.roleId()) || price!=request.priceSatang())
            throw error("PRODUCT_CHANGED","ราคาหรือยศเปลี่ยนแล้ว กรุณาเลือกยศและยืนยันใหม่");
        jdbc.update("INSERT INTO private.member_wallets(bot_id,member_discord_id) VALUES (?,?) ON CONFLICT DO NOTHING",
            request.botId(),request.memberDiscordId());
        long balance=Objects.requireNonNull(jdbc.queryForObject("""
            SELECT balance_satang FROM private.member_wallets WHERE bot_id=? AND member_discord_id=? FOR UPDATE
            """,Long.class,request.botId(),request.memberDiscordId()));
        Boolean pending=jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM private.role_shop_purchases
            WHERE bot_id=? AND member_discord_id=? AND role_id=? AND status IN ('DEBITED','PROCESSING','SUCCEEDED'))
            """,Boolean.class,request.botId(),request.memberDiscordId(),role);
        if (Boolean.TRUE.equals(pending)) throw error("PURCHASE_PENDING","คุณซื้อยศนี้แล้วหรือมีรายการกำลังทำงานอยู่");
        if (balance<price) throw error("INSUFFICIENT_FUNDS","ยอดเงินใน Wallet ไม่เพียงพอ กรุณาเติมเงินก่อน");
        UUID id=UUID.randomUUID();
        long after=balance-price;
        updateBalance(request.botId(),request.memberDiscordId(),after);
        UUID debit=entry(request.botId(),request.memberDiscordId(),"DEBIT",-price,after,
            "ROLE_SHOP:"+id,"role-shop-debit:"+request.idempotencyKey(),"ซื้อยศ "+product.path("name").asText(),id,role);
        jdbc.update("""
            INSERT INTO private.role_shop_purchases(id,bot_id,member_discord_id,product_key,product_name,
              role_id,price_satang,idempotency_key,wallet_debit_entry_id) VALUES (?,?,?,?,?,?,?,?,?)
            """,id,request.botId(),request.memberDiscordId(),request.productKey(),product.path("name").asText(),
            role,price,request.idempotencyKey(),debit);
        return find(request.botId(),id);
    }

    @Transactional
    public RoleShopPurchase claim(UUID bot,UUID id) {
        int updated=jdbc.update("""
            UPDATE private.role_shop_purchases SET status='PROCESSING',claim_token=?,processing_started_at=now()
            WHERE bot_id=? AND id=? AND (status='DEBITED'
              OR (status='PROCESSING' AND processing_started_at<now()-interval '2 minutes'))
            """,UUID.randomUUID(),bot,id);
        if (updated==0) throw error("PURCHASE_BUSY","รายการกำลังประมวลผลหรือเสร็จแล้ว");
        return find(bot,id);
    }

    @Transactional
    public RoleShopPurchase complete(UUID bot,UUID id,UUID token) {
        RoleShopPurchase purchase=lock(bot,id);
        requireClaim(purchase,token,"SUCCEEDED");
        jdbc.update("""
            UPDATE private.role_shop_purchases SET status='SUCCEEDED',completed_at=COALESCE(completed_at,now())
            WHERE bot_id=? AND id=?
            """,bot,id);
        return find(bot,id);
    }

    @Transactional
    public RoleShopPurchase refund(UUID bot,UUID id,RoleShopRequests.Refund body) {
        RoleShopPurchase purchase=lock(bot,id);
        requireClaim(purchase,body.claimToken(),"REFUNDED");
        if (purchase.status().equals("REFUNDED")) return purchase;
        long balance=Objects.requireNonNull(jdbc.queryForObject("""
            SELECT balance_satang FROM private.member_wallets WHERE bot_id=? AND member_discord_id=? FOR UPDATE
            """,Long.class,bot,purchase.memberDiscordId()));
        long after=Math.addExact(balance,purchase.priceSatang());
        updateBalance(bot,purchase.memberDiscordId(),after);
        UUID refund=entry(bot,purchase.memberDiscordId(),"ADJUSTMENT",purchase.priceSatang(),after,
            "ROLE_SHOP_REFUND:"+id,"role-shop-refund:"+id,"คืนเงินซื้อยศ: "+body.reason(),id,purchase.roleId());
        jdbc.update("""
            UPDATE private.role_shop_purchases SET status='REFUNDED',wallet_refund_entry_id=?,
              error_message=?,completed_at=now() WHERE bot_id=? AND id=?
            """,refund,body.reason(),bot,id);
        return find(bot,id);
    }

    List<RoleShopPurchase> recoverable(UUID bot) {
        return jdbc.query(SELECT+"""
            WHERE p.bot_id=? AND (p.status='DEBITED'
              OR (p.status='PROCESSING' AND p.processing_started_at<now()-interval '2 minutes'))
            ORDER BY p.created_at LIMIT 100
            """,ROW,bot);
    }

    private JsonNode product(UUID bot,String key) {
        var rows=jdbc.query("""
            SELECT COALESCE(v.value,d.default_value)::text FROM private.bot_feature_installations i
            JOIN private.feature_licenses l ON l.id=i.license_id AND l.status='ACTIVE'
              AND (l.expires_at IS NULL OR l.expires_at>now())
            JOIN shop.feature_products p ON p.id=i.feature_product_id AND p.code='role-shop'
            JOIN private.feature_config_sets c ON c.license_id=l.id
            JOIN shop.feature_config_definitions d ON d.feature_version_id=c.feature_version_id AND d.config_key='ROLE_SHOP_PRODUCTS'
            LEFT JOIN private.feature_config_values v ON v.config_set_id=c.id AND v.definition_id=d.id
            WHERE i.bot_id=? AND i.status='ACTIVE' AND i.removed_at IS NULL
              AND EXISTS(SELECT 1 FROM private.bot_feature_installations wi
                JOIN private.feature_licenses wl ON wl.id=wi.license_id AND wl.status='ACTIVE'
                  AND (wl.expires_at IS NULL OR wl.expires_at>now())
                JOIN shop.feature_products wp ON wp.id=wi.feature_product_id AND wp.code='wallet-topup'
                WHERE wi.bot_id=i.bot_id AND wi.status='ACTIVE' AND wi.removed_at IS NULL)
            """,(rs,n)->json.readTree(rs.getString(1)),bot);
        if (rows.isEmpty()) throw error("FEATURE_NOT_ACTIVE","กรุณาติดตั้ง Role Shop และ Wallet Top-up บนบอทเดียวกัน");
        for (JsonNode item:rows.getFirst()) {
            if (key.equals(item.path("key").asText()) && item.path("roleId").asText().matches("^[0-9]{15,30}$")
                    && item.path("priceSatang").isIntegralNumber() && item.path("priceSatang").canConvertToLong()
                    && item.path("priceSatang").asLong()>0 && item.path("priceSatang").asLong()<=9007199254740991L)
                return item;
        }
        throw error("PRODUCT_UNAVAILABLE","ยศนี้ไม่เปิดขายแล้ว กรุณาเลือกรายการใหม่");
    }
    private RoleShopPurchase find(UUID bot,UUID id) {
        var rows=jdbc.query(SELECT+" WHERE p.bot_id=? AND p.id=?",ROW,bot,id);
        if (rows.isEmpty()) throw error("PURCHASE_NOT_FOUND","ไม่พบรายการซื้อยศ");
        return rows.getFirst();
    }
    private RoleShopPurchase lock(UUID bot,UUID id) {
        jdbc.queryForList("SELECT id FROM private.role_shop_purchases WHERE bot_id=? AND id=? FOR UPDATE",bot,id);
        return find(bot,id);
    }
    private void requireClaim(RoleShopPurchase purchase,UUID token,String terminal) {
        if (!Objects.equals(purchase.claimToken(),token)
                || !(purchase.status().equals("PROCESSING") || purchase.status().equals(terminal)))
            throw error("INVALID_PURCHASE_STATE","ไม่สามารถเปลี่ยนสถานะรายการนี้ได้");
    }
    private void updateBalance(UUID bot,String member,long amount) {
        jdbc.update("UPDATE private.member_wallets SET balance_satang=? WHERE bot_id=? AND member_discord_id=?",amount,bot,member);
    }
    private UUID entry(UUID bot,String member,String kind,long amount,long after,String reference,String key,String reason,UUID purchase,String role) {
        return jdbc.queryForObject("""
            INSERT INTO private.member_wallet_entries(bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
              source_reference,idempotency_key,metadata) VALUES (?,?,?::private.wallet_entry_kind,?,?,?,?,?::jsonb) RETURNING id
            """,UUID.class,bot,member,kind,amount,after,reference,key,
            json.writeValueAsString(Map.of("reason",reason,"purchase_id",purchase.toString(),"role_id",role)));
    }
    private static RoleShopException error(String code,String message) { return new RoleShopException(code,message); }
}
