INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'f0800000-0000-0000-0000-000000000003',
    'f0800000-0000-0000-0000-000000000001',
    '2.0.0',
    'price-reader',
    'Reads the standard Discord purchase price instead of the Nitro member price and simplifies the result to Discord and shop prices.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, default_value, validation_schema, ui_metadata, sort_order
) VALUES
    ('f0800000-0000-0000-0000-000000000003', 'PRICE_READER_CHANNEL_ID',
     'ช่องอ่านราคา', 'ช่อง Discord ที่ bot จะดักรูป screenshot Discord Shop เพื่ออ่านราคา',
     'CHANNEL_ID', true, NULL,
     '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"channel-select","channelTypes":["GuildText"]}'::jsonb, 10),

    ('f0800000-0000-0000-0000-000000000003', 'PRICE_READER_ORDER_CHANNEL_ID',
     'ช่องสั่งซื้อ', 'ช่อง Discord สำหรับปุ่ม 🍃 สั่งซื้อคลิก (เว้นว่างไว้ถ้าไม่ต้องการ)',
     'CHANNEL_ID', false, NULL,
     '{"pattern":"^[0-9]{15,30}$"}'::jsonb,
     '{"control":"channel-select","channelTypes":["GuildText"]}'::jsonb, 20),

    ('f0800000-0000-0000-0000-000000000003', 'PRICE_READER_PRICE_MAP',
     'ตารางราคา', 'ตารางจับคู่ราคาปกติของ Discord กับราคาร้านขาย (หน่วยบาท)',
     'JSON', true,
     '[
       {"discordPrice":250,"shopPrice":55},
       {"discordPrice":295,"shopPrice":65},
       {"discordPrice":339,"shopPrice":75},
       {"discordPrice":359,"shopPrice":80},
       {"discordPrice":380,"shopPrice":95},
       {"discordPrice":425,"shopPrice":120},
       {"discordPrice":440,"shopPrice":120},
       {"discordPrice":459,"shopPrice":130},
       {"discordPrice":490,"shopPrice":150},
       {"discordPrice":510,"shopPrice":160},
       {"discordPrice":539,"shopPrice":170},
       {"discordPrice":560,"shopPrice":180},
       {"discordPrice":660,"shopPrice":240},
       {"discordPrice":689,"shopPrice":280},
       {"discordPrice":739,"shopPrice":290},
       {"discordPrice":860,"shopPrice":390}
     ]'::jsonb,
     '{"type":"array","items":{"type":"object","required":["discordPrice","shopPrice"],"properties":{"discordPrice":{"type":"number","minimum":1},"shopPrice":{"type":"number","minimum":0}}}}'::jsonb,
     '{"control":"json-editor","description":"discordPrice = ราคาปกติหรือราคาปุ่มซื้อของ Discord (บาท), shopPrice = ราคาร้านขาย (บาท)"}'::jsonb, 30);

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id, slot.key, slot.label, slot.description, 'COMPONENTS_V2',
       slot.variables, slot.definition, '{"type":"object"}'::jsonb, slot.sort_order
  FROM shop.feature_versions AS version
  CROSS JOIN (VALUES
    ('processing',
     'กำลังประมวลผล',
     'ข้อความระหว่างรอ bot อ่านรูป',
     ARRAY['image_count'],
     '{"mode":"COMPONENTS_V2","title":"⏳ กำลังอ่านราคา","description":"กำลังอ่านราคาจากรูป... ({{image_count}} รูป)"}'::jsonb,
     10),

    ('result',
     'ผลการอ่านราคา',
     'ผลลัพธ์ราคาปกติของ Discord และราคาร้านขาย',
     ARRAY['image_count','success_count','error_count','discord_price',
           'shop_price','shop_price_found','item_name','order_url','results_text'],
     '{
       "mode":"COMPONENTS_V2",
       "components":[
         {"type":17,"components":[
           {"type":10,"content":"💗 **ผลการอ่าน ( จำนวน {{image_count}} รูป )**"},
           {"type":14,"divider":true,"spacing":2},
           {"type":10,"content":"{{results_text}}"},
           {"type":14,"divider":true,"spacing":2},
           {"type":10,"content":"🟡🟢🩷🟣🔵🩷🔴🟡🟢🔵🔴🩷🟡🟣🔵🟢🔴🩷🟡🟣"}
         ]}
       ],
       "links":[
         {"url":"{{order_url}}","label":"สั่งซื้อคลิก","emoji":"🍃"}
       ]
     }'::jsonb,
     20)
  ) AS slot(key, label, description, variables, definition, sort_order)
 WHERE version.id = 'f0800000-0000-0000-0000-000000000003'
ON CONFLICT (feature_version_id, slot_key) DO NOTHING;
