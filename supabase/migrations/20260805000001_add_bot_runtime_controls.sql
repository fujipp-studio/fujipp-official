CREATE TYPE bots.bot_desired_state AS ENUM ('RUNNING', 'STOPPED');

ALTER TABLE bots.bot_instances
    ADD COLUMN desired_state bots.bot_desired_state NOT NULL DEFAULT 'RUNNING',
    ADD COLUMN restart_revision BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT bot_instances_restart_revision_chk CHECK (restart_revision >= 0);

CREATE INDEX bot_instances_desired_state_idx
    ON bots.bot_instances (desired_state, status)
    WHERE status <> 'DECOMMISSIONED';
