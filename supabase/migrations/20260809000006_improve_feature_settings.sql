INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT fv.id, item.key, item.label, item.description,
       item.value_type::shop.feature_config_value_type, true, false,
       item.default_value, '{}'::jsonb, '{"control":"switch"}'::jsonb, item.sort_order
  FROM shop.feature_versions fv
  JOIN shop.feature_products fp ON fp.id = fv.feature_product_id
  CROSS JOIN (VALUES
    ('ADMIN_TOOLS_DM_ENABLED', 'เปิดใช้คำสั่ง DM', 'อนุญาตให้ Administrator ส่งข้อความส่วนตัวผ่านบอท', 'BOOLEAN', 'true'::jsonb, 10),
    ('ADMIN_TOOLS_SEND_ENABLED', 'เปิดใช้การส่งข้อความ', 'อนุญาตให้ผู้มีสิทธิ์ Manage Messages ส่งข้อความผ่านบอท', 'BOOLEAN', 'true'::jsonb, 20),
    ('ADMIN_TOOLS_EDIT_ENABLED', 'เปิดใช้การแก้ไขข้อความ', 'อนุญาตให้แก้ไขข้อความเดิมที่บอทเป็นผู้ส่ง', 'BOOLEAN', 'true'::jsonb, 30),
    ('ADMIN_TOOLS_FILES_ENABLED', 'เปิดใช้การส่งไฟล์', 'อนุญาตให้ส่งไฟล์และไฟล์แนบผ่านคำสั่งของ Feature', 'BOOLEAN', 'true'::jsonb, 40)
  ) item(key, label, description, value_type, default_value, sort_order)
 WHERE fp.code = 'admin-message-tools' AND fv.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO UPDATE
 SET label = EXCLUDED.label, description = EXCLUDED.description,
     ui_metadata = EXCLUDED.ui_metadata, sort_order = EXCLUDED.sort_order;

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT fv.id, 'PRICE_READER_RESULTS_ITEM_TEMPLATE', 'รูปแบบผลลัพธ์ต่อรูป',
       'แต่งข้อความของแต่ละผลลัพธ์ได้ รองรับ {{result_index}}, {{discord_price}}, {{discount_text}}, {{shop_price_text}}, {{no_nitro_markup}}',
       'TEXT', true, false,
       to_jsonb('### รูปที่ {{result_index}}
💙 **ราคาดิสคอร์ด**
`{{discord_price}} บาท`{{discount_text}}
💗 **ราคาร้านขาย**
`{{shop_price_text}}`
💛 **ราคาไม่มีไนโตร บวกชิ้นละ**
`{{no_nitro_markup}} บาท`'::text),
       '{"minLength":1,"maxLength":4000}'::jsonb,
       '{"control":"textarea","rows":10,"variables":["result_index","discord_price","discount_text","shop_price_text","no_nitro_markup"]}'::jsonb,
       95
  FROM shop.feature_versions fv
  JOIN shop.feature_products fp ON fp.id = fv.feature_product_id
 WHERE fp.code = 'price-reader' AND fv.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO UPDATE
 SET label = EXCLUDED.label, description = EXCLUDED.description,
     default_value = EXCLUDED.default_value, validation_schema = EXCLUDED.validation_schema,
     ui_metadata = EXCLUDED.ui_metadata, sort_order = EXCLUDED.sort_order;
