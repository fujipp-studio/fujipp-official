INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'f1000000-0000-0000-0000-000000000001',
    'runtime-expiry-alert',
    'Runtime Expiry Alert',
    'Warns before a bot Runtime expires through a Discord channel, DM, or both, without repeating alerts after restart.',
    'RUNTIME',
    'timer-alert',
    'DRAFT',
    155
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'f1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    '1.0.0',
    'runtime-expiry-alert',
    'Initial milestone alerts at 7 days, 3 days, 1 day, and 1 hour with persistent delivery receipts.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, default_value, validation_schema, ui_metadata, sort_order
) VALUES
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_DELIVERY',
     'ช่องทางแจ้งเตือน', 'เลือกส่งเข้า Channel, DM, ทั้งสองช่องทาง หรือปิดการแจ้งเตือน',
     'ENUM', true, '"CHANNEL"'::jsonb,
     '{"enum":["CHANNEL","DM","BOTH","DISABLED"]}'::jsonb,
     '{"control":"select","options":[{"value":"CHANNEL","label":"Discord Channel"},{"value":"DM","label":"Direct Message"},{"value":"BOTH","label":"Channel และ DM"},{"value":"DISABLED","label":"ปิดการแจ้งเตือน"}]}'::jsonb, 10),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_CHANNEL_ID',
     'Channel แจ้งเตือน', 'ห้อง Discord สำหรับรับการแจ้งเตือน Runtime',
     'CHANNEL_ID', false, NULL, '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"channel-select","channelTypes":["GuildText","GuildAnnouncement"]}'::jsonb, 20),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_DM_USER_ID',
     'ผู้รับ DM', 'Discord User ID ที่จะรับการแจ้งเตือนทางข้อความส่วนตัว',
     'STRING', false, NULL, '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"text","placeholder":"Discord User ID"}'::jsonb, 30),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_7D',
     'แจ้งก่อน 7 วัน', 'ส่งเมื่อ Runtime เหลือไม่เกิน 7 วัน', 'BOOLEAN', true, 'true'::jsonb, '{}'::jsonb, '{"control":"switch"}'::jsonb, 40),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_3D',
     'แจ้งก่อน 3 วัน', 'ส่งเมื่อ Runtime เหลือไม่เกิน 3 วัน', 'BOOLEAN', true, 'true'::jsonb, '{}'::jsonb, '{"control":"switch"}'::jsonb, 50),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_1D',
     'แจ้งก่อน 1 วัน', 'ส่งเมื่อ Runtime เหลือไม่เกิน 1 วัน', 'BOOLEAN', true, 'true'::jsonb, '{}'::jsonb, '{"control":"switch"}'::jsonb, 60),
    ('f1000000-0000-0000-0000-000000000002', 'RUNTIME_ALERT_1H',
     'แจ้งก่อน 1 ชั่วโมง', 'ส่งเมื่อ Runtime เหลือไม่เกิน 1 ชั่วโมง', 'BOOLEAN', true, 'true'::jsonb, '{}'::jsonb, '{"control":"switch"}'::jsonb, 70);

INSERT INTO shop.feature_presentation_slots(feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order) VALUES
('f1000000-0000-0000-0000-000000000002','expiry_alert','แจ้งเตือนใกล้หมดอายุ','ข้อความแจ้งเตือน Runtime รองรับ Embed และ Components V2','EMBED',
 ARRAY['bot_name','remaining','expires_at','auto_renew','renew_url'],
 '{"mode":"EMBED","embeds":[{"color":1118481,"title":"แจ้งเตือน Runtime ใกล้หมดอายุ","description":"Runtime สำหรับ **{{bot_name}}** กำลังจะหมดอายุ กรุณาต่ออายุก่อนถึงกำหนด","fields":[{"name":"เหลือเวลา","value":"{{remaining}}","inline":true},{"name":"หมดอายุ","value":"{{expires_at}}","inline":false},{"name":"ต่ออายุอัตโนมัติ","value":"{{auto_renew}}","inline":true}]}],"links":[{"url":"{{renew_url}}","label":"ตรวจสอบและต่ออายุ","emoji":"⏳"}]}'::jsonb,
 '{"type":"object"}',10);
