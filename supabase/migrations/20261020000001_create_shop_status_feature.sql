-- Draft catalog entry: publish through the existing admin workflow after deployment.
INSERT INTO shop.feature_products (id, code, name, description, category, icon_key, status, sort_order)
VALUES ('f1700000-0000-0000-0000-000000000001', 'shop-status', 'Shop Status',
 'เปิด–ปิดร้านด้วยคำสั่งที่ตั้งชื่อเอง ส่งข้อความธรรมดา Embed หรือ Components V2 และปรับสิทธิ์ห้องตาม Role ได้',
 'DISCORD_UTILITY', 'store', 'DRAFT', 170);

INSERT INTO shop.feature_versions (id, feature_product_id, version, runtime_key, changelog, status)
VALUES ('f1700000-0000-0000-0000-000000000002', 'f1700000-0000-0000-0000-000000000001',
 '1.0.0', 'shop-status', 'Custom open/close commands, announcements and optional role permission rules.', 'DRAFT');

INSERT INTO shop.feature_config_definitions (
 feature_version_id, config_key, label, description, value_type,
 is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
('f1700000-0000-0000-0000-000000000002', 'SHOP_COMMAND_NAME', 'ชื่อคำสั่งหลัก', 'ไม่ต้องใส่ / เช่น shop หรือ store', 'STRING', true, false, '"shop"'::jsonb, '{"type": "string", "pattern": "^[a-z0-9_-]{1,32}$"}'::jsonb, '{}'::jsonb, 10),
('f1700000-0000-0000-0000-000000000002', 'SHOP_OPEN_COMMAND', 'คำสั่งเปิดร้าน', 'ชื่อคำสั่งย่อยเปิดร้าน', 'STRING', true, false, '"open"'::jsonb, '{"type": "string", "pattern": "^[a-z0-9_-]{1,32}$"}'::jsonb, '{}'::jsonb, 20),
('f1700000-0000-0000-0000-000000000002', 'SHOP_CLOSE_COMMAND', 'คำสั่งปิดร้าน', 'ชื่อคำสั่งย่อยปิดร้าน ต้องต่างจากคำสั่งเปิดร้าน', 'STRING', true, false, '"close"'::jsonb, '{"type": "string", "pattern": "^[a-z0-9_-]{1,32}$"}'::jsonb, '{}'::jsonb, 30),
('f1700000-0000-0000-0000-000000000002', 'SHOP_ANNOUNCEMENT_CHANNEL_ID', 'ห้องประกาศ', 'เว้นว่างเพื่อประกาศในห้องที่ใช้คำสั่ง', 'STRING', false, false, '""'::jsonb, '{"type": "string", "pattern": "^$|^[0-9]{15,30}$"}'::jsonb, '{}'::jsonb, 40),
('f1700000-0000-0000-0000-000000000002', 'SHOP_OPEN_MESSAGE_TYPE', 'รูปแบบข้อความเปิดร้าน', 'เลือกข้อความธรรมดาหรือออกแบบ Embed / Components V2', 'ENUM', true, false, '"DESIGNED"'::jsonb, '{"type": "string", "enum": ["TEXT", "DESIGNED"]}'::jsonb, '{"control": "select", "options": [{"value": "TEXT", "label": "\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e18\u0e23\u0e23\u0e21\u0e14\u0e32"}, {"value": "DESIGNED", "label": "Embed / Components V2"}]}'::jsonb, 50),
('f1700000-0000-0000-0000-000000000002', 'SHOP_OPEN_TEXT', 'ข้อความเปิดร้าน', 'ใช้เมื่อเลือกรูปแบบข้อความธรรมดา รองรับตัวแปร {{status}}, {{user_name}}, {{guild_name}}', 'TEXT', false, false, '"เปิดร้านแล้ว"'::jsonb, '{"type": "string", "maxLength": 2000}'::jsonb, '{}'::jsonb, 60),
('f1700000-0000-0000-0000-000000000002', 'SHOP_CLOSE_MESSAGE_TYPE', 'รูปแบบข้อความปิดร้าน', 'เลือกข้อความธรรมดาหรือออกแบบ Embed / Components V2', 'ENUM', true, false, '"DESIGNED"'::jsonb, '{"type": "string", "enum": ["TEXT", "DESIGNED"]}'::jsonb, '{"control": "select", "options": [{"value": "TEXT", "label": "\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e18\u0e23\u0e23\u0e21\u0e14\u0e32"}, {"value": "DESIGNED", "label": "Embed / Components V2"}]}'::jsonb, 70),
('f1700000-0000-0000-0000-000000000002', 'SHOP_CLOSE_TEXT', 'ข้อความปิดร้าน', 'ใช้เมื่อเลือกรูปแบบข้อความธรรมดา รองรับตัวแปร {{status}}, {{user_name}}, {{guild_name}}', 'TEXT', false, false, '"ปิดร้านแล้ว"'::jsonb, '{"type": "string", "maxLength": 2000}'::jsonb, '{}'::jsonb, 80),
('f1700000-0000-0000-0000-000000000002', 'SHOP_PERMISSION_RULES', 'กฎสิทธิ์ห้อง', 'ปรับสิทธิ์รายห้องและ Role แยกสถานะเปิด/ปิดร้าน เว้นว่างเพื่อส่งประกาศอย่างเดียว', 'JSON', true, false, '[]'::jsonb, '{"type": "array", "maxItems": 25, "items": {"type": "object", "required": ["channelId", "roleId", "open", "close"], "properties": {"channelId": {"type": "string", "pattern": "^[0-9]{15,30}$"}, "roleId": {"type": "string", "pattern": "^[0-9]{15,30}$"}, "open": {"type": "object", "additionalProperties": false, "properties": {"ViewChannel": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}, "SendMessages": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}, "Connect": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}}}, "close": {"type": "object", "additionalProperties": false, "properties": {"ViewChannel": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}, "SendMessages": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}, "Connect": {"type": "string", "enum": ["ALLOW", "DENY", "INHERIT", "KEEP"]}}}}}}'::jsonb, '{"control": "shop-permissions"}'::jsonb, 90);

INSERT INTO shop.feature_presentation_slots (
 feature_version_id, slot_key, label, description, presentation_type,
 available_variables, default_definition, validation_schema, sort_order
)
SELECT 'f1700000-0000-0000-0000-000000000002', slot_key, label,
 'ประกาศเมื่อเปลี่ยนสถานะร้าน', 'EMBED',
 ARRAY['status', 'user', 'user_name', 'channel', 'guild_name'],
 jsonb_build_object(
  'mode', 'EMBED',
  'embed', jsonb_build_object('color', color, 'title', label, 'description', '{{guild_name}} · {{status}}'),
  'components_v2', jsonb_build_object('components', jsonb_build_array(
   jsonb_build_object('type', 17, 'accent_color', color, 'components', jsonb_build_array(
    jsonb_build_object('type', 10, 'content', '## ' || label || E'\n{{guild_name}} · {{status}}')
   ))
  ))
 ), '{"type":"object"}'::jsonb, sort_order
FROM (VALUES
 ('shop_open', 'เปิดร้านแล้ว', 5763719, 10),
 ('shop_close', 'ปิดร้านแล้ว', 15548997, 20)
) AS slots(slot_key, label, color, sort_order);
