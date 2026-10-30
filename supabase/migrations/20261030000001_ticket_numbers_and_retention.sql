CREATE INDEX ticket_channels_retention_idx ON private.ticket_channels(archived_at)
    WHERE state->>'status'='CLOSED' AND archived_at IS NOT NULL;

CREATE TABLE private.ticket_counters (
    bot_id UUID PRIMARY KEY REFERENCES bots.bot_instances(id) ON DELETE RESTRICT,
    next_value INTEGER NOT NULL DEFAULT 0 CHECK (next_value BETWEEN 0 AND 100000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE private.ticket_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ticket_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.ticket_counters TO service_role;
GRANT DELETE ON private.ticket_channels TO service_role;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='fujipp_backend') THEN
        GRANT SELECT, INSERT, UPDATE ON private.ticket_counters TO fujipp_backend;
        GRANT DELETE ON private.ticket_channels TO fujipp_backend;
    END IF;
END $$;

UPDATE shop.feature_presentation_slots s
SET available_variables=array_append(s.available_variables,'id')
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE s.feature_version_id=v.id AND p.code='ticket' AND s.slot_key='opened'
  AND NOT ('id'=ANY(s.available_variables));
