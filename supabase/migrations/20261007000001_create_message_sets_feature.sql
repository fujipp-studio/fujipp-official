INSERT INTO shop.feature_products (id, code, name, description, category, icon_key, status, sort_order)
VALUES ('f1600000-0000-0000-0000-000000000001', 'message-sets', 'Message Sets',
    'Design up to 20 named Embed or Components V2 messages and send them with a configurable slash command. SET changes load without restarting the bot.',
    'DISCORD_UTILITY', 'messages-square', 'DRAFT', 165);

INSERT INTO shop.feature_versions (id, feature_product_id, version, runtime_key, changelog, status)
VALUES ('f1600000-0000-0000-0000-000000000002', 'f1600000-0000-0000-0000-000000000001',
    '1.0.0', 'message-sets', 'Named messages with live SET updates and autocomplete.', 'DRAFT');

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
('f1600000-0000-0000-0000-000000000002', 'MESSAGE_SETS_COMMAND_NAME', 'ชื่อคำสั่ง',
 'ชื่อ Slash command สำหรับส่ง SET ไม่ต้องใส่ /', 'STRING', true, false, '"ec"'::jsonb,
 '{"type":"string","pattern":"^[a-z0-9_-]{1,32}$"}'::jsonb, '{}'::jsonb, 10),
('f1600000-0000-0000-0000-000000000002', 'MESSAGE_SETS', 'รายการ SET',
 'ตั้งชื่อ SET ได้สูงสุด 20 รายการต่อบอท แต่ละ SET ใช้ดีไซน์ของตัวเอง', 'JSON', true, false, '[]'::jsonb,
 '{"type":"array","maxItems":20,"items":{"type":"object","required":["name","presentationSlot"],"properties":{"name":{"type":"string","minLength":1,"maxLength":100},"presentationSlot":{"type":"string","pattern":"^set_(?:[1-9]|1[0-9]|20)$"}}}}'::jsonb,
 '{"control":"message-sets"}'::jsonb, 20);

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT
    'f1600000-0000-0000-0000-000000000002',
    'set_' || template_number,
    'SET ' || template_number,
    'Named message sent using the configured command.',
    'EMBED',
    ARRAY[
        'set_name', 'user', 'user_name', 'channel', 'guild_name'
    ],
    jsonb_build_object(
        'mode', 'EMBED',
        'embed', jsonb_build_object(
            'color', 5793266,
            'title', 'ข้อความอัตโนมัติ',
            'description', 'ตั้งค่าข้อความสำหรับ SET ' || template_number
        ),
        'components_v2', jsonb_build_object(
            'components', jsonb_build_array(
                jsonb_build_object(
                    'type', 17,
                    'accent_color', 5793266,
                    'components', jsonb_build_array(
                        jsonb_build_object('type', 10, 'content', E'## ข้อความอัตโนมัติ\nตั้งค่าข้อความสำหรับ SET ' || template_number)
                    )
                )
            )
        )
    ),
    '{"type":"object"}'::jsonb,
    template_number * 10
FROM generate_series(1, 20) AS template_number;
