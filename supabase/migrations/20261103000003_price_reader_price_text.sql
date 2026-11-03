-- Add optional presentation controls to 3.2 without rewriting customer values or designs.
INSERT INTO shop.feature_config_definitions (
 feature_version_id,config_key,label,description,value_type,is_required,is_secret,
 default_value,validation_schema,ui_metadata,sort_order
)
SELECT v.id,f.key,f.label,f.description,'TEXT'::shop.feature_config_value_type,true,false,
 '"{{default}}"'::jsonb,'{"minLength":1,"maxLength":1000}'::jsonb,
 jsonb_build_object('control','textarea','variables',f.variables),f.sort_order
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
CROSS JOIN (VALUES
 ('PRICE_READER_BOTH_DISCORD_TEMPLATE','รูปแบบราคา Discord · ทั้งสองแบบ','แก้ป้าย ลำดับ ตัวคั่น อีโมจิและบรรทัดของราคา Discord ในโหมดทั้งสองแบบ',ARRAY['standard_label','nitro_label','standard_price','nitro_price','standard_price_text','nitro_price_text','currency_label'],150),
 ('PRICE_READER_BOTH_SHOP_TEMPLATE','รูปแบบราคารับกด · ทั้งสองแบบ','แก้รูปแบบราคารับกดแยกมี/ไม่มี Nitro โดยไม่เปลี่ยนการจับคู่ราคา',ARRAY['standard_label','nitro_label','standard_shop_price','nitro_shop_price','standard_shop_price_text','nitro_shop_price_text','standard_shop_amount_text','nitro_shop_amount_text','currency_label'],151),
 ('PRICE_READER_MISSING_PRICE_TEXT','ข้อความเมื่อไม่พบราคาในรูป','ใช้เมื่อราคา Nitro หรือราคาปกติไม่ปรากฏในรูป แยกจากกรณีไม่มีคู่ราคาในร้าน',ARRAY[]::text[],152)
) f(key,label,description,variables,sort_order)
WHERE p.code='price-reader' AND v.version='3.2.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

UPDATE shop.feature_presentation_slots s SET available_variables=ARRAY(
 SELECT DISTINCT variable FROM unnest(s.available_variables || ARRAY[
 'standard_label','nitro_label','standard_price_text','nitro_price_text',
 'standard_shop_amount_text','nitro_shop_amount_text']) variable)
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE s.feature_version_id=v.id AND p.code='price-reader' AND v.version='3.2.0';
