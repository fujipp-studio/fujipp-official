INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'f1200000-0000-0000-0000-000000000001', 'bot-permissions', 'Bot Permissions',
    'Controls which Discord roles and users may run each bot command. Administrators are always allowed.',
    'DISCORD_UTILITY', 'shield-check', 'ACTIVE', 15
) ON CONFLICT (code) DO UPDATE
 SET name = EXCLUDED.name, description = EXCLUDED.description,
     status = 'ACTIVE', sort_order = EXCLUDED.sort_order;

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status, published_at
) SELECT
    'f1200000-0000-0000-0000-000000000002', id, '1.0.0', 'bot-permissions',
    'Initial per-command role and user permission rules with Administrator bypass.',
    'PUBLISHED', now()
  FROM shop.feature_products WHERE code = 'bot-permissions'
ON CONFLICT (feature_product_id, version) DO UPDATE
 SET runtime_key = EXCLUDED.runtime_key, status = 'PUBLISHED',
     published_at = COALESCE(shop.feature_versions.published_at, now());

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT fv.id, 'COMMAND_PERMISSION_RULES', 'Command permissions',
       'กำหนด Role IDs หรือ User IDs ที่ใช้แต่ละ command/subcommand ได้ หากไม่มีกฎจะคงสิทธิ์เดิมของ Feature',
       'JSON', true, false, '[]'::jsonb,
       '{"type":"array","maxItems":100,"items":{"type":"object","required":["command","roleIds","userIds"],"properties":{"command":{"type":"string","minLength":1,"maxLength":80},"roleIds":{"type":"array","items":{"type":"string","pattern":"^[0-9]{15,30}$"}},"userIds":{"type":"array","items":{"type":"string","pattern":"^[0-9]{15,30}$"}}}}}'::jsonb,
       '{"control":"command-permissions"}'::jsonb, 10
  FROM shop.feature_versions fv
  JOIN shop.feature_products fp ON fp.id = fv.feature_product_id
 WHERE fp.code = 'bot-permissions' AND fv.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO UPDATE
 SET label = EXCLUDED.label, description = EXCLUDED.description,
     validation_schema = EXCLUDED.validation_schema, ui_metadata = EXCLUDED.ui_metadata;

CREATE OR REPLACE FUNCTION private.install_core_features_for_bot(
    target_bot_id UUID, target_owner_user_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE core RECORD; new_license_id UUID;
BEGIN
    FOR core IN
        SELECT product.id AS product_id, version.id AS version_id
          FROM shop.feature_products product
          JOIN shop.feature_versions version ON version.feature_product_id = product.id AND version.version = '1.0.0'
         WHERE product.code IN ('bot-presence', 'runtime-expiry-alert', 'bot-permissions')
           AND product.status = 'ACTIVE' AND version.status = 'PUBLISHED'
         ORDER BY product.code
    LOOP
        IF EXISTS (SELECT 1 FROM private.bot_feature_installations installation
                    WHERE installation.bot_id = target_bot_id
                      AND installation.feature_product_id = core.product_id
                      AND installation.removed_at IS NULL) THEN CONTINUE; END IF;
        INSERT INTO private.feature_licenses (
            owner_user_id, feature_product_id, acquired_version_id, source, installation_limit, granted_by
        ) VALUES (target_owner_user_id, core.product_id, core.version_id, 'GRANT', 1, target_owner_user_id)
        RETURNING id INTO new_license_id;
        INSERT INTO private.feature_config_sets (
            license_id, feature_product_id, feature_version_id, validated_for_bot_id, validated_at
        ) VALUES (new_license_id, core.product_id, core.version_id, target_bot_id, now());
        INSERT INTO private.bot_feature_installations (
            license_id, owner_user_id, bot_id, feature_product_id, feature_version_id, status
        ) VALUES (new_license_id, target_owner_user_id, target_bot_id, core.product_id, core.version_id, 'ACTIVE');
    END LOOP;
END;
$$;

DO $$ DECLARE bot RECORD; BEGIN
    FOR bot IN SELECT id, owner_user_id FROM bots.bot_instances WHERE status <> 'DECOMMISSIONED'
    LOOP PERFORM private.install_core_features_for_bot(bot.id, bot.owner_user_id); END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.install_core_features_for_bot(UUID, UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION private.install_core_features_for_bot(UUID, UUID) IS
    'Idempotently grants and installs Bot Presence, Runtime Expiry Alert, and Bot Permissions for one bot.';
