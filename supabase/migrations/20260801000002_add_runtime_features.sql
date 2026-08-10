CREATE TABLE private.feature_runtime_states (
    installation_id UUID PRIMARY KEY
        REFERENCES private.bot_feature_installations (id) ON DELETE CASCADE,
    bot_id UUID NOT NULL
        REFERENCES bots.bot_instances (id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_runtime_states_object_chk CHECK (jsonb_typeof(state) = 'object'),
    CONSTRAINT feature_runtime_states_size_chk CHECK (octet_length(state::text) <= 16384)
);

CREATE INDEX feature_runtime_states_bot_idx
    ON private.feature_runtime_states (bot_id);

REVOKE ALL ON TABLE private.feature_runtime_states FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.feature_runtime_states IS
    'Small non-secret state persisted by authenticated runners for active feature installations.';

INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'd0100000-0000-0000-0000-000000000001',
    'voice-keeper',
    'Voice Keeper',
    'Keeps a Discord bot connected to a selected voice or stage channel and restores the connection after restart.',
    'DISCORD_UTILITY',
    'headphones',
    'DRAFT',
    100
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'd0100000-0000-0000-0000-000000000002',
    'd0100000-0000-0000-0000-000000000001',
    '1.0.0',
    'voice-keeper',
    'Initial 24/7 voice connection with configurable command and restart recovery.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, default_value, validation_schema, ui_metadata, sort_order
) VALUES
    (
        'd0100000-0000-0000-0000-000000000002',
        'COMMAND_NAME',
        'Command name',
        'Slash command name without the leading slash.',
        'STRING',
        true,
        '"voice"'::jsonb,
        '{"pattern":"^[a-z0-9_-]{1,32}$","minLength":1,"maxLength":32}'::jsonb,
        '{"control":"text","prefix":"/"}'::jsonb,
        10
    ),
    (
        'd0100000-0000-0000-0000-000000000002',
        'SELF_MUTE',
        'Mute microphone',
        'Join the voice channel with the bot microphone muted.',
        'BOOLEAN',
        true,
        'true'::jsonb,
        '{}'::jsonb,
        '{"control":"switch"}'::jsonb,
        20
    ),
    (
        'd0100000-0000-0000-0000-000000000002',
        'SELF_DEAF',
        'Deafen headphones',
        'Join the voice channel with incoming audio disabled to reduce processing.',
        'BOOLEAN',
        true,
        'true'::jsonb,
        '{}'::jsonb,
        '{"control":"switch"}'::jsonb,
        30
    );

INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'd0200000-0000-0000-0000-000000000001',
    'bot-presence',
    'Bot Presence',
    'Configures the bot status and rotates activity text without requiring privileged presence intents.',
    'DISCORD_UTILITY',
    'activity',
    'DRAFT',
    110
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'd0200000-0000-0000-0000-000000000002',
    'd0200000-0000-0000-0000-000000000001',
    '1.0.0',
    'bot-presence',
    'Initial configurable status and rate-limit-safe activity rotation.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, default_value, validation_schema, ui_metadata, sort_order
) VALUES
    (
        'd0200000-0000-0000-0000-000000000002',
        'PRESENCE_STATUS',
        'Online status',
        'Status indicator displayed for the bot.',
        'ENUM',
        true,
        '"online"'::jsonb,
        '{"enum":["online","idle","dnd","invisible"]}'::jsonb,
        '{"control":"select","options":[{"value":"online","label":"Online"},{"value":"idle","label":"Idle"},{"value":"dnd","label":"Do not disturb"},{"value":"invisible","label":"Invisible"}]}'::jsonb,
        10
    ),
    (
        'd0200000-0000-0000-0000-000000000002',
        'PRESENCE_ACTIVITY_TYPE',
        'Activity type',
        'Prefix Discord displays before the activity text.',
        'ENUM',
        true,
        '"WATCHING"'::jsonb,
        '{"enum":["WATCHING","PLAYING","LISTENING","COMPETING"]}'::jsonb,
        '{"control":"select","options":[{"value":"WATCHING","label":"Watching"},{"value":"PLAYING","label":"Playing"},{"value":"LISTENING","label":"Listening"},{"value":"COMPETING","label":"Competing"}]}'::jsonb,
        20
    ),
    (
        'd0200000-0000-0000-0000-000000000002',
        'PRESENCE_TEXTS',
        'Activity texts',
        'One text remains static; multiple texts rotate in order.',
        'STRING_LIST',
        false,
        '[]'::jsonb,
        '{"maxItems":20,"items":{"type":"string","minLength":1,"maxLength":128}}'::jsonb,
        '{"control":"string-list","placeholder":"ข้อความสถานะ"}'::jsonb,
        30
    ),
    (
        'd0200000-0000-0000-0000-000000000002',
        'PRESENCE_ROTATE_SECONDS',
        'Rotation interval',
        'Seconds before displaying the next activity text.',
        'INTEGER',
        true,
        '30'::jsonb,
        '{"minimum":20,"maximum":86400}'::jsonb,
        '{"control":"number","suffix":"seconds"}'::jsonb,
        40
    );

INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'd0300000-0000-0000-0000-000000000001',
    'review-credit',
    'Review Credit',
    'Counts member reviews, manages reactions and replies, grants a reviewer role, and keeps the review channel name synchronized.',
    'COMMUNITY',
    'message-circle-heart',
    'DRAFT',
    120
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'd0300000-0000-0000-0000-000000000002',
    'd0300000-0000-0000-0000-000000000001',
    '1.0.0',
    'review-credit',
    'Initial persistent review counter with batched channel renames and administrator tools.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, default_value, validation_schema, ui_metadata, sort_order
) VALUES
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_CHANNEL_ID',
     'Review channel', 'Text channel where member messages count as reviews.', 'CHANNEL_ID',
     true, NULL, '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"channel-select","channelTypes":["GuildText","GuildAnnouncement"]}'::jsonb, 10),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_COMMAND_NAME',
     'Command name', 'Global slash command name without the leading slash.', 'STRING',
     true, '"review"'::jsonb, '{"pattern":"^[a-z0-9_-]{1,32}$"}'::jsonb,
     '{"control":"text","prefix":"/"}'::jsonb, 20),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_CHANNEL_NAME_TEMPLATE',
     'Channel name template', 'Channel name containing the {count} variable.', 'STRING',
     true, '"꒰💯꒱┆review 〻{count}"'::jsonb,
     '{"minLength":7,"maxLength":90,"pattern":"\\{count\\}"}'::jsonb,
     '{"control":"text","variables":["count"]}'::jsonb, 30),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_REACTIONS',
     'Review reactions', 'Unicode or custom emoji reactions added to each review.', 'STRING_LIST',
     false, '[]'::jsonb,
     '{"maxItems":10,"items":{"type":"string","minLength":1,"maxLength":100}}'::jsonb,
     '{"control":"string-list","placeholder":"💖"}'::jsonb, 40),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_REPLY_MESSAGES',
     'Reply messages', 'One configured response is selected randomly for each review.', 'STRING_LIST',
     false, '[]'::jsonb,
     '{"maxItems":20,"items":{"type":"string","minLength":1,"maxLength":2000}}'::jsonb,
     '{"control":"string-list","multiline":true}'::jsonb, 50),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_DELETE_OLD_REPLY',
     'Delete previous reply', 'Keep only the latest automated review response.', 'BOOLEAN',
     true, 'true'::jsonb, '{}'::jsonb, '{"control":"switch"}'::jsonb, 60),
    ('d0300000-0000-0000-0000-000000000002', 'REVIEW_ROLE_ID',
     'Reviewer role', 'Optional role granted to members after posting a review.', 'ROLE_ID',
     false, NULL, '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"role-select"}'::jsonb, 70);
