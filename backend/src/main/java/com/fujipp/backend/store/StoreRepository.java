package com.fujipp.backend.store;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class StoreRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public StoreRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<FeatureSummaryResponse> findActiveFeatures() {
        List<FeatureRow> rows = jdbcTemplate.query(
                """
                SELECT product.id,
                       product.code,
                       product.name,
                       product.description,
                       product.category,
                       product.icon_key,
                       product.image_url,
                       product.image_width,
                       product.image_height,
                       product.image_format,
                       product.image_bytes,
                       product.image_alt_text,
                       product.tutorial_url,
                       product.is_featured,
                       version.version,
                       offer.id AS offer_id,
                       offer.code AS offer_code,
                       offer.name AS offer_name,
                       offer.offer_kind::text,
                       offer.price_satang,
                       offer.currency,
                       offer.billing_period_days,
                       offer.installation_limit
                  FROM shop.feature_products AS product
                  JOIN shop.feature_versions AS version
                    ON version.feature_product_id = product.id
                   AND version.status = 'PUBLISHED'
                  LEFT JOIN shop.feature_offers AS offer
                    ON offer.feature_product_id = product.id
                   AND offer.is_active = true
                   AND (offer.starts_at IS NULL OR offer.starts_at <= now())
                   AND (offer.ends_at IS NULL OR offer.ends_at > now())
                 WHERE product.status = 'ACTIVE'
                 ORDER BY product.is_featured DESC,
                          product.sort_order,
                          product.code,
                          offer.price_satang,
                          offer.code
                """,
                this::mapFeatureRow
        );

        Map<UUID, FeatureBuilder> features = new LinkedHashMap<>();
        for (FeatureRow row : rows) {
            FeatureBuilder builder = features.computeIfAbsent(
                    row.id(),
                    ignored -> new FeatureBuilder(row)
            );
            if (row.offer() != null) {
                builder.offers().add(row.offer());
            }
        }
        return features.values().stream().map(FeatureBuilder::build).toList();
    }

    public Optional<FeatureAdminMedia> findFeatureAdminMedia(UUID featureId) {
        List<FeatureAdminMedia> rows = jdbcTemplate.query(
                """
                SELECT code,
                       image_public_id,
                       image_url,
                       image_width,
                       image_height,
                       image_format,
                       image_bytes,
                       image_alt_text,
                       tutorial_url
                  FROM shop.feature_products
                 WHERE id = ?
                """,
                (resultSet, rowNumber) -> new FeatureAdminMedia(
                        resultSet.getString("code"),
                        resultSet.getString("image_public_id"),
                        resultSet.getString("image_url"),
                        resultSet.getObject("image_width", Integer.class),
                        resultSet.getObject("image_height", Integer.class),
                        resultSet.getString("image_format"),
                        resultSet.getObject("image_bytes", Long.class),
                        resultSet.getString("image_alt_text"),
                        resultSet.getString("tutorial_url")
                ),
                featureId
        );
        return rows.stream().findFirst();
    }

    public List<AdminStoreResponses.Feature> findAdminFeatures() {
        List<AdminFeatureRow> rows = jdbcTemplate.query(
                """
                SELECT product.id, product.code, product.name, product.description,
                       product.category, product.icon_key, product.image_url,
                       product.image_alt_text, product.tutorial_url, product.status::text,
                       product.is_featured, product.sort_order,
                       latest_version.version AS latest_version,
                       latest_version.status::text AS version_status,
                       latest_version.published_at,
                       offer.id AS offer_id, offer.code AS offer_code, offer.name AS offer_name,
                       offer.offer_kind::text AS offer_kind, offer.price_satang, offer.currency,
                       offer.billing_period_days, offer.installation_limit, offer.is_active,
                       offer.starts_at, offer.ends_at
                  FROM shop.feature_products product
                  LEFT JOIN LATERAL (
                      SELECT version, status, published_at
                        FROM shop.feature_versions
                       WHERE feature_product_id = product.id
                       ORDER BY created_at DESC, version DESC
                       LIMIT 1
                  ) latest_version ON true
                  LEFT JOIN shop.feature_offers offer ON offer.feature_product_id = product.id
                 ORDER BY product.sort_order, product.code, offer.created_at, offer.code
                """,
                (rs, rowNum) -> new AdminFeatureRow(
                        rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("description"), rs.getString("category"), rs.getString("icon_key"),
                        rs.getString("image_url"), rs.getString("image_alt_text"), rs.getString("tutorial_url"),
                        rs.getString("status"), rs.getBoolean("is_featured"), rs.getInt("sort_order"),
                        rs.getString("latest_version"), rs.getString("version_status"),
                        rs.getObject("published_at", OffsetDateTime.class),
                        rs.getObject("offer_id", UUID.class) == null ? null : new AdminStoreResponses.Offer(
                                rs.getObject("offer_id", UUID.class), rs.getString("offer_code"),
                                rs.getString("offer_name"), rs.getString("offer_kind"), rs.getLong("price_satang"),
                                rs.getString("currency"), rs.getObject("billing_period_days", Integer.class),
                                rs.getInt("installation_limit"), rs.getBoolean("is_active"),
                                rs.getObject("starts_at", OffsetDateTime.class), rs.getObject("ends_at", OffsetDateTime.class))
                ));
        Map<UUID, AdminFeatureAccumulator> grouped = new LinkedHashMap<>();
        for (AdminFeatureRow row : rows) {
            AdminFeatureAccumulator item = grouped.computeIfAbsent(row.id(), ignored -> new AdminFeatureAccumulator(row));
            if (row.offer() != null) item.offers.add(row.offer());
        }
        return grouped.values().stream().map(AdminFeatureAccumulator::response).toList();
    }

    public boolean updateFeature(UUID featureId, AdminStoreRequests.UpdateFeatureRequest request) {
        return jdbcTemplate.update("""
                UPDATE shop.feature_products
                   SET name=?, description=?, category=upper(?), icon_key=?,
                       status=?::shop.feature_product_status, is_featured=?, sort_order=?
                 WHERE id=?
                """, request.name().trim(), request.description().trim(), request.category().trim(),
                normalize(request.iconKey()), request.status().toUpperCase(), request.featured(),
                request.sortOrder(), featureId) == 1;
    }

    public boolean updateFeatureOffer(UUID featureId, UUID offerId, AdminStoreRequests.UpdateOfferRequest request) {
        return jdbcTemplate.update("""
                UPDATE shop.feature_offers
                   SET name=?, price_satang=?, installation_limit=?, is_active=?, starts_at=?, ends_at=?
                 WHERE id=? AND feature_product_id=?
                """, request.name().trim(), request.priceSatang(), request.installationLimit(), request.active(),
                request.startsAt(), request.endsAt(), offerId, featureId) == 1;
    }

    public void createFeatureOffer(UUID featureId, AdminStoreRequests.CreateOfferRequest request, String kind) {
        jdbcTemplate.update("""
                INSERT INTO shop.feature_offers(
                    feature_product_id, code, name, offer_kind, price_satang, currency,
                    billing_period_days, installation_limit, is_active, starts_at, ends_at
                ) VALUES (?, ?, ?, ?::shop.feature_offer_kind, ?, 'THB', ?, ?, ?, ?, ?)
                """, featureId, request.code().trim(), request.name().trim(), kind,
                request.priceSatang(), request.billingPeriodDays(), request.installationLimit(),
                request.active(), request.startsAt(), request.endsAt());
    }

    public boolean publishLatestFeatureVersion(UUID featureId) {
        UUID versionId = jdbcTemplate.query("""
                SELECT id FROM shop.feature_versions
                 WHERE feature_product_id = ?
                 ORDER BY created_at DESC, version DESC
                 LIMIT 1
                """, rs -> rs.next() ? rs.getObject("id", UUID.class) : null, featureId);
        if (versionId == null) return false;
        jdbcTemplate.update("""
                UPDATE shop.feature_versions
                   SET status = 'DEPRECATED'
                 WHERE feature_product_id = ? AND status = 'PUBLISHED' AND id <> ?
                """, featureId, versionId);
        return jdbcTemplate.update("""
                UPDATE shop.feature_versions
                   SET status = 'PUBLISHED', published_at = COALESCE(published_at, now())
                 WHERE id = ?
                """, versionId) == 1;
    }

    public void replaceFeatureImage(
            UUID featureId,
            String publicId,
            String secureUrl,
            Integer width,
            Integer height,
            String format,
            Long bytes,
            String altText
    ) {
        int updated = jdbcTemplate.update(
                """
                UPDATE shop.feature_products
                   SET image_public_id = ?,
                       image_url = ?,
                       image_width = ?,
                       image_height = ?,
                       image_format = ?,
                       image_bytes = ?,
                       image_alt_text = ?
                 WHERE id = ?
                """,
                publicId,
                secureUrl,
                width,
                height,
                format,
                bytes,
                altText,
                featureId
        );
        if (updated != 1) {
            throw new StoreNotFoundException("Feature product was not found");
        }
    }

    public boolean clearFeatureImage(UUID featureId) {
        return jdbcTemplate.update(
                """
                UPDATE shop.feature_products
                   SET image_public_id = NULL,
                       image_url = NULL,
                       image_width = NULL,
                       image_height = NULL,
                       image_format = NULL,
                       image_bytes = NULL,
                       image_alt_text = NULL
                 WHERE id = ?
                   AND image_public_id IS NOT NULL
                """,
                featureId
        ) == 1;
    }

    public boolean updateTutorialUrl(UUID featureId, String tutorialUrl) {
        return jdbcTemplate.update(
                """
                UPDATE shop.feature_products
                   SET tutorial_url = ?
                 WHERE id = ?
                """,
                tutorialUrl,
                featureId
        ) == 1;
    }

    public void upsertBotCredential(
            UUID botId,
            UUID ownerUserId,
            String credentialKey,
            EncryptedSecret secret
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO private.bot_credentials (
                    bot_id, owner_user_id, credential_key, ciphertext, nonce,
                    encryption_key_version, fingerprint
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (bot_id, credential_key) DO UPDATE
                   SET ciphertext = EXCLUDED.ciphertext,
                       nonce = EXCLUDED.nonce,
                       encryption_key_version = EXCLUDED.encryption_key_version,
                       fingerprint = EXCLUDED.fingerprint,
                       configured_at = now(),
                       rotated_at = now()
                """,
                botId,
                ownerUserId,
                credentialKey,
                secret.ciphertext(),
                secret.nonce(),
                secret.keyVersion(),
                secret.fingerprint()
        );
    }

    public BotCredential findBotCredential(UUID botId, UUID ownerUserId, String key) {
        return jdbcTemplate.query(
                """
                SELECT credential.ciphertext, credential.nonce, credential.encryption_key_version
                  FROM private.bot_credentials AS credential
                  JOIN bots.bot_instances AS bot ON bot.id = credential.bot_id
                 WHERE credential.bot_id = ? AND bot.owner_user_id = ?
                   AND credential.credential_key = ? AND bot.status <> 'DECOMMISSIONED'
                """,
                rs -> rs.next()
                        ? new BotCredential(rs.getBytes(1), rs.getBytes(2), rs.getString(3))
                        : null,
                botId, ownerUserId, key
        );
    }

    public BotResponse updateDiscordProfile(
            UUID botId, UUID ownerUserId, String username, String avatarUrl
    ) {
        return jdbcTemplate.query(
                """
                UPDATE bots.bot_instances
                   SET discord_username = ?, discord_avatar_url = ?
                 WHERE id = ? AND owner_user_id = ? AND status <> 'DECOMMISSIONED'
                RETURNING id, name, discord_application_id, discord_guild_id,
                          discord_username, discord_avatar_url, status::text,
                          desired_state::text, restart_revision, created_at, updated_at
                """,
                this::mapBot,
                username, avatarUrl, botId, ownerUserId
        ).stream().findFirst().orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
    }

    public record BotCredential(byte[] ciphertext, byte[] nonce, String keyVersion) {}

    public List<BotResponse> findBots(UUID ownerUserId) {
        return jdbcTemplate.query(
                """
                SELECT id,
                       name,
                       discord_application_id,
                       discord_guild_id,
                       discord_username,
                       discord_avatar_url,
                       status::text,
                       desired_state::text,
                       restart_revision,
                       created_at,
                       updated_at
                  FROM bots.bot_instances
                 WHERE owner_user_id = ?
                   AND status <> 'DECOMMISSIONED'
                 ORDER BY created_at, id
                """,
                this::mapBot,
                ownerUserId
        );
    }

    public List<BotResponse> findBotsPage(UUID ownerUserId, OffsetDateTime afterCreatedAt, UUID afterId, int limit) {
        String cursor = afterCreatedAt == null ? "" : " AND (created_at, id) > (?, ?)";
        String sql = """
                SELECT id,name,discord_application_id,discord_guild_id,discord_username,
                       discord_avatar_url,status::text,desired_state::text,restart_revision,created_at,updated_at
                  FROM bots.bot_instances
                 WHERE owner_user_id = ? AND status <> 'DECOMMISSIONED'
                """ + cursor + " ORDER BY created_at, id LIMIT ?";
        return afterCreatedAt == null
                ? jdbcTemplate.query(sql, this::mapBot, ownerUserId, limit)
                : jdbcTemplate.query(sql, this::mapBot, ownerUserId, afterCreatedAt, afterId, limit);
    }

    public BotResponse createBot(
            UUID ownerUserId,
            String name,
            String discordApplicationId,
            String discordGuildId
    ) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO bots.bot_instances (
                    owner_user_id,
                    name,
                    discord_application_id,
                    discord_guild_id
                )
                VALUES (?, ?, ?, ?)
                RETURNING id,
                          name,
                          discord_application_id,
                          discord_guild_id,
                          discord_username,
                          discord_avatar_url,
                          status::text,
                          desired_state::text,
                          restart_revision,
                          created_at,
                          updated_at
                """,
                this::mapBot,
                ownerUserId,
                name,
                discordApplicationId,
                discordGuildId
        );
    }

    public boolean botBelongsTo(UUID botId, UUID ownerUserId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM bots.bot_instances
                     WHERE id = ?
                       AND owner_user_id = ?
                       AND status <> 'DECOMMISSIONED'
                )
                """,
                Boolean.class,
                botId,
                ownerUserId
        ));
    }

    public BotResponse updateBot(UUID botId, UUID ownerUserId, String name,
                                 String discordApplicationId, String discordGuildId) {
        List<BotResponse> rows = jdbcTemplate.query(
                """
                UPDATE bots.bot_instances
                   SET name = ?,
                       discord_application_id = ?,
                       discord_guild_id = ?
                 WHERE id = ?
                   AND owner_user_id = ?
                   AND status <> 'DECOMMISSIONED'
                RETURNING id, name, discord_application_id, discord_guild_id,
                          discord_username, discord_avatar_url, status::text,
                          desired_state::text, restart_revision, created_at, updated_at
                """,
                this::mapBot,
                name, discordApplicationId, discordGuildId, botId, ownerUserId
        );
        return rows.stream().findFirst()
                .orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
    }

    public BotResponse controlBot(UUID botId, UUID ownerUserId, String action) {
        String desiredState = "stop".equals(action) ? "STOPPED" : "RUNNING";
        boolean restart = "restart".equals(action);
        List<BotResponse> rows = jdbcTemplate.query(
                """
                UPDATE bots.bot_instances
                   SET desired_state = ?::bots.bot_desired_state,
                       restart_revision = restart_revision + CASE WHEN ? THEN 1 ELSE 0 END
                 WHERE id = ?
                   AND owner_user_id = ?
                   AND status NOT IN ('SUSPENDED', 'DECOMMISSIONED')
                RETURNING id, name, discord_application_id, discord_guild_id,
                          discord_username, discord_avatar_url, status::text,
                          desired_state::text, restart_revision, created_at, updated_at
                """,
                this::mapBot,
                desiredState, restart, botId, ownerUserId
        );
        return rows.stream().findFirst()
                .orElseThrow(() -> new StoreNotFoundException("Controllable bot was not found"));
    }

    public Optional<OfferCheckoutRow> findOfferForCheckout(UUID offerId) {
        List<OfferCheckoutRow> rows = jdbcTemplate.query(
                """
                SELECT offer.id,
                       offer.feature_product_id,
                       version.id AS feature_version_id,
                       product.code AS product_code,
                       product.name AS product_name,
                       offer.code AS offer_code,
                       offer.name AS offer_name,
                       offer.offer_kind::text,
                       offer.price_satang,
                       offer.currency,
                       offer.billing_period_days,
                       offer.installation_limit
                  FROM shop.feature_offers AS offer
                  JOIN shop.feature_products AS product
                    ON product.id = offer.feature_product_id
                   AND product.status = 'ACTIVE'
                  JOIN shop.feature_versions AS version
                    ON version.feature_product_id = product.id
                   AND version.status = 'PUBLISHED'
                 WHERE offer.id = ?
                   AND offer.is_active = true
                   AND (offer.starts_at IS NULL OR offer.starts_at <= now())
                   AND (offer.ends_at IS NULL OR offer.ends_at > now())
                """,
                (resultSet, rowNumber) -> new OfferCheckoutRow(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getObject("feature_product_id", UUID.class),
                        resultSet.getObject("feature_version_id", UUID.class),
                        resultSet.getString("product_code"),
                        resultSet.getString("product_name"),
                        resultSet.getString("offer_code"),
                        resultSet.getString("offer_name"),
                        resultSet.getString("offer_kind"),
                        resultSet.getLong("price_satang"),
                        resultSet.getString("currency"),
                        resultSet.getObject("billing_period_days", Integer.class),
                        resultSet.getInt("installation_limit")
                ),
                offerId
        );
        return rows.stream().findFirst();
    }

    public void lockCheckout(String idempotencyKey) {
        jdbcTemplate.query(
                "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                (ResultSetExtractor<Void>) resultSet -> null,
                "store-checkout:" + idempotencyKey
        );
    }

    public Optional<OrderReplay> findOrderByIdempotency(UUID ownerUserId, String key) {
        List<OrderReplay> rows = jdbcTemplate.query(
                """
                SELECT store_order.id,
                       store_order.order_number,
                       store_order.status::text,
                       store_order.total_satang,
                       store_order.currency,
                       store_order.paid_at,
                       item.feature_offer_id,
                       item.quantity
                  FROM billing.store_orders AS store_order
                  JOIN billing.customers AS customer
                    ON customer.id = store_order.customer_id
                  JOIN billing.store_order_items AS item
                    ON item.order_id = store_order.id
                 WHERE customer.user_id = ?
                   AND store_order.idempotency_key = ?
                """,
                (resultSet, rowNumber) -> new OrderReplay(
                        mapOrder(resultSet),
                        resultSet.getObject("feature_offer_id", UUID.class),
                        resultSet.getInt("quantity")
                ),
                ownerUserId,
                key
        );
        return rows.stream().findFirst();
    }

    public OrderContext createPendingOrder(
            UUID ownerUserId,
            OfferCheckoutRow offer,
            int quantity,
            String idempotencyKey
    ) {
        CustomerWallet customerWallet = jdbcTemplate.query(
                """
                SELECT customer.id AS customer_id, wallet.id AS wallet_id
                  FROM billing.customers AS customer
                  JOIN billing.wallets AS wallet
                    ON wallet.customer_id = customer.id
                   AND wallet.currency = 'THB'
                 WHERE customer.user_id = ?
                """,
                resultSet -> {
                    if (!resultSet.next()) {
                        return null;
                    }
                    return new CustomerWallet(
                            resultSet.getObject("customer_id", UUID.class),
                            resultSet.getObject("wallet_id", UUID.class)
                    );
                },
                ownerUserId
        );
        if (customerWallet == null) {
            throw new StoreNotFoundException("Customer wallet was not found");
        }

        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        long total = Math.multiplyExact(offer.priceSatang(), quantity);
        String orderNumber = "ORD_" + orderId.toString().replace("-", "").toUpperCase();

        jdbcTemplate.update(
                """
                INSERT INTO billing.store_orders (
                    id,
                    order_number,
                    customer_id,
                    total_satang,
                    currency,
                    idempotency_key
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                orderId,
                orderNumber,
                customerWallet.customerId(),
                total,
                offer.currency(),
                idempotencyKey
        );

        jdbcTemplate.update(
                """
                INSERT INTO billing.store_order_items (
                    id,
                    order_id,
                    feature_offer_id,
                    feature_product_id,
                    feature_version_id,
                    product_code_snapshot,
                    product_name_snapshot,
                    offer_code_snapshot,
                    offer_name_snapshot,
                    offer_kind_snapshot,
                    unit_price_satang,
                    quantity,
                    line_total_satang,
                    installation_limit_snapshot,
                    billing_period_days_snapshot
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::shop.feature_offer_kind,
                          ?, ?, ?, ?, ?)
                """,
                itemId,
                orderId,
                offer.id(),
                offer.productId(),
                offer.versionId(),
                offer.productCode(),
                offer.productName(),
                offer.offerCode(),
                offer.offerName(),
                offer.kind(),
                offer.priceSatang(),
                quantity,
                total,
                offer.installationLimit(),
                offer.billingPeriodDays()
        );

        return new OrderContext(
                orderId,
                itemId,
                orderNumber,
                customerWallet.walletId(),
                total
        );
    }

    public UUID debitOrder(OrderContext order, String idempotencyKey) {
        return jdbcTemplate.queryForObject(
                """
                SELECT entry.id
                  FROM billing.apply_wallet_entry(
                        ?,
                        'DEBIT',
                        'PURCHASE',
                        ?,
                        ?,
                        'STORE_ORDER',
                        ?,
                        ?
                  ) AS entry
                """,
                UUID.class,
                order.walletId(),
                order.totalSatang(),
                "store-order:" + idempotencyKey,
                order.orderId(),
                "Bot feature purchase"
        );
    }

    public OffsetDateTime markOrderPaid(UUID orderId, UUID walletEntryId) {
        return jdbcTemplate.queryForObject(
                """
                UPDATE billing.store_orders
                   SET status = 'PAID',
                       wallet_entry_id = ?,
                       paid_at = now()
                 WHERE id = ?
                RETURNING paid_at
                """,
                OffsetDateTime.class,
                walletEntryId,
                orderId
        );
    }

    public List<UUID> issueLicenses(
            UUID ownerUserId,
            OfferCheckoutRow offer,
            OrderContext order,
            int quantity,
            OffsetDateTime acquiredAt
    ) {
        List<UUID> licenseIds = new ArrayList<>();
        for (int index = 0; index < quantity; index++) {
            UUID licenseId = UUID.randomUUID();
            OffsetDateTime expiresAt = offer.billingPeriodDays() == null
                    ? null
                    : acquiredAt.plusDays(offer.billingPeriodDays());
            jdbcTemplate.update(
                    """
                    INSERT INTO private.feature_licenses (
                        id,
                        owner_user_id,
                        feature_product_id,
                        acquired_version_id,
                        order_item_id,
                        source,
                        installation_limit,
                        acquired_at,
                        expires_at
                    ) VALUES (?, ?, ?, ?, ?, 'PURCHASE', ?, ?, ?)
                    """,
                    licenseId,
                    ownerUserId,
                    offer.productId(),
                    offer.versionId(),
                    order.itemId(),
                    offer.installationLimit(),
                    acquiredAt,
                    expiresAt
            );
            jdbcTemplate.update(
                    """
                    INSERT INTO private.feature_config_sets (
                        license_id,
                        feature_product_id,
                        feature_version_id
                    ) VALUES (?, ?, ?)
                    """,
                    licenseId,
                    offer.productId(),
                    offer.versionId()
            );
            licenseIds.add(licenseId);
        }
        return List.copyOf(licenseIds);
    }

    public List<LicenseResponse> findLicenses(UUID ownerUserId) {
        List<LicenseRow> rows = jdbcTemplate.query(
                """
                SELECT license.id,
                       license.feature_product_id,
                       product.code AS feature_code,
                       product.name AS feature_name,
                       version.version,
                       latest_version.id AS latest_version_id,
                       latest_version.version AS latest_version,
                       license.status::text,
                       license.installation_limit,
                       license.acquired_at,
                       license.expires_at,
                       installation.id AS installation_id,
                       installation.bot_id,
                       bot.name AS bot_name,
                       installation.status::text AS installation_status,
                       installation.installed_at
                  FROM private.feature_licenses AS license
                  JOIN shop.feature_products AS product
                    ON product.id = license.feature_product_id
                  JOIN shop.feature_versions AS version
                    ON version.id = license.acquired_version_id
                  LEFT JOIN LATERAL (
                      SELECT candidate.id,candidate.version
                        FROM shop.feature_versions candidate
                       WHERE candidate.feature_product_id=license.feature_product_id
                         AND candidate.status='PUBLISHED'
                       ORDER BY candidate.created_at DESC,candidate.version DESC LIMIT 1
                  ) latest_version ON true
                  LEFT JOIN private.bot_feature_installations AS installation
                    ON installation.license_id = license.id
                   AND installation.removed_at IS NULL
                  LEFT JOIN bots.bot_instances AS bot
                    ON bot.id = installation.bot_id
                 WHERE license.owner_user_id = ?
                 ORDER BY license.acquired_at DESC,
                          license.id,
                          installation.installed_at
                """,
                this::mapLicenseRow,
                ownerUserId
        );

        Map<UUID, LicenseBuilder> licenses = new LinkedHashMap<>();
        for (LicenseRow row : rows) {
            LicenseBuilder builder = licenses.computeIfAbsent(
                    row.id(),
                    ignored -> new LicenseBuilder(row)
            );
            if (row.installation() != null) {
                builder.installations().add(row.installation());
            }
        }
        return licenses.values().stream().map(LicenseBuilder::build).toList();
    }

    public Optional<LicenseContext> findLicense(UUID licenseId, UUID ownerUserId) {
        List<LicenseContext> rows = jdbcTemplate.query(
                """
                SELECT license.id,
                       license.feature_product_id,
                       license.acquired_version_id,
                       license.status::text,
                       license.expires_at,
                       config_set.id AS config_set_id,
                       config_set.revision,
                       config_set.validated_for_bot_id
                  FROM private.feature_licenses AS license
                  JOIN private.feature_config_sets AS config_set
                    ON config_set.license_id = license.id
                 WHERE license.id = ?
                   AND license.owner_user_id = ?
                """,
                (resultSet, rowNumber) -> new LicenseContext(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getObject("feature_product_id", UUID.class),
                        resultSet.getObject("acquired_version_id", UUID.class),
                        resultSet.getString("status"),
                        resultSet.getObject("expires_at", OffsetDateTime.class),
                        resultSet.getObject("config_set_id", UUID.class),
                        resultSet.getLong("revision"),
                        resultSet.getObject("validated_for_bot_id", UUID.class)
                ),
                licenseId,
                ownerUserId
        );
        return rows.stream().findFirst();
    }

    public boolean upgradeLicense(UUID licenseId, UUID ownerUserId) {
        UUID targetVersionId=jdbcTemplate.query("""
                SELECT version.id FROM private.feature_licenses license
                  JOIN shop.feature_versions version
                    ON version.feature_product_id=license.feature_product_id
                   AND version.status='PUBLISHED'
                 WHERE license.id=? AND license.owner_user_id=?
                 ORDER BY version.created_at DESC,version.version DESC LIMIT 1
                """,rs->rs.next()?rs.getObject(1,UUID.class):null,licenseId,ownerUserId);
        return targetVersionId!=null&&Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT private.upgrade_feature_license(?,?,?)",Boolean.class,
                licenseId,ownerUserId,targetVersionId));
    }

    public UUID installFeature(LicenseContext license, UUID ownerUserId, UUID botId) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO private.bot_feature_installations (
                    license_id,
                    owner_user_id,
                    bot_id,
                    feature_product_id,
                    feature_version_id,
                    status
                ) VALUES (?, ?, ?, ?, ?, 'ACTIVE')
                RETURNING id
                """,
                UUID.class,
                license.id(),
                ownerUserId,
                botId,
                license.productId(),
                license.versionId()
        );
    }

    public void clearConfigValidation(UUID configSetId) {
        jdbcTemplate.update(
                """
                UPDATE private.feature_config_sets
                   SET validated_for_bot_id = NULL,
                       validated_at = NULL
                 WHERE id = ?
                """,
                configSetId
        );
    }

    public boolean removeInstallation(UUID installationId, UUID ownerUserId) {
        return jdbcTemplate.update(
                """
                UPDATE private.bot_feature_installations
                   SET status = 'REMOVED', removed_at = now()
                 WHERE id = ?
                   AND owner_user_id = ?
                   AND removed_at IS NULL
                   AND feature_product_id NOT IN (
                       SELECT id FROM shop.feature_products
                WHERE code IN ('bot-presence', 'runtime-expiry-alert', 'bot-permissions')
                   )
                """,
                installationId,
                ownerUserId
        ) == 1;
    }

    public List<ConfigDefinition> findConfigDefinitions(UUID versionId) {
        return jdbcTemplate.query(
                """
                SELECT id, config_key, value_type::text, is_secret
                  FROM shop.feature_config_definitions
                 WHERE feature_version_id = ?
                """,
                (resultSet, rowNumber) -> new ConfigDefinition(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("config_key"),
                        resultSet.getString("value_type"),
                        resultSet.getBoolean("is_secret")
                ),
                versionId
        );
    }

    public FeatureConfigurationResponse findConfiguration(LicenseContext license) {
        List<FeatureConfigurationResponse.FieldResponse> fields = jdbcTemplate.query(
                """
                SELECT definition.config_key,
                       definition.label,
                       definition.description,
                       definition.value_type::text,
                       definition.is_required,
                       definition.is_secret,
                       definition.default_value::text,
                       value.value::text,
                       (secret.id IS NOT NULL) AS secret_configured,
                       definition.validation_schema::text,
                       definition.ui_metadata::text
                  FROM shop.feature_config_definitions AS definition
                  LEFT JOIN private.feature_config_values AS value
                    ON value.config_set_id = ?
                   AND value.definition_id = definition.id
                  LEFT JOIN private.feature_secret_values AS secret
                    ON secret.config_set_id = ?
                   AND secret.definition_id = definition.id
                 WHERE definition.feature_version_id = ?
                 ORDER BY definition.sort_order, definition.config_key
                """,
                (resultSet, rowNumber) -> new FeatureConfigurationResponse.FieldResponse(
                        resultSet.getString("config_key"),
                        resultSet.getString("label"),
                        resultSet.getString("description"),
                        resultSet.getString("value_type"),
                        resultSet.getBoolean("is_required"),
                        resultSet.getBoolean("is_secret"),
                        parseJson(resultSet.getString("default_value")),
                        parseJson(resultSet.getString("value")),
                        resultSet.getBoolean("is_secret")
                                ? resultSet.getBoolean("secret_configured")
                                : resultSet.getString("value") != null,
                        parseJson(resultSet.getString("validation_schema")),
                        parseJson(resultSet.getString("ui_metadata"))
                ),
                license.configSetId(),
                license.configSetId(),
                license.versionId()
        );

        List<FeatureConfigurationResponse.PresentationResponse> presentations = jdbcTemplate.query(
                """
                SELECT slot.id,
                       slot.slot_key,
                       slot.label,
                       slot.description,
                       slot.presentation_type::text,
                       slot.available_variables,
                       slot.default_definition::text,
                       override.definition::text AS override_definition
                  FROM shop.feature_presentation_slots AS slot
                  LEFT JOIN private.feature_presentation_overrides AS override
                    ON override.config_set_id = ?
                   AND override.presentation_slot_id = slot.id
                 WHERE slot.feature_version_id = ?
                 ORDER BY slot.sort_order, slot.slot_key
                """,
                (resultSet, rowNumber) -> new FeatureConfigurationResponse.PresentationResponse(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("slot_key"),
                        resultSet.getString("label"),
                        resultSet.getString("description"),
                        resultSet.getString("presentation_type"),
                        readTextArray(resultSet, "available_variables"),
                        parseJson(resultSet.getString("default_definition")),
                        parseJson(resultSet.getString("override_definition"))
                ),
                license.configSetId(),
                license.versionId()
        );

        return new FeatureConfigurationResponse(
                license.id(),
                license.revision(),
                license.validatedForBotId(),
                fields,
                presentations
        );
    }

    public void upsertConfigValue(
            LicenseContext license,
            UUID definitionId,
            JsonNode value
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO private.feature_config_values (
                    config_set_id,
                    feature_version_id,
                    definition_id,
                    value
                ) VALUES (?, ?, ?, ?::jsonb)
                ON CONFLICT (config_set_id, definition_id) DO UPDATE
                    SET value = EXCLUDED.value
                """,
                license.configSetId(),
                license.versionId(),
                definitionId,
                value.toString()
        );
    }

    public void upsertSecret(
            LicenseContext license,
            UUID definitionId,
            EncryptedSecret secret
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO private.feature_secret_values (
                    config_set_id,
                    feature_version_id,
                    definition_id,
                    ciphertext,
                    nonce,
                    encryption_key_version,
                    fingerprint
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (config_set_id, definition_id) DO UPDATE
                    SET ciphertext = EXCLUDED.ciphertext,
                        nonce = EXCLUDED.nonce,
                        encryption_key_version = EXCLUDED.encryption_key_version,
                        fingerprint = EXCLUDED.fingerprint,
                        rotated_at = now()
                """,
                license.configSetId(),
                license.versionId(),
                definitionId,
                secret.ciphertext(),
                secret.nonce(),
                secret.keyVersion(),
                secret.fingerprint()
        );
    }

    public BotCredential findFeatureSecret(LicenseContext license, UUID definitionId) {
        return jdbcTemplate.query(
                """
                SELECT ciphertext, nonce, encryption_key_version
                  FROM private.feature_secret_values
                 WHERE config_set_id = ? AND definition_id = ?
                """,
                rs -> rs.next()
                        ? new BotCredential(rs.getBytes(1), rs.getBytes(2), rs.getString(3))
                        : null,
                license.configSetId(), definitionId
        );
    }

    public void upsertPresentation(
            LicenseContext license,
            UUID slotId,
            JsonNode definition
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO private.feature_presentation_overrides (
                    config_set_id,
                    feature_version_id,
                    presentation_slot_id,
                    definition
                ) VALUES (?, ?, ?, ?::jsonb)
                ON CONFLICT (config_set_id, presentation_slot_id) DO UPDATE
                    SET definition = EXCLUDED.definition
                """,
                license.configSetId(),
                license.versionId(),
                slotId,
                definition.toString()
        );
    }

    public Map<String, UUID> findPresentationSlots(UUID versionId) {
        Map<String, UUID> slots = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                SELECT slot_key, id
                  FROM shop.feature_presentation_slots
                 WHERE feature_version_id = ?
                """,
                (RowCallbackHandler) resultSet -> slots.put(
                        resultSet.getString("slot_key"),
                        resultSet.getObject("id", UUID.class)
                ),
                versionId
        );
        return Map.copyOf(slots);
    }

    public void bumpConfigRevision(UUID configSetId) {
        jdbcTemplate.update(
                """
                UPDATE private.feature_config_sets
                   SET revision = revision + 1,
                       validated_for_bot_id = NULL,
                       validated_at = NULL
                 WHERE id = ?
                """,
                configSetId
        );
    }

    private FeatureRow mapFeatureRow(ResultSet resultSet, int rowNumber) throws SQLException {
        UUID offerId = resultSet.getObject("offer_id", UUID.class);
        FeatureSummaryResponse.OfferResponse offer = offerId == null ? null
                : new FeatureSummaryResponse.OfferResponse(
                        offerId,
                        resultSet.getString("offer_code"),
                        resultSet.getString("offer_name"),
                        resultSet.getString("offer_kind"),
                        resultSet.getLong("price_satang"),
                        resultSet.getString("currency"),
                        resultSet.getObject("billing_period_days", Integer.class),
                        resultSet.getInt("installation_limit")
                );
        return new FeatureRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("code"),
                resultSet.getString("name"),
                resultSet.getString("description"),
                resultSet.getString("category"),
                resultSet.getString("icon_key"),
                resultSet.getString("image_url") == null ? null
                        : new FeatureSummaryResponse.ImageResponse(
                                resultSet.getString("image_url"),
                                resultSet.getObject("image_width", Integer.class),
                                resultSet.getObject("image_height", Integer.class),
                                resultSet.getString("image_format"),
                                resultSet.getObject("image_bytes", Long.class),
                                resultSet.getString("image_alt_text")
                        ),
                resultSet.getString("tutorial_url"),
                resultSet.getBoolean("is_featured"),
                resultSet.getString("version"),
                offer
        );
    }

    private BotResponse mapBot(ResultSet resultSet, int rowNumber) throws SQLException {
        return new BotResponse(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("name"),
                resultSet.getString("discord_application_id"),
                resultSet.getString("discord_guild_id"),
                resultSet.getString("discord_username"),
                resultSet.getString("discord_avatar_url"),
                resultSet.getString("status"),
                resultSet.getString("desired_state"),
                resultSet.getLong("restart_revision"),
                resultSet.getObject("created_at", OffsetDateTime.class),
                resultSet.getObject("updated_at", OffsetDateTime.class)
        );
    }

    private OrderResponse mapOrder(ResultSet resultSet) throws SQLException {
        UUID orderId = resultSet.getObject("id", UUID.class);
        List<UUID> licenses = jdbcTemplate.queryForList(
                """
                SELECT license.id
                  FROM private.feature_licenses AS license
                  JOIN billing.store_order_items AS item
                    ON item.id = license.order_item_id
                 WHERE item.order_id = ?
                 ORDER BY license.created_at, license.id
                """,
                UUID.class,
                orderId
        );
        return new OrderResponse(
                orderId,
                resultSet.getString("order_number"),
                resultSet.getString("status"),
                resultSet.getLong("total_satang"),
                resultSet.getString("currency"),
                resultSet.getObject("paid_at", OffsetDateTime.class),
                licenses
        );
    }

    private LicenseRow mapLicenseRow(ResultSet resultSet, int rowNumber) throws SQLException {
        UUID installationId = resultSet.getObject("installation_id", UUID.class);
        LicenseResponse.InstallationResponse installation = installationId == null ? null
                : new LicenseResponse.InstallationResponse(
                        installationId,
                        resultSet.getObject("bot_id", UUID.class),
                        resultSet.getString("bot_name"),
                        resultSet.getString("installation_status"),
                        resultSet.getObject("installed_at", OffsetDateTime.class)
                );
        return new LicenseRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("feature_product_id", UUID.class),
                resultSet.getString("feature_code"),
                resultSet.getString("feature_name"),
                resultSet.getString("version"),
                resultSet.getObject("latest_version_id", UUID.class),
                resultSet.getString("latest_version"),
                resultSet.getString("status"),
                resultSet.getInt("installation_limit"),
                resultSet.getObject("acquired_at", OffsetDateTime.class),
                resultSet.getObject("expires_at", OffsetDateTime.class),
                installation
        );
    }

    private JsonNode parseJson(String value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Database contains invalid JSON", exception);
        }
    }

    private List<String> readTextArray(ResultSet resultSet, String column) throws SQLException {
        Array sqlArray = resultSet.getArray(column);
        if (sqlArray == null) {
            return List.of();
        }
        return Arrays.asList((String[]) sqlArray.getArray());
    }

    private record FeatureRow(
            UUID id,
            String code,
            String name,
            String description,
            String category,
            String iconKey,
            FeatureSummaryResponse.ImageResponse image,
            String tutorialUrl,
            boolean featured,
            String version,
            FeatureSummaryResponse.OfferResponse offer
    ) {
    }

    private record FeatureBuilder(
            FeatureRow feature,
            List<FeatureSummaryResponse.OfferResponse> offers
    ) {
        private FeatureBuilder(FeatureRow feature) {
            this(feature, new ArrayList<>());
        }

        private FeatureSummaryResponse build() {
            return new FeatureSummaryResponse(
                    feature.id(), feature.code(), feature.name(), feature.description(),
                    feature.category(), feature.iconKey(), feature.image(), feature.tutorialUrl(),
                    feature.featured(), feature.version(),
                    List.copyOf(offers)
            );
        }
    }

    private record LicenseRow(
            UUID id,
            UUID productId,
            String featureCode,
            String featureName,
            String version,
            UUID latestVersionId,
            String latestVersion,
            String status,
            int installationLimit,
            OffsetDateTime acquiredAt,
            OffsetDateTime expiresAt,
            LicenseResponse.InstallationResponse installation
    ) {
    }

    private record LicenseBuilder(
            LicenseRow license,
            List<LicenseResponse.InstallationResponse> installations
    ) {
        private LicenseBuilder(LicenseRow license) {
            this(license, new ArrayList<>());
        }

        private LicenseResponse build() {
            return new LicenseResponse(
                    license.id(), license.productId(), license.featureCode(), license.featureName(),
                    license.version(),license.latestVersionId(),license.latestVersion(),
                    license.latestVersionId()!=null&&!license.latestVersion().equals(license.version()),
                    license.status(), license.installationLimit(),
                    license.acquiredAt(), license.expiresAt(), List.copyOf(installations)
            );
        }
    }

    public record OfferCheckoutRow(
            UUID id,
            UUID productId,
            UUID versionId,
            String productCode,
            String productName,
            String offerCode,
            String offerName,
            String kind,
            long priceSatang,
            String currency,
            Integer billingPeriodDays,
            int installationLimit
    ) {
    }

    public record OrderContext(
            UUID orderId,
            UUID itemId,
            String orderNumber,
            UUID walletId,
            long totalSatang
    ) {
    }

    public record LicenseContext(
            UUID id,
            UUID productId,
            UUID versionId,
            String status,
            OffsetDateTime expiresAt,
            UUID configSetId,
            long revision,
            UUID validatedForBotId
    ) {
    }

    public record ConfigDefinition(UUID id, String key, String valueType, boolean secret) {
    }

    public record OrderReplay(OrderResponse response, UUID offerId, int quantity) {
    }

    public record EncryptedSecret(
            byte[] ciphertext,
            byte[] nonce,
            String keyVersion,
            byte[] fingerprint
    ) {
    }

    public record FeatureAdminMedia(
            String code,
            String publicId,
            String url,
            Integer width,
            Integer height,
            String format,
            Long bytes,
            String altText,
            String tutorialUrl
    ) {
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record AdminFeatureRow(
            UUID id, String code, String name, String description, String category, String iconKey,
            String imageUrl, String imageAltText, String tutorialUrl, String status,
            boolean featured, int sortOrder, String latestVersion, String versionStatus,
            OffsetDateTime publishedAt, AdminStoreResponses.Offer offer
    ) {}

    private static final class AdminFeatureAccumulator {
        private final AdminFeatureRow row;
        private final List<AdminStoreResponses.Offer> offers = new ArrayList<>();
        private AdminFeatureAccumulator(AdminFeatureRow row) { this.row = row; }
        private AdminStoreResponses.Feature response() {
            return new AdminStoreResponses.Feature(row.id(), row.code(), row.name(), row.description(),
                    row.category(), row.iconKey(), row.imageUrl(), row.imageAltText(), row.tutorialUrl(),
                    row.status(), row.featured(), row.sortOrder(), row.latestVersion(), row.versionStatus(),
                    row.publishedAt(), List.copyOf(offers));
        }
    }

    private record CustomerWallet(UUID customerId, UUID walletId) {
    }
}
