-- Daily export quota persists across restarts; only trusted Backend operations may access it.
CREATE TABLE private.member_spending_backup_quotas (
    installation_id UUID NOT NULL REFERENCES private.bot_feature_installations(id) ON DELETE CASCADE,
    download_day DATE NOT NULL,
    download_count INTEGER NOT NULL CHECK (download_count BETWEEN 1 AND 5),
    PRIMARY KEY (installation_id, download_day)
);
ALTER TABLE private.member_spending_backup_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.member_spending_backup_quotas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.member_spending_backup_quotas TO service_role;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='fujipp_backend') THEN
        GRANT SELECT, INSERT, UPDATE ON private.member_spending_backup_quotas TO fujipp_backend;
    END IF;
END $$;
