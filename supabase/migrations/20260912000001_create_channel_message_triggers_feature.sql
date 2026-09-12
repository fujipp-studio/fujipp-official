INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'f1300000-0000-0000-0000-000000000001',
    'channel-message-triggers',
    'Channel Message Triggers',
    'Sends a configurable message when a text channel is created in a selected category or when an administrator types an exact trigger.',
    'DISCORD_UTILITY',
    'messages-square',
    'DRAFT',
    155
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'f1300000-0000-0000-0000-000000000002',
    'f1300000-0000-0000-0000-000000000001',
    '1.0.0',
    'channel-message-triggers',
    'Initial category channel-created messages and administrator text triggers with reusable Embed or Components V2 templates.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
(
    'f1300000-0000-0000-0000-000000000002',
    'CHANNEL_CREATE_RULES',
    'ข้อความเมื่อสร้างห้องในหมวดหมู่',
    'เลือก Category และ Template ที่บอทจะส่งทันทีเมื่อมีห้องข้อความใหม่ถูกสร้าง',
    'JSON', true, false, '[]'::jsonb,
    '{"type":"array","maxItems":25,"items":{"type":"object","required":["categoryId","template"],"properties":{"categoryId":{"type":"string","pattern":"^[0-9]{15,30}$"},"template":{"type":"string","pattern":"^template_(?:[1-9]|10)$"}}}}'::jsonb,
    '{"control":"message-trigger-rules","kind":"channel-create"}'::jsonb,
    10
),
(
    'f1300000-0000-0000-0000-000000000002',
    'ADMIN_MESSAGE_TRIGGERS',
    'ข้อความ Trigger สำหรับแอดมิน',
    'กำหนดข้อความแบบตรงตัว เช่น pay เมื่อแอดมินส่ง บอทจะลบข้อความ Trigger แล้วส่ง Template ที่เลือกแทน',
    'JSON', true, false, '[]'::jsonb,
    '{"type":"array","maxItems":25,"items":{"type":"object","required":["trigger","template"],"properties":{"trigger":{"type":"string","minLength":1,"maxLength":100},"template":{"type":"string","pattern":"^template_(?:[1-9]|10)$"}}}}'::jsonb,
    '{"control":"message-trigger-rules","kind":"admin-message"}'::jsonb,
    20
);

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT
    'f1300000-0000-0000-0000-000000000002',
    'template_' || template_number,
    'Message Template ' || template_number,
    'Reusable message for category and administrator triggers.',
    'EMBED',
    ARRAY[
        'channel', 'channel_id', 'channel_name', 'category', 'category_id',
        'category_name', 'guild_name', 'admin', 'admin_id', 'admin_name', 'trigger'
    ],
    jsonb_build_object(
        'mode', 'EMBED',
        'embed', jsonb_build_object(
            'color', 5793266,
            'title', 'ข้อความอัตโนมัติ',
            'description', 'ตั้งค่าข้อความสำหรับ Template ' || template_number
        ),
        'components_v2', jsonb_build_object(
            'components', jsonb_build_array(
                jsonb_build_object(
                    'type', 17,
                    'accent_color', 5793266,
                    'components', jsonb_build_array(
                        jsonb_build_object('type', 10, 'content', '## ข้อความอัตโนมัติ\nตั้งค่าข้อความสำหรับ Template ' || template_number)
                    )
                )
            )
        )
    ),
    '{"type":"object"}'::jsonb,
    template_number * 10
FROM generate_series(1, 10) AS template_number;
