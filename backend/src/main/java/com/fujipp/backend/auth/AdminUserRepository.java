package com.fujipp.backend.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminUserRepository {
    private final JdbcTemplate jdbcTemplate;

    public AdminUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<AdminUserResponses.UserSummary> searchUsers(String query) {
        String filter = query == null || query.isBlank() ? "%" : "%" + query.trim().toLowerCase() + "%";
        return jdbcTemplate.query(
                """
                SELECT c.id AS customer_id,
                       p.id AS user_id,
                       COALESCE(c.customer_code, 'CUS_' || upper(replace(p.id::text, '-', ''))) AS customer_code,
                       COALESCE(p.display_name, p.username, 'User') AS display_name,
                       p.username,
                       auth_user.email,
                       COALESCE(c.status::text, 'ACTIVE') AS customer_status,
                       COALESCE(acc.role::text, 'USER') AS role,
                       COALESCE(w.balance_satang, 0) AS balance_satang,
                       p.created_at
                  FROM public.profiles p
                  LEFT JOIN billing.customers c ON c.user_id = p.id
                  LEFT JOIN private.user_accounts acc ON acc.user_id = p.id
                  LEFT JOIN billing.wallets w ON w.customer_id = c.id AND w.currency = 'THB'
                  LEFT JOIN auth.users auth_user ON auth_user.id = p.id
                 WHERE LOWER(COALESCE(c.customer_code, 'CUS_' || upper(replace(p.id::text, '-', '')))) LIKE ?
                    OR LOWER(COALESCE(p.username, '')) LIKE ?
                    OR LOWER(COALESCE(p.display_name, '')) LIKE ?
                    OR LOWER(CAST(p.id AS text)) LIKE ?
                 ORDER BY p.created_at DESC
                 LIMIT 100
                """,
                (rs, rowNum) -> new AdminUserResponses.UserSummary(
                        rs.getObject("customer_id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getString("customer_code"),
                        rs.getString("email"),
                        rs.getString("display_name"),
                        rs.getString("customer_status"),
                        rs.getString("role"),
                        rs.getLong("balance_satang"),
                        rs.getObject("created_at", OffsetDateTime.class)
                ),
                filter, filter, filter, filter
        );
    }

    public List<AdminUserResponses.UserSummary> searchUsersPage(String query, OffsetDateTime beforeCreatedAt, UUID beforeId, int limit) {
        String filter = query == null || query.isBlank() ? "%" : "%" + query.trim().toLowerCase() + "%";
        String cursor = beforeCreatedAt == null ? "" : " AND (p.created_at, p.id) < (?, ?)";
        String sql = """
                SELECT c.id AS customer_id,p.id AS user_id,
                       COALESCE(c.customer_code, 'CUS_' || upper(replace(p.id::text, '-', ''))) AS customer_code,
                       COALESCE(p.display_name,p.username,'User') AS display_name,p.username,auth_user.email,
                       COALESCE(c.status::text,'ACTIVE') AS customer_status,COALESCE(acc.role::text,'USER') AS role,
                       COALESCE(w.balance_satang,0) AS balance_satang,p.created_at
                  FROM public.profiles p LEFT JOIN billing.customers c ON c.user_id=p.id
                  LEFT JOIN private.user_accounts acc ON acc.user_id=p.id
                  LEFT JOIN billing.wallets w ON w.customer_id=c.id AND w.currency='THB'
                  LEFT JOIN auth.users auth_user ON auth_user.id=p.id
                 WHERE (LOWER(COALESCE(c.customer_code,'CUS_' || upper(replace(p.id::text,'-','')))) LIKE ?
                    OR LOWER(COALESCE(p.username,'')) LIKE ? OR LOWER(COALESCE(p.display_name,'')) LIKE ?
                    OR LOWER(p.id::text) LIKE ?)
                """ + cursor + " ORDER BY p.created_at DESC,p.id DESC LIMIT ?";
        var mapper=(org.springframework.jdbc.core.RowMapper<AdminUserResponses.UserSummary>)(rs,n)->new AdminUserResponses.UserSummary(
                rs.getObject("customer_id",UUID.class),rs.getObject("user_id",UUID.class),rs.getString("customer_code"),
                rs.getString("email"),rs.getString("display_name"),rs.getString("customer_status"),rs.getString("role"),
                rs.getLong("balance_satang"),rs.getObject("created_at",OffsetDateTime.class));
        return beforeCreatedAt==null?jdbcTemplate.query(sql,mapper,filter,filter,filter,filter,limit)
                :jdbcTemplate.query(sql,mapper,filter,filter,filter,filter,beforeCreatedAt,beforeId,limit);
    }

    public Optional<AdminUserResponses.UserSummary> findUser(UUID userId) {
        return searchUsersPage(userId.toString(),null,null,2).stream()
                .filter(user -> user.userId().equals(userId)).findFirst();
    }

    public boolean updateAccount(UUID userId,String role,String status,AdminUserRequests.UpdateAccountRequest request){
        int account=jdbcTemplate.update("UPDATE private.user_accounts SET role=?::private.app_role,status=?::private.account_status,updated_at=now() WHERE user_id=?",role,status,userId);
        if(account==0)return false;
        jdbcTemplate.update("UPDATE public.profiles SET display_name=?,first_name=?,last_name=? WHERE id=?",
                normalize(request.displayName()),normalize(request.firstName()),normalize(request.lastName()),userId);
        return true;
    }

    public List<AdminUserResponses.FeatureLicense> findFeatureLicenses(UUID userId){return jdbcTemplate.query("""
        SELECT license.id,license.feature_product_id,product.code,product.name,version.version,
               license.status::text,license.installation_limit,license.acquired_at,license.expires_at
          FROM private.feature_licenses license JOIN shop.feature_products product ON product.id=license.feature_product_id
          JOIN shop.feature_versions version ON version.id=license.acquired_version_id
         WHERE license.owner_user_id=? ORDER BY license.acquired_at DESC
        """,(rs,n)->new AdminUserResponses.FeatureLicense(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),
            rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getInt(7),
            rs.getObject(8,OffsetDateTime.class),rs.getObject(9,OffsetDateTime.class)),userId);}

    public Optional<AdminUserResponses.FeatureLicense> findFeatureLicense(UUID userId,UUID licenseId){
        return jdbcTemplate.query("""
            SELECT license.id,license.feature_product_id,product.code,product.name,version.version,
                   license.status::text,license.installation_limit,license.acquired_at,license.expires_at
              FROM private.feature_licenses license JOIN shop.feature_products product ON product.id=license.feature_product_id
              JOIN shop.feature_versions version ON version.id=license.acquired_version_id
             WHERE license.owner_user_id=? AND license.id=?
            """,(rs,n)->new AdminUserResponses.FeatureLicense(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),
                rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getInt(7),
                rs.getObject(8,OffsetDateTime.class),rs.getObject(9,OffsetDateTime.class)),userId,licenseId).stream().findFirst();
    }

    public UUID grantFeature(UUID userId,AdminUserRequests.GrantFeatureRequest request,UUID adminId){
        return jdbcTemplate.queryForObject("""
            INSERT INTO private.feature_licenses(owner_user_id,feature_product_id,acquired_version_id,source,
                installation_limit,granted_by,expires_at)
            SELECT ?,product.id,version.id,'GRANT',?,?,?
              FROM shop.feature_products product JOIN shop.feature_versions version
                ON version.feature_product_id=product.id AND version.status='PUBLISHED'
             WHERE product.id=? AND EXISTS(SELECT 1 FROM private.user_accounts WHERE user_id=?)
            RETURNING id
            """,UUID.class,userId,request.installationLimit(),adminId,request.expiresAt(),request.featureProductId(),userId);
    }

    public boolean updateFeatureLicense(UUID userId,UUID licenseId,String status,AdminUserRequests.UpdateFeatureLicenseRequest request){
        OffsetDateTime now=OffsetDateTime.now();
        return jdbcTemplate.update("""
            UPDATE private.feature_licenses SET status=?::private.feature_license_status,installation_limit=?,expires_at=?,
                suspended_at=CASE WHEN ?='SUSPENDED' THEN ? ELSE NULL END,
                revoked_at=CASE WHEN ?='REVOKED' THEN ? ELSE NULL END,updated_at=now()
             WHERE id=? AND owner_user_id=?
            """,status,request.installationLimit(),request.expiresAt(),status,now,status,now,licenseId,userId)==1;
    }

    private String normalize(String value){if(value==null)return null;String normalized=value.trim();return normalized.isEmpty()?null:normalized;}

    public UUID ensureCustomerAndWallet(UUID userIdOrCustomerId) {
        List<UUID> existingCustomer = jdbcTemplate.query(
                "SELECT id FROM billing.customers WHERE id = ? OR user_id = ?",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                userIdOrCustomerId, userIdOrCustomerId
        );

        UUID customerId;
        if (!existingCustomer.isEmpty()) {
            customerId = existingCustomer.get(0);
        } else {
            customerId = jdbcTemplate.queryForObject(
                    """
                    INSERT INTO billing.customers (user_id, customer_code)
                    VALUES (?, 'CUS_' || upper(replace(?::text, '-', '')))
                    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
                    RETURNING id
                    """,
                    UUID.class,
                    userIdOrCustomerId, userIdOrCustomerId
            );
        }

        jdbcTemplate.update(
                """
                INSERT INTO billing.wallets (customer_id, currency)
                VALUES (?, 'THB')
                ON CONFLICT (customer_id, currency) DO NOTHING
                """,
                customerId
        );

        return customerId;
    }

    public Optional<UUID> findWalletIdByCustomerId(UUID customerId) {
        UUID validCustomerId = ensureCustomerAndWallet(customerId);
        List<UUID> results = jdbcTemplate.query(
                "SELECT id FROM billing.wallets WHERE customer_id = ? AND currency = 'THB'",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                validCustomerId
        );
        return results.stream().findFirst();
    }

    public UUID adjustWallet(UUID walletId, String direction, String entryType, long amountSatang, String description, String idempotencyKey, UUID adminUserId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT entry.id
                  FROM billing.apply_wallet_entry(
                        ?,
                        ?::billing.wallet_direction,
                        ?::billing.wallet_entry_type,
                        ?,
                        ?,
                        'ADMIN_ADJUSTMENT',
                        ?,
                        ?,
                        ?
                  ) AS entry
                """,
                UUID.class,
                walletId,
                direction,
                entryType,
                amountSatang,
                idempotencyKey,
                adminUserId,
                description,
                adminUserId
        );
    }

    public List<AdminUserResponses.WalletHistoryEntry> findWalletHistory(UUID walletId) {
        return jdbcTemplate.query(
                """
                SELECT id, direction::text, entry_type::text, amount_satang, balance_before_satang, balance_after_satang,
                       reference_type, reference_id, description, created_at
                  FROM billing.wallet_entries
                 WHERE wallet_id = ?
                 ORDER BY created_at DESC
                 LIMIT 50
                """,
                (rs, rowNum) -> new AdminUserResponses.WalletHistoryEntry(
                        rs.getObject("id", UUID.class),
                        rs.getString("direction"),
                        rs.getString("entry_type"),
                        rs.getLong("amount_satang"),
                        rs.getLong("balance_before_satang"),
                        rs.getLong("balance_after_satang"),
                        rs.getString("reference_type"),
                        rs.getObject("reference_id", UUID.class),
                        rs.getString("description"),
                        rs.getObject("created_at", OffsetDateTime.class)
                ),
                walletId
        );
    }

    public List<AdminUserResponses.WalletHistoryEntry> findWalletHistoryPage(
            UUID walletId, OffsetDateTime beforeCreatedAt, UUID beforeId, int limit) {
        String cursor=beforeCreatedAt==null?"":" AND (created_at,id) < (?,?)";
        String sql="""
                SELECT id,direction::text,entry_type::text,amount_satang,balance_before_satang,balance_after_satang,
                       reference_type,reference_id,description,created_at FROM billing.wallet_entries
                 WHERE wallet_id=?
                """+cursor+" ORDER BY created_at DESC,id DESC LIMIT ?";
        var mapper=(org.springframework.jdbc.core.RowMapper<AdminUserResponses.WalletHistoryEntry>)(rs,n)->new AdminUserResponses.WalletHistoryEntry(
                rs.getObject("id",UUID.class),rs.getString("direction"),rs.getString("entry_type"),rs.getLong("amount_satang"),
                rs.getLong("balance_before_satang"),rs.getLong("balance_after_satang"),rs.getString("reference_type"),
                rs.getObject("reference_id",UUID.class),rs.getString("description"),rs.getObject("created_at",OffsetDateTime.class));
        return beforeCreatedAt==null?jdbcTemplate.query(sql,mapper,walletId,limit)
                :jdbcTemplate.query(sql,mapper,walletId,beforeCreatedAt,beforeId,limit);
    }
}
