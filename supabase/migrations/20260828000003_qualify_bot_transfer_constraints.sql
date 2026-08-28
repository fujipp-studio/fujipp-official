-- SECURITY DEFINER functions use an empty search_path. Qualify deferred
-- constraints so PostgreSQL can resolve them during an ownership transfer.

CREATE OR REPLACE FUNCTION private.admin_transfer_bot(
    p_bot_id UUID,
    p_new_owner_user_id UUID,
    p_keep_running BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_owner UUID;
    selected_license private.feature_licenses;
    new_license_id UUID;
    old_config_id UUID;
    new_config_id UUID;
    other_active_installations INTEGER;
BEGIN
    SELECT owner_user_id INTO current_owner FROM bots.bot_instances
     WHERE id = p_bot_id AND status <> 'DECOMMISSIONED' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF current_owner = p_new_owner_user_id THEN RETURN true; END IF;
    IF NOT EXISTS (SELECT 1 FROM private.user_accounts WHERE user_id = p_new_owner_user_id) THEN
        RAISE EXCEPTION 'new bot owner was not found';
    END IF;
    IF EXISTS (SELECT 1 FROM bots.bot_instances
                WHERE owner_user_id = p_new_owner_user_id
                  AND name = (SELECT name FROM bots.bot_instances WHERE id = p_bot_id)) THEN
        RAISE EXCEPTION 'target owner already has a bot with this name';
    END IF;

    CREATE TEMP TABLE transfer_license_map (
        old_license_id UUID PRIMARY KEY,
        new_license_id UUID NOT NULL,
        shared BOOLEAN NOT NULL
    ) ON COMMIT DROP;

    SET CONSTRAINTS private.bot_credentials_bot_owner_fkey,
                    private.bot_feature_installations_license_owner_fkey DEFERRED;

    FOR selected_license IN
        SELECT license.* FROM private.feature_licenses license
         WHERE license.id IN (
             SELECT installation.license_id FROM private.bot_feature_installations installation
              WHERE installation.bot_id = p_bot_id AND installation.removed_at IS NULL
         )
         FOR UPDATE
    LOOP
        SELECT count(*) INTO other_active_installations
          FROM private.bot_feature_installations installation
         WHERE installation.license_id = selected_license.id
           AND installation.bot_id <> p_bot_id
           AND installation.removed_at IS NULL;

        IF other_active_installations > 0 THEN
            IF selected_license.installation_limit <= 1 THEN
                RAISE EXCEPTION 'shared feature license has no transferable installation seat';
            END IF;
            UPDATE private.feature_licenses
               SET installation_limit = installation_limit - 1, updated_at = now()
             WHERE id = selected_license.id;
        ELSE
            -- Keep the purchased license attached to its original order/owner for
            -- audit history, but prevent the previous owner from reusing it.
            UPDATE private.feature_licenses
               SET status = 'REVOKED',
                   revoked_at = COALESCE(revoked_at, now()),
                   updated_at = now()
             WHERE id = selected_license.id;
        END IF;

        INSERT INTO private.feature_licenses (
            owner_user_id, feature_product_id, acquired_version_id, source, status,
            installation_limit, granted_by, acquired_at, expires_at, suspended_at, revoked_at
        ) VALUES (
            p_new_owner_user_id, selected_license.feature_product_id,
            selected_license.acquired_version_id, 'GRANT', selected_license.status, 1,
            p_new_owner_user_id, selected_license.acquired_at, selected_license.expires_at,
            selected_license.suspended_at, selected_license.revoked_at
        ) RETURNING id INTO new_license_id;

        SELECT id INTO old_config_id FROM private.feature_config_sets
         WHERE license_id = selected_license.id;
        INSERT INTO private.feature_config_sets (
            license_id, feature_product_id, feature_version_id, revision,
            validated_for_bot_id, validated_at, created_at, updated_at
        )
        SELECT new_license_id, feature_product_id, feature_version_id, revision,
               NULL, NULL, created_at, now()
          FROM private.feature_config_sets WHERE id = old_config_id
        RETURNING id INTO new_config_id;

        INSERT INTO private.feature_config_values (
            config_set_id, feature_version_id, definition_id, value, created_at, updated_at
        ) SELECT new_config_id, feature_version_id, definition_id, value, created_at, now()
            FROM private.feature_config_values WHERE config_set_id = old_config_id;
        INSERT INTO private.feature_secret_values (
            config_set_id, feature_version_id, definition_id, ciphertext, nonce,
            encryption_algorithm, encryption_key_version, fingerprint, configured_at,
            rotated_at, created_at, updated_at
        ) SELECT new_config_id, feature_version_id, definition_id, ciphertext, nonce,
                 encryption_algorithm, encryption_key_version, fingerprint, configured_at,
                 rotated_at, created_at, now()
            FROM private.feature_secret_values WHERE config_set_id = old_config_id;
        INSERT INTO private.feature_presentation_overrides (
            config_set_id, feature_version_id, presentation_slot_id, definition, created_at, updated_at
        ) SELECT new_config_id, feature_version_id, presentation_slot_id, definition, created_at, now()
            FROM private.feature_presentation_overrides WHERE config_set_id = old_config_id;

        INSERT INTO transfer_license_map VALUES (selected_license.id, new_license_id, true);
    END LOOP;

    UPDATE private.feature_config_sets config
       SET validated_for_bot_id = NULL, validated_at = NULL, updated_at = now()
      FROM transfer_license_map mapping
     WHERE NOT mapping.shared AND config.license_id = mapping.old_license_id;

    UPDATE bots.bot_instances
       SET owner_user_id = p_new_owner_user_id,
           desired_state = CASE WHEN p_keep_running THEN desired_state
                                ELSE 'STOPPED'::bots.bot_desired_state END,
           updated_at = now()
     WHERE id = p_bot_id;

    UPDATE private.bot_feature_installations installation
       SET owner_user_id = p_new_owner_user_id, updated_at = now()
      FROM transfer_license_map mapping
     WHERE NOT mapping.shared AND installation.license_id = mapping.old_license_id;

    UPDATE private.bot_feature_installations installation
       SET license_id = mapping.new_license_id,
           owner_user_id = p_new_owner_user_id,
           updated_at = now()
      FROM transfer_license_map mapping
     WHERE mapping.shared
       AND installation.license_id = mapping.old_license_id
       AND installation.bot_id = p_bot_id;

    UPDATE private.runtime_subscriptions
       SET owner_user_id = p_new_owner_user_id, updated_at = now()
     WHERE bot_id = p_bot_id;
    UPDATE private.bot_credentials
       SET owner_user_id = p_new_owner_user_id, updated_at = now()
     WHERE bot_id = p_bot_id;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_transfer_bot(UUID, UUID, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.admin_transfer_bot(UUID, UUID, BOOLEAN) TO service_role;


