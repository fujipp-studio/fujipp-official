INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'f0900000-0000-0000-0000-000000000001',
    'admin-message-tools',
    'Admin Message Tools',
    'Lets Discord administrators send DMs, post messages and files to selected channels, and edit messages sent by their bot.',
    'DISCORD_UTILITY',
    'message-square',
    'DRAFT',
    150
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'f0900000-0000-0000-0000-000000000002',
    'f0900000-0000-0000-0000-000000000001',
    '1.0.0',
    'admin-message-tools',
    'Initial administrator-only DM, channel message, file sending, and bot message editing commands.',
    'DRAFT'
);

INSERT INTO shop.feature_presentation_slots(feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order) VALUES
('f0900000-0000-0000-0000-000000000002','delivery_receipt','ผลการส่งข้อความ','ใบยืนยันหลังแอดมินส่งหรือแก้ไขข้อความสำเร็จ','EMBED',
 ARRAY['action','target','message_url'],
 '{"mode":"EMBED","embeds":[{"color":3066993,"title":"✅ {{action}} สำเร็จ","description":"ปลายทาง: {{target}}\n[เปิดข้อความ]({{message_url}})"}]}'::jsonb,
 '{"type":"object"}',10);
