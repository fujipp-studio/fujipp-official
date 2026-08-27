CREATE OR REPLACE FUNCTION private.validate_feature_license_acquisition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    order_item billing.store_order_items;
    order_status billing.store_order_status;
    order_owner_user_id UUID;
    issued_count INTEGER;
BEGIN
    IF NEW.source = 'GRANT' THEN RETURN NEW; END IF;

    SELECT item.* INTO order_item FROM billing.store_order_items item
     WHERE item.id = NEW.order_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'store order item does not exist'; END IF;

    SELECT store_order.status, customer.user_id
      INTO order_status, order_owner_user_id
      FROM billing.store_orders store_order
      JOIN billing.customers customer ON customer.id = store_order.customer_id
     WHERE store_order.id = order_item.order_id;
    IF order_status <> 'PAID' THEN RAISE EXCEPTION 'feature licenses require a paid store order'; END IF;
    IF order_owner_user_id IS NULL OR (
        NEW.owner_user_id <> order_owner_user_id
        AND NOT (TG_OP = 'UPDATE' AND NEW.owner_user_id = OLD.owner_user_id)
    ) THEN
        RAISE EXCEPTION 'feature license owner differs from store order owner';
    END IF;

    -- A shared purchased license may be split when one installed bot is transferred.
    -- Each split reduces the original capacity by exactly one; the transferred bot
    -- receives a one-seat grant, so the total number of entitled seats is unchanged.
    IF NEW.installation_limit <> order_item.installation_limit_snapshot
       AND NOT (
           TG_OP = 'UPDATE'
           AND NEW.installation_limit = OLD.installation_limit - 1
           AND NEW.order_item_id = OLD.order_item_id
           AND NEW.source = OLD.source
           AND NEW.acquired_at = OLD.acquired_at
           AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
       ) THEN
        RAISE EXCEPTION 'feature license installation limit differs from purchase';
    END IF;

    IF order_item.offer_kind_snapshot = 'SUBSCRIPTION' THEN
        IF NEW.expires_at IS NULL OR NEW.expires_at <> NEW.acquired_at
                + make_interval(days => order_item.billing_period_days_snapshot) THEN
            RAISE EXCEPTION 'subscription license expiry differs from purchase';
        END IF;
    ELSIF NEW.expires_at IS NOT NULL THEN
        RAISE EXCEPTION 'one-time feature licenses do not expire';
    END IF;

    SELECT count(*) INTO issued_count FROM private.feature_licenses feature_license
     WHERE feature_license.order_item_id = NEW.order_item_id
       AND feature_license.id IS DISTINCT FROM NEW.id;
    IF issued_count >= order_item.quantity THEN
        RAISE EXCEPTION 'store order item license quantity exceeded';
    END IF;
    RETURN NEW;
END;
$$;

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

    SET CONSTRAINTS bot_credentials_bot_owner_fkey,
                    bot_feature_installations_license_owner_fkey DEFERRED;

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

        IF other_active_installations = 0 THEN
            UPDATE private.feature_licenses
               SET owner_user_id = p_new_owner_user_id, updated_at = now()
             WHERE id = selected_license.id;
            INSERT INTO transfer_license_map VALUES (selected_license.id, selected_license.id, false);
            CONTINUE;
        END IF;

        IF selected_license.installation_limit <= 1 THEN
            RAISE EXCEPTION 'shared feature license has no transferable installation seat';
        END IF;

        UPDATE private.feature_licenses
           SET installation_limit = installation_limit - 1, updated_at = now()
         WHERE id = selected_license.id;

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
