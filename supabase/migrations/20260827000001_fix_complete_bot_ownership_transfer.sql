CREATE FUNCTION private.admin_transfer_bot(
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
    transferred_license_ids UUID[];
BEGIN
    SELECT owner_user_id
      INTO current_owner
      FROM bots.bot_instances
     WHERE id = p_bot_id
       AND status <> 'DECOMMISSIONED'
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;
    IF current_owner = p_new_owner_user_id THEN
        RETURN true;
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM private.user_accounts
         WHERE user_id = p_new_owner_user_id
    ) THEN
        RAISE EXCEPTION 'new bot owner was not found';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT installation.license_id), ARRAY[]::UUID[])
      INTO transferred_license_ids
      FROM private.bot_feature_installations AS installation
     WHERE installation.bot_id = p_bot_id
       AND installation.removed_at IS NULL;

    IF EXISTS (
        SELECT 1
          FROM private.bot_feature_installations AS installation
         WHERE installation.license_id = ANY(transferred_license_ids)
           AND installation.removed_at IS NULL
           AND installation.bot_id <> p_bot_id
    ) THEN
        RAISE EXCEPTION 'a feature license is shared with another bot';
    END IF;

    SET CONSTRAINTS bot_credentials_bot_owner_fkey,
                    bot_feature_installations_license_owner_fkey DEFERRED;

    -- Config values, secrets, and presentation overrides belong to the license and
    -- remain intact. Only clear their validation because the bot will restart under
    -- a different owner.
    UPDATE private.feature_config_sets
       SET validated_for_bot_id = NULL,
           validated_at = NULL,
           updated_at = now()
     WHERE license_id = ANY(transferred_license_ids);

    UPDATE private.feature_licenses
       SET owner_user_id = p_new_owner_user_id,
           updated_at = now()
     WHERE id = ANY(transferred_license_ids);

    UPDATE bots.bot_instances
       SET owner_user_id = p_new_owner_user_id,
           desired_state = CASE
               WHEN p_keep_running THEN desired_state
               ELSE 'STOPPED'::bots.bot_desired_state
           END,
           updated_at = now()
     WHERE id = p_bot_id;

    -- The license-owner foreign key also covers removed installation history.
    -- Move every row for each transferred license so the deferred constraint is
    -- valid at commit, while preserving the full installation history.
    UPDATE private.bot_feature_installations
       SET owner_user_id = p_new_owner_user_id,
           updated_at = now()
     WHERE license_id = ANY(transferred_license_ids);

    UPDATE private.runtime_subscriptions
       SET owner_user_id = p_new_owner_user_id,
           updated_at = now()
     WHERE bot_id = p_bot_id;

    UPDATE private.bot_credentials
       SET owner_user_id = p_new_owner_user_id,
           updated_at = now()
     WHERE bot_id = p_bot_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.admin_transfer_bot(p_bot_id UUID, p_new_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT private.admin_transfer_bot(p_bot_id, p_new_owner_user_id, false);
$$;

REVOKE ALL ON FUNCTION private.admin_transfer_bot(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.admin_transfer_bot(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION private.admin_transfer_bot(UUID, UUID, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.admin_transfer_bot(UUID, UUID, BOOLEAN) TO service_role;
