-- Compatible opt-in quote controls: preserve existing modes, rules and designs.
INSERT INTO shop.feature_config_definitions(feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
SELECT v.id,'PRICE_READER_OFFER_MODE','ราคาที่ร้านแสดง','เลือกราคารับกด ราคา Gift หรือทั้งสองแบบ โดยใช้ราคาจากรูปและจำนวนชิ้นเดิม','ENUM',true,false,'"SHOP"'::jsonb,
 '{"enum":["SHOP","GIFT","BOTH"]}'::jsonb,'{"control":"select","options":["SHOP","GIFT","BOTH"]}'::jsonb,5
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE p.code='price-reader' AND v.version='3.2.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

INSERT INTO shop.feature_config_definitions(feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
SELECT v.id,f.key,f.label,f.description,'TEXT',true,false,'"{{default}}"'::jsonb,'{"minLength":1,"maxLength":1000}'::jsonb,
 jsonb_build_object('control','textarea','variables',f.variables),f.sort_order
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
CROSS JOIN (VALUES
 ('PRICE_READER_GIFT_UNAVAILABLE_TEXT','ข้อความเมื่อยังไม่ตั้งราคา Gift','ไม่ยืมราคารับกดหรือราคาอีกตารางเมื่อไม่ได้กรอก Gift',ARRAY[]::text[],153),
 ('PRICE_READER_BOTH_GIFT_TEMPLATE','รูปแบบราคา Gift · ทั้งสองฝั่ง','ใช้เมื่อเลือกอ่านราคา Discord ทั้งมีและไม่มี Nitro',ARRAY['standard_label','nitro_label','standard_gift_price','nitro_gift_price','standard_gift_price_text','nitro_gift_price_text','standard_gift_amount_text','nitro_gift_amount_text','currency_label'],154),
 ('PRICE_READER_OFFER_TEMPLATE','รูปแบบรับกดและ Gift','ใช้เมื่อร้านเลือกแสดงทั้งราคารับกดและ Gift',ARRAY['shop_label','gift_label','shop_offer_text','gift_price_text','gift_price','currency_label'],155)
) f(key,label,description,variables,sort_order)
WHERE p.code='price-reader' AND v.version='3.2.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

UPDATE shop.feature_config_definitions d SET
 validation_schema=jsonb_set(d.validation_schema,'{enum}','["STANDARD","NITRO","BOTH","AUTO"]'::jsonb),
 ui_metadata=jsonb_set(d.ui_metadata,'{options}','["STANDARD","NITRO","BOTH","AUTO"]'::jsonb)
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE d.feature_version_id=v.id AND p.code='price-reader' AND v.version='3.2.0' AND d.config_key='PRICE_READER_PRICING_MODE';

UPDATE shop.feature_config_definitions d SET validation_schema=jsonb_set(d.validation_schema,'{items,properties,giftPriceSatang}',
 '{"type":["integer","null"],"minimum":0,"maximum":100000000}'::jsonb)
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE d.feature_version_id=v.id AND p.code='price-reader' AND v.version='3.2.0' AND d.config_key='PRICE_READER_COUNT_PRICE_RULES';

UPDATE shop.feature_presentation_slots s SET available_variables=ARRAY(
 SELECT DISTINCT name FROM unnest(s.available_variables || ARRAY['gift_label','gift_price','gift_price_text','gift_price_found',
 'standard_gift_price','nitro_gift_price','standard_gift_price_text','nitro_gift_price_text','standard_gift_amount_text','nitro_gift_amount_text',
 'shop_label','shop_offer_text','offer_price_text','offer_price_found','offer_mode_key','pricing_selection_key']) name)
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
WHERE s.feature_version_id=v.id AND p.code='price-reader' AND v.version='3.2.0' AND s.slot_key='result';
