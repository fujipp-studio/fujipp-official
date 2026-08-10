
UPDATE shop.feature_products
SET status = 'ACTIVE'
WHERE code IN ('bot-presence', 'runtime-expiry-alert');

UPDATE shop.feature_versions AS version
SET status = 'PUBLISHED', published_at = COALESCE(published_at, now())
FROM shop.feature_products AS product
WHERE version.feature_product_id = product.id
  AND product.code IN ('bot-presence', 'runtime-expiry-alert')
  AND version.version = '1.0.0';

CREATE FUNCTION private.install_core_features_for_bot(
    target_bot_id UUID,
    target_owner_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    core RECORD;
    new_license_id UUID;
BEGIN
    FOR core IN
        SELECT product.id AS product_id, version.id AS version_id
          FROM shop.feature_products AS product
          JOIN shop.feature_versions AS version
            ON version.feature_product_id = product.id
           AND version.version = '1.0.0'
         WHERE product.code IN ('bot-presence', 'runtime-expiry-alert')
           AND product.status = 'ACTIVE'
           AND version.status = 'PUBLISHED'
         ORDER BY product.code
    LOOP
        IF EXISTS (
            SELECT 1
              FROM private.bot_feature_installations AS installation
             WHERE installation.bot_id = target_bot_id
               AND installation.feature_product_id = core.product_id
               AND installation.removed_at IS NULL
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO private.feature_licenses (
            owner_user_id, feature_product_id, acquired_version_id, source,
            installation_limit, granted_by
        ) VALUES (
            target_owner_user_id, core.product_id, core.version_id, 'GRANT', 1,
            target_owner_user_id
        ) RETURNING id INTO new_license_id;

        INSERT INTO private.feature_config_sets (
            license_id, feature_product_id, feature_version_id,
            validated_for_bot_id, validated_at
        ) VALUES (
            new_license_id, core.product_id, core.version_id,
            target_bot_id, now()
        );

        INSERT INTO private.bot_feature_installations (
            license_id, owner_user_id, bot_id, feature_product_id,
            feature_version_id, status
        ) VALUES (
            new_license_id, target_owner_user_id, target_bot_id,
            core.product_id, core.version_id, 'ACTIVE'
        );
    END LOOP;
END;
$$;

CREATE FUNCTION private.install_core_features_after_bot_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM private.install_core_features_for_bot(NEW.id, NEW.owner_user_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER bot_instances_install_core_features
    AFTER INSERT OR UPDATE OF owner_user_id
    ON bots.bot_instances
    FOR EACH ROW EXECUTE FUNCTION private.install_core_features_after_bot_change();

DO $$
DECLARE bot RECORD;
BEGIN
    FOR bot IN
        SELECT id, owner_user_id
          FROM bots.bot_instances
         WHERE status <> 'DECOMMISSIONED'
    LOOP
        PERFORM private.install_core_features_for_bot(bot.id, bot.owner_user_id);
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.install_core_features_for_bot(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.install_core_features_after_bot_change()
    FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.install_core_features_for_bot(UUID, UUID) IS
    'Idempotently grants and installs Bot Presence and Runtime Expiry Alert for one bot.';
