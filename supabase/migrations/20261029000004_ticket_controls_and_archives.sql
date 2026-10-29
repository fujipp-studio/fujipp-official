-- Durable ticket identity and archives; Discord channel topics remain empty.
CREATE TABLE private.ticket_channels (
    bot_id UUID NOT NULL REFERENCES bots.bot_instances(id) ON DELETE RESTRICT,
    installation_id UUID NOT NULL REFERENCES private.bot_feature_installations(id) ON DELETE RESTRICT,
    channel_id TEXT NOT NULL CHECK (channel_id ~ '^[0-9]{15,30}$'),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    messages JSONB CHECK (messages IS NULL OR jsonb_typeof(messages) = 'array'),
    archived_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bot_id, channel_id),
    CHECK ((messages IS NULL) = (archived_at IS NULL))
);
CREATE INDEX ticket_channels_installation_idx ON private.ticket_channels(installation_id);
ALTER TABLE private.ticket_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ticket_channels FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.ticket_channels TO service_role;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='fujipp_backend') THEN
        GRANT SELECT, INSERT, UPDATE ON private.ticket_channels TO fujipp_backend;
    END IF;
END $$;

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT v.id, 'TICKET_BEHAVIOR', 'พฤติกรรม Ticket',
       'จำนวนตั๋วต่อคน การยืนยันปิด และ Role/User ที่ปิดตั๋วได้ เพิ่มเติมจาก Administrator',
       'JSON', true, false,
       '{"maxOpenPerUser":1,"confirmClose":true,"closeRoleIds":[],"closeUserIds":[]}'::jsonb,
       '{"type":"object","required":["maxOpenPerUser","confirmClose","closeRoleIds","closeUserIds"],"properties":{"maxOpenPerUser":{"type":"integer","minimum":1,"maximum":25},"confirmClose":{"type":"boolean"},"closeRoleIds":{"type":"array","maxItems":10,"uniqueItems":true,"items":{"type":"string","pattern":"^[0-9]{15,30}$"}},"closeUserIds":{"type":"array","maxItems":25,"uniqueItems":true,"items":{"type":"string","pattern":"^[0-9]{15,30}$"}}}}'::jsonb,
       '{}'::jsonb, 40
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE p.code='ticket' AND v.version='1.0.0';

UPDATE shop.feature_config_definitions d
SET validation_schema = jsonb_set(jsonb_set(d.validation_schema,
        '{items,properties,emoji}', '{"type":"string","maxLength":100}'::jsonb),
        '{items,properties,channelNameTemplate}', '{"type":"string","minLength":1,"maxLength":100}'::jsonb)
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE d.feature_version_id=v.id AND p.code='ticket' AND d.config_key='TICKET_CATEGORIES';
