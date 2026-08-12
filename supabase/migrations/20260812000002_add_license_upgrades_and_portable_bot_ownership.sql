ALTER TABLE billing.store_order_items
    ADD CONSTRAINT store_order_items_id_product_key UNIQUE (id, feature_product_id);

ALTER TABLE private.feature_licenses
    DROP CONSTRAINT feature_licenses_order_item_fkey;
ALTER TABLE private.feature_licenses
    ADD CONSTRAINT feature_licenses_order_item_fkey
    FOREIGN KEY (order_item_id, feature_product_id)
    REFERENCES billing.store_order_items (id, feature_product_id)
    ON DELETE RESTRICT;

ALTER TABLE private.bot_feature_installations
    DROP CONSTRAINT bot_feature_installations_license_owner_fkey;
ALTER TABLE private.bot_feature_installations
    ADD CONSTRAINT bot_feature_installations_license_owner_fkey
    FOREIGN KEY (license_id, owner_user_id)
    REFERENCES private.feature_licenses (id, owner_user_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE FUNCTION private.upgrade_feature_license(
    p_license_id UUID,
    p_owner_user_id UUID,
    p_target_version_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    license private.feature_licenses;
    config_set private.feature_config_sets;
    target shop.feature_versions;
BEGIN
    SELECT * INTO license FROM private.feature_licenses
     WHERE id=p_license_id AND owner_user_id=p_owner_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF license.status <> 'ACTIVE' OR (license.expires_at IS NOT NULL AND license.expires_at <= now()) THEN
        RAISE EXCEPTION 'feature license is not active';
    END IF;

    SELECT * INTO target FROM shop.feature_versions
     WHERE id=p_target_version_id AND feature_product_id=license.feature_product_id
       AND status='PUBLISHED';
    IF NOT FOUND THEN RAISE EXCEPTION 'target feature version is not published'; END IF;
    IF target.id=license.acquired_version_id THEN RETURN true; END IF;

    SELECT * INTO config_set FROM private.feature_config_sets
     WHERE license_id=p_license_id FOR UPDATE;

    CREATE TEMP TABLE upgrade_values ON COMMIT DROP AS
    SELECT target_definition.id definition_id, value.value
      FROM private.feature_config_values value
      JOIN shop.feature_config_definitions source_definition ON source_definition.id=value.definition_id
      JOIN shop.feature_config_definitions target_definition
        ON target_definition.feature_version_id=target.id
       AND target_definition.config_key=source_definition.config_key
       AND target_definition.value_type=source_definition.value_type
       AND target_definition.is_secret=false
     WHERE value.config_set_id=config_set.id;

    CREATE TEMP TABLE upgrade_secrets ON COMMIT DROP AS
    SELECT target_definition.id definition_id, secret.ciphertext, secret.nonce,
           secret.encryption_algorithm, secret.encryption_key_version, secret.fingerprint,
           secret.configured_at, secret.rotated_at
      FROM private.feature_secret_values secret
      JOIN shop.feature_config_definitions source_definition ON source_definition.id=secret.definition_id
      JOIN shop.feature_config_definitions target_definition
        ON target_definition.feature_version_id=target.id
       AND target_definition.config_key=source_definition.config_key
       AND target_definition.value_type=source_definition.value_type
       AND target_definition.is_secret=true
     WHERE secret.config_set_id=config_set.id;

    CREATE TEMP TABLE upgrade_presentations ON COMMIT DROP AS
    SELECT target_slot.id slot_id, override.definition
      FROM private.feature_presentation_overrides override
      JOIN shop.feature_presentation_slots source_slot ON source_slot.id=override.presentation_slot_id
      JOIN shop.feature_presentation_slots target_slot
        ON target_slot.feature_version_id=target.id AND target_slot.slot_key=source_slot.slot_key
     WHERE override.config_set_id=config_set.id;

    DELETE FROM private.feature_config_values WHERE config_set_id=config_set.id;
    DELETE FROM private.feature_secret_values WHERE config_set_id=config_set.id;
    DELETE FROM private.feature_presentation_overrides WHERE config_set_id=config_set.id;

    UPDATE private.feature_config_sets
       SET feature_version_id=target.id,revision=revision+1,
           validated_for_bot_id=NULL,validated_at=NULL,updated_at=now()
     WHERE id=config_set.id;
    UPDATE private.feature_licenses SET acquired_version_id=target.id,updated_at=now()
     WHERE id=p_license_id;
    UPDATE private.bot_feature_installations
       SET feature_version_id=target.id,updated_at=now()
     WHERE license_id=p_license_id AND removed_at IS NULL;

    INSERT INTO private.feature_config_values(config_set_id,feature_version_id,definition_id,value)
    SELECT config_set.id,target.id,definition_id,value FROM upgrade_values;
    INSERT INTO private.feature_secret_values(
        config_set_id,feature_version_id,definition_id,ciphertext,nonce,encryption_algorithm,
        encryption_key_version,fingerprint,configured_at,rotated_at
    ) SELECT config_set.id,target.id,definition_id,ciphertext,nonce,encryption_algorithm,
             encryption_key_version,fingerprint,configured_at,rotated_at FROM upgrade_secrets;
    INSERT INTO private.feature_presentation_overrides(
        config_set_id,feature_version_id,presentation_slot_id,definition
    ) SELECT config_set.id,target.id,slot_id,definition FROM upgrade_presentations;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.upgrade_feature_license(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.upgrade_feature_license(UUID,UUID,UUID) TO service_role;

CREATE OR REPLACE FUNCTION private.admin_transfer_bot(p_bot_id UUID, p_new_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_owner UUID;
BEGIN
    SELECT owner_user_id INTO current_owner FROM bots.bot_instances
     WHERE id=p_bot_id AND status <> 'DECOMMISSIONED' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF current_owner=p_new_owner_user_id THEN RETURN true; END IF;
    IF NOT EXISTS (SELECT 1 FROM private.user_accounts WHERE user_id=p_new_owner_user_id) THEN
        RAISE EXCEPTION 'new bot owner was not found';
    END IF;
    IF EXISTS (
        SELECT 1 FROM private.bot_feature_installations selected
         WHERE selected.bot_id=p_bot_id AND selected.removed_at IS NULL
           AND EXISTS (
               SELECT 1 FROM private.bot_feature_installations other
                WHERE other.license_id=selected.license_id AND other.removed_at IS NULL
                  AND other.bot_id<>p_bot_id
           )
    ) THEN RAISE EXCEPTION 'a feature license is shared with another bot'; END IF;

    SET CONSTRAINTS bot_credentials_bot_owner_fkey,
                    bot_feature_installations_license_owner_fkey DEFERRED;

    UPDATE private.feature_config_sets SET validated_for_bot_id=NULL,validated_at=NULL
     WHERE validated_for_bot_id=p_bot_id;
    UPDATE private.feature_licenses SET owner_user_id=p_new_owner_user_id,updated_at=now()
     WHERE id IN (SELECT license_id FROM private.bot_feature_installations
                   WHERE bot_id=p_bot_id AND removed_at IS NULL);
    UPDATE bots.bot_instances
       SET owner_user_id=p_new_owner_user_id,desired_state='STOPPED'
     WHERE id=p_bot_id;
    UPDATE private.bot_feature_installations
       SET owner_user_id=p_new_owner_user_id,updated_at=now()
     WHERE bot_id=p_bot_id AND removed_at IS NULL;
    UPDATE private.runtime_subscriptions
       SET owner_user_id=p_new_owner_user_id,updated_at=now() WHERE bot_id=p_bot_id;
    UPDATE private.bot_credentials SET owner_user_id=p_new_owner_user_id,updated_at=now()
     WHERE bot_id=p_bot_id;
    RETURN true;
END;
$$;
