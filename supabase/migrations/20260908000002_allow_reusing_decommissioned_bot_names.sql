ALTER TABLE bots.bot_instances
    DROP CONSTRAINT bot_instances_owner_name_key;

CREATE UNIQUE INDEX bot_instances_active_owner_name_key
    ON bots.bot_instances (owner_user_id, name)
    WHERE status <> 'DECOMMISSIONED';

COMMENT ON INDEX bots.bot_instances_active_owner_name_key IS
    'Prevents duplicate active bot names while allowing names from decommissioned bots to be reused.';
