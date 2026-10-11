-- Extend both installed Price Reader versions without replacing saved values or designs.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, field.key, field.label, field.description,
       field.value_type::shop.feature_config_value_type, field.required, false,
       field.default_value, field.validation, field.ui, field.sort_order
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id = version.feature_product_id
  CROSS JOIN (VALUES
    ('PRICE_READER_MATCH_TOLERANCE_SATANG', 'ความคลาดเคลื่อนในการจับคู่ราคา', '0 = ต้องตรงราคาเท่านั้น ค่าเริ่มต้น 500 สตางค์ = ±5 บาท', 'INTEGER', true, '500'::jsonb, '{"minimum": 0, "maximum": 5000}'::jsonb, '{"control": "number"}'::jsonb, 40),
    ('PRICE_READER_RESULT_BLOCKS', 'บล็อกผลลัพธ์ต่อรูป', 'เปิดปิดและเรียงบล็อกข้อความต่อรูป รายการว่างใช้ Template เดิม', 'JSON', true, '[]'::jsonb, '{"type": "array", "maxItems": 12, "items": {"type": "object", "required": ["id", "enabled", "text"], "properties": {"id": {"type": "string", "minLength": 1, "maxLength": 64}, "enabled": {"type": "boolean"}, "text": {"type": "string", "maxLength": 1000}}}}'::jsonb, '{"control": "json-editor"}'::jsonb, 90),
    ('PRICE_READER_NOT_FOUND_TEXT', 'ข้อความเมื่ออ่านไม่พบราคา', 'แสดงเมื่อรูปไม่มีราคาเงินบาทที่รองรับ', 'TEXT', true, '"ไม่พบราคาที่รองรับในรูปนี้ กรุณาตรวจสอบว่ารูปมีราคาเป็นเงินบาทและลองส่งอีกครั้ง"'::jsonb, '{"minLength": 1, "maxLength": 1000}'::jsonb, '{"control": "textarea"}'::jsonb, 100),
    ('PRICE_READER_OCR_ERROR_TEXT', 'ข้อความเมื่ออ่านรูปผิดพลาด', 'แสดงเมื่อดาวน์โหลดหรือประมวลผลรูปไม่สำเร็จ', 'TEXT', true, '"เกิดข้อผิดพลาดขณะอ่านรูป กรุณาลองส่งรูปอีกครั้ง"'::jsonb, '{"minLength": 1, "maxLength": 1000}'::jsonb, '{"control": "textarea"}'::jsonb, 110),
    ('PRICE_READER_UNMATCHED_PRICE_TEXT', 'ข้อความเมื่อไม่มีคู่ราคา', 'ใช้แทนราคาร้านเมื่ออ่านราคาได้ แต่ไม่มีคู่ราคาในช่วงที่กำหนด รองรับ {{discord_price}}', 'TEXT', true, '"ไม่พบราคาที่ตรงกัน"'::jsonb, '{"minLength": 1, "maxLength": 1000}'::jsonb, '{"control": "textarea", "variables": ["discord_price", "item_name"]}'::jsonb, 120),
    ('PRICE_READER_ERROR_ITEM_TEMPLATE', 'รูปแบบผลลัพธ์ต่อรูปที่ผิดพลาด', 'ใช้ได้ทั้งกรณีผิดพลาดทุกรูป และบางรูปผิดพลาด', 'TEXT', true, '"### รูปที่ {{result_index}}\n❌ {{error_message}}"'::jsonb, '{"minLength": 1, "maxLength": 4000}'::jsonb, '{"control": "textarea", "variables": ["result_index", "error_message"]}'::jsonb, 130),
    ('PRICE_READER_RESULTS_SEPARATOR', 'ตัวคั่นระหว่างรูป', 'เว้นว่างเพื่อไม่แสดงตัวคั่น', 'TEXT', false, '"\n\n---\n\n"'::jsonb, '{"maxLength": 100}'::jsonb, '{"control": "textarea"}'::jsonb, 140)
  ) AS field(key, label, description, value_type, required, default_value, validation, ui, sort_order)
 WHERE product.code = 'price-reader' AND version.version IN ('1.0.0', '2.0.0')
ON CONFLICT (feature_version_id, config_key) DO NOTHING;

-- V1 already has a per-image template; add the same capability to V2.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, 'PRICE_READER_RESULTS_ITEM_TEMPLATE', 'รูปแบบผลลัพธ์ต่อรูป',
       'ข้อความสำหรับแต่ละรูปที่อ่านราคาสำเร็จ', 'TEXT', true, false,
       to_jsonb('### รูปที่ {{result_index}}
💙 **ราคาดิสคอร์ด**
`{{discord_price}} บาท`
💗 **ราคาร้านขาย**
`{{shop_price_text}}`'::text),
       '{"minLength":1,"maxLength":4000}'::jsonb,
       '{"control":"textarea","variables":["result_index","item_name","discord_price","shop_price","shop_price_text","discount_text","matched_discord_price","match_distance"]}'::jsonb, 95
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id = version.feature_product_id
 WHERE product.code = 'price-reader' AND version.version = '2.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id, 'error', 'อ่านราคาไม่สำเร็จ', 'ข้อความเมื่ออ่านราคาไม่สำเร็จทุกรูป',
       'COMPONENTS_V2', ARRAY['image_count','success_count','error_count','error_message','results_text'],
       '{"mode":"COMPONENTS_V2","components":[{"type":17,"components":[{"type":10,"content":"{{results_text}}"}]}]}'::jsonb,
       '{"type":"object"}'::jsonb, 30
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id = version.feature_product_id
 WHERE product.code = 'price-reader' AND version.version IN ('1.0.0', '2.0.0')
ON CONFLICT (feature_version_id, slot_key) DO NOTHING;

-- Keep both the visual design and template when switching between modes.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, 'PRICE_READER_RESULT_MODE', 'โหมดผลลัพธ์ต่อรูป',
       'เลือกใช้ Template หรือบล็อก โดยเก็บรูปแบบทั้งสองไว้', 'ENUM', true, false,
       '"TEMPLATE"'::jsonb, '{"enum":["TEMPLATE","BLOCKS"]}'::jsonb,
       '{"control":"select","options":["TEMPLATE","BLOCKS"]}'::jsonb, 91
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id = version.feature_product_id
 WHERE product.code = 'price-reader' AND version.version IN ('1.0.0', '2.0.0')
ON CONFLICT (feature_version_id, config_key) DO NOTHING;

UPDATE shop.feature_presentation_slots slot
   SET available_variables = ARRAY(
       SELECT DISTINCT variable
         FROM unnest(slot.available_variables || ARRAY['matched_discord_price','match_distance','error_message']) AS variable
   )
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id = version.feature_product_id
 WHERE slot.feature_version_id = version.id AND slot.slot_key = 'result'
   AND product.code = 'price-reader' AND version.version IN ('1.0.0', '2.0.0');
