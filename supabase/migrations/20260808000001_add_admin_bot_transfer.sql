
ALTER TABLE private.bot_feature_installations
    DROP CONSTRAINT bot_feature_installations_bot_owner_fkey;
ALTER TABLE private.bot_feature_installations
    ADD CONSTRAINT bot_feature_installations_bot_fkey
    FOREIGN KEY (bot_id) REFERENCES bots.bot_instances(id) ON DELETE RESTRICT;

CREATE FUNCTION private.validate_feature_installation_bot_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE bot_owner UUID;
BEGIN
    IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;
    SELECT owner_user_id INTO bot_owner FROM bots.bot_instances WHERE id=NEW.bot_id;
    IF bot_owner IS NULL OR bot_owner <> NEW.owner_user_id THEN
        RAISE EXCEPTION 'feature installation bot must belong to its owner';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER bot_feature_installations_validate_bot_owner
    BEFORE INSERT OR UPDATE OF bot_id, owner_user_id, removed_at
    ON private.bot_feature_installations
    FOR EACH ROW EXECUTE FUNCTION private.validate_feature_installation_bot_owner();

ALTER TABLE private.bot_credentials
    DROP CONSTRAINT bot_credentials_bot_owner_fkey;
ALTER TABLE private.bot_credentials
    ADD CONSTRAINT bot_credentials_bot_owner_fkey
    FOREIGN KEY (bot_id, owner_user_id)
    REFERENCES bots.bot_instances(id, owner_user_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

CREATE FUNCTION private.admin_transfer_bot(p_bot_id UUID, p_new_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE current_owner UUID;
BEGIN
    SELECT owner_user_id INTO current_owner
      FROM bots.bot_instances WHERE id=p_bot_id AND status <> 'DECOMMISSIONED' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF current_owner=p_new_owner_user_id THEN RETURN true; END IF;
    IF NOT EXISTS (SELECT 1 FROM private.user_accounts WHERE user_id=p_new_owner_user_id) THEN
        RAISE EXCEPTION 'new bot owner was not found';
    END IF;

    UPDATE private.feature_config_sets SET validated_for_bot_id=NULL,validated_at=NULL
     WHERE validated_for_bot_id=p_bot_id;
    UPDATE private.bot_feature_installations
       SET status='REMOVED',removed_at=now(),updated_at=now()
     WHERE bot_id=p_bot_id AND removed_at IS NULL;
    UPDATE private.runtime_subscriptions SET bot_id=NULL,updated_at=now() WHERE bot_id=p_bot_id;

    SET CONSTRAINTS bot_credentials_bot_owner_fkey DEFERRED;
    UPDATE private.bot_credentials SET owner_user_id=p_new_owner_user_id,updated_at=now()
     WHERE bot_id=p_bot_id;
    UPDATE bots.bot_instances
       SET owner_user_id=p_new_owner_user_id,desired_state='STOPPED'
     WHERE id=p_bot_id;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_transfer_bot(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_transfer_bot(UUID,UUID) TO service_role;
