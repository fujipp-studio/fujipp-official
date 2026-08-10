package com.fujipp.backend.runtime;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class RuntimeRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public RuntimeRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<BotRow> findRunnableBots() {
        return jdbcTemplate.query(
                """
                SELECT bot.id, bot.name, bot.discord_application_id, bot.discord_guild_id,
                       bot.restart_revision,
                       subscription.id AS runtime_subscription_id,
                       subscription.current_period_end,
                       subscription.auto_renew,
                       credential.ciphertext, credential.nonce,
                       credential.encryption_key_version
                  FROM bots.bot_instances AS bot
                  JOIN private.bot_credentials AS credential
                    ON credential.bot_id = bot.id
                   AND credential.credential_key = 'DISCORD_TOKEN'
                  JOIN LATERAL (
                       SELECT live.id, live.current_period_end, live.auto_renew,
                              live.status, live.grace_until
                         FROM private.runtime_subscriptions AS live
                        WHERE live.bot_id = bot.id
                          AND live.status IN ('ACTIVE','GRACE')
                        ORDER BY live.current_period_end DESC
                        LIMIT 1
                  ) AS subscription ON true
                 WHERE bot.status <> 'DECOMMISSIONED'
                   AND bot.desired_state = 'RUNNING'
                   AND now() < CASE WHEN subscription.status = 'GRACE'
                       THEN subscription.grace_until
                       ELSE subscription.current_period_end + interval '3 hours' END
                 ORDER BY bot.id
                """,
                (rs, row) -> new BotRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("discord_application_id"),
                        rs.getString("discord_guild_id"),
                        rs.getLong("restart_revision"),
                        rs.getObject("runtime_subscription_id", UUID.class),
                        rs.getObject("current_period_end", java.time.OffsetDateTime.class),
                        rs.getBoolean("auto_renew"),
                        rs.getBytes("ciphertext"),
                        rs.getBytes("nonce"),
                        rs.getString("encryption_key_version")
                )
        );
    }

    public List<FeatureRow> findFeatures(UUID botId) {
        return jdbcTemplate.query(
                """
                SELECT installation.id, product.code, version.version,
                       version.runtime_key, config.id AS config_set_id,
                       config.revision
                  FROM private.bot_feature_installations AS installation
                  JOIN private.feature_licenses AS license ON license.id = installation.license_id
                  JOIN shop.feature_products AS product ON product.id = installation.feature_product_id
                  JOIN shop.feature_versions AS version ON version.id = installation.feature_version_id
                  JOIN private.feature_config_sets AS config ON config.license_id = license.id
                 WHERE installation.bot_id = ?
                   AND installation.removed_at IS NULL
                   AND installation.status IN ('INSTALLING', 'ACTIVE')
                   AND license.status = 'ACTIVE'
                   AND (license.expires_at IS NULL OR license.expires_at > now())
                 ORDER BY product.code
                """,
                (rs, row) -> new FeatureRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("code"),
                        rs.getString("version"),
                        rs.getString("runtime_key"),
                        rs.getObject("config_set_id", UUID.class),
                        rs.getLong("revision")
                ),
                botId
        );
    }

    public Map<String, JsonNode> findConfig(UUID configSetId) {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                SELECT definition.config_key,
                       COALESCE(value.value, definition.default_value)::text
                  FROM private.feature_config_sets AS config
                  JOIN shop.feature_config_definitions AS definition
                    ON definition.feature_version_id = config.feature_version_id
                   AND definition.is_secret = false
                  LEFT JOIN private.feature_config_values AS value
                    ON value.config_set_id = config.id
                   AND value.definition_id = definition.id
                 WHERE config.id = ?
                   AND COALESCE(value.value, definition.default_value) IS NOT NULL
                 ORDER BY definition.config_key
                """,
                (RowCallbackHandler) rs -> values.put(rs.getString(1), parseJson(rs.getString(2))),
                configSetId
        );
        return values;
    }

    public List<SecretRow> findSecrets(UUID configSetId) {
        return jdbcTemplate.query(
                """
                SELECT definition.config_key, secret.ciphertext, secret.nonce,
                       secret.encryption_key_version
                  FROM private.feature_secret_values AS secret
                  JOIN shop.feature_config_definitions AS definition
                    ON definition.id = secret.definition_id
                 WHERE secret.config_set_id = ?
                 ORDER BY definition.config_key
                """,
                (rs, row) -> new SecretRow(
                        rs.getString("config_key"),
                        rs.getBytes("ciphertext"),
                        rs.getBytes("nonce"),
                        rs.getString("encryption_key_version")
                ),
                configSetId
        );
    }

    public Map<String, JsonNode> findPresentations(UUID configSetId) {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                SELECT slot.slot_key, COALESCE(override.definition, slot.default_definition)::text
                  FROM shop.feature_presentation_slots AS slot
                  JOIN private.feature_config_sets AS config
                    ON config.feature_version_id = slot.feature_version_id
                  LEFT JOIN private.feature_presentation_overrides AS override
                    ON override.config_set_id = config.id
                   AND override.presentation_slot_id = slot.id
                 WHERE config.id = ?
                 ORDER BY slot.slot_key
                """,
                (RowCallbackHandler) rs -> values.put(rs.getString(1), parseJson(rs.getString(2))),
                configSetId
        );
        return values;
    }

    public Map<String, JsonNode> findState(UUID installationId) {
        return jdbcTemplate.query(
                "SELECT state::text FROM private.feature_runtime_states WHERE installation_id = ?",
                rs -> rs.next() ? objectFields(parseJson(rs.getString(1))) : Map.of(),
                installationId
        );
    }

    public boolean upsertState(RuntimeStateRequest request) {
        return jdbcTemplate.update(
                """
                INSERT INTO private.feature_runtime_states (installation_id, bot_id, state)
                SELECT installation.id, installation.bot_id, ?::jsonb
                  FROM private.bot_feature_installations AS installation
                 WHERE installation.id = ?
                   AND installation.bot_id = ?
                   AND installation.removed_at IS NULL
                   AND installation.status IN ('INSTALLING', 'ACTIVE')
                ON CONFLICT (installation_id) DO UPDATE
                    SET state = EXCLUDED.state,
                        updated_at = now()
                """,
                request.state().toString(), request.installationId(), request.botId()
        ) > 0;
    }

    public void updateStatus(RuntimeStatusRequest request) {
        if (request.installationId() == null) {
            jdbcTemplate.update(
                    """
                    UPDATE bots.bot_instances
                       SET status = ?::bots.bot_status,
                           discord_username = COALESCE(?, discord_username),
                           discord_avatar_url = COALESCE(?, discord_avatar_url),
                           last_started_at = CASE WHEN ? = 'RUNNING' THEN now() ELSE last_started_at END,
                           last_stopped_at = CASE WHEN ? IN ('STOPPED', 'CRASHED') THEN now() ELSE last_stopped_at END
                     WHERE id = ?
                    """,
                    request.status(), request.discordUsername(), request.discordAvatarUrl(),
                    request.status(), request.status(), request.botId()
            );
            return;
        }
        jdbcTemplate.update(
                """
                UPDATE private.bot_feature_installations
                   SET status = ?::private.feature_installation_status,
                       last_error_code = ?,
                       last_error_message = ?
                 WHERE id = ? AND bot_id = ? AND removed_at IS NULL
                """,
                request.status(), request.errorCode(), request.errorMessage(),
                request.installationId(), request.botId()
        );
    }

    private JsonNode parseJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Database contains invalid runtime JSON", exception);
        }
    }

    private Map<String, JsonNode> objectFields(JsonNode node) {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        node.properties().forEach(entry -> values.put(entry.getKey(), entry.getValue()));
        return values;
    }

    public record BotRow(UUID id, String name, String applicationId, String guildId,
                         long restartRevision, UUID runtimeSubscriptionId,
                         java.time.OffsetDateTime currentPeriodEnd, boolean autoRenew,
                         byte[] ciphertext, byte[] nonce, String keyVersion) {
    }

    public record FeatureRow(UUID installationId, String code, String version,
                             String runtimeKey, UUID configSetId, long revision) {
    }

    public record SecretRow(String key, byte[] ciphertext, byte[] nonce, String keyVersion) {
    }
}
