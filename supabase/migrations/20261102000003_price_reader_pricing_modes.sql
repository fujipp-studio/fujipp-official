-- Opt-in version; older installations and their price tables stay unchanged.
INSERT INTO shop.feature_versions (id,feature_product_id,version,runtime_key,changelog,status)
SELECT 'f0800000-0000-0000-0000-000000000005',id,'3.1.0','price-reader',
 'Choose Nitro or standard pricing and match separate single-item and bundle tables using AI classification.','DRAFT'
FROM shop.feature_products WHERE code='price-reader';

INSERT INTO shop.feature_config_definitions (
 feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
SELECT target.id,source.config_key,source.label,source.description,source.value_type,source.is_required,source.is_secret,
 source.default_value,source.validation_schema,source.ui_metadata,source.sort_order
FROM shop.feature_config_definitions source
JOIN shop.feature_versions previous ON previous.id=source.feature_version_id AND previous.version='3.0.0'
JOIN shop.feature_products product ON product.id=previous.feature_product_id AND product.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=product.id AND target.version='3.1.0';

INSERT INTO shop.feature_config_definitions (
 feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
VALUES
('f0800000-0000-0000-0000-000000000005','PRICE_READER_PRICING_MODE','โหมดราคา',
 'เลือกราคา Discord แบบมี Nitro หรือไม่มี Nitro เพื่อจับคู่ราคารับกด','ENUM',true,false,'"STANDARD"'::jsonb,
 '{"enum":["STANDARD","NITRO"]}'::jsonb,'{"control":"select","options":["STANDARD","NITRO"]}'::jsonb,3),
('f0800000-0000-0000-0000-000000000005','PRICE_READER_PRICE_RULES','ตารางราคารับกดแยกประเภท',
 'แยกตามโหมด Nitro และประเภทบันเดิลหรือชิ้นเดียว ราคาเก็บเป็นจำนวนเต็มสตางค์','JSON',true,false,'[]'::jsonb,
 '{"type":"array","maxItems":400,"items":{"type":"object","required":["itemType","pricingMode","discordPriceSatang","shopPriceSatang"],"properties":{"itemType":{"enum":["SINGLE","BUNDLE"]},"pricingMode":{"enum":["STANDARD","NITRO"]},"discordPriceSatang":{"type":"integer","minimum":1,"maximum":100000000},"shopPriceSatang":{"type":"integer","minimum":0,"maximum":100000000}}}}'::jsonb,
 '{"control":"json-editor"}'::jsonb,31);

INSERT INTO shop.feature_presentation_slots (
 feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order)
SELECT target.id,source.slot_key,source.label,source.description,source.presentation_type,
 ARRAY(SELECT DISTINCT v FROM unnest(source.available_variables || ARRAY['item_type','item_type_key','pricing_mode','pricing_mode_key','standard_price','nitro_price']) v),
 source.default_definition,source.validation_schema,source.sort_order
FROM shop.feature_presentation_slots source
JOIN shop.feature_versions previous ON previous.id=source.feature_version_id AND previous.version='3.0.0'
JOIN shop.feature_products product ON product.id=previous.feature_product_id AND product.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=product.id AND target.version='3.1.0';

-- New installations display the selected mode and detected type; upgrades retain custom templates.
UPDATE shop.feature_config_definitions
SET default_value=to_jsonb('### รูปที่ {{result_index}} · {{item_type}} · {{pricing_mode}}
💙 **ราคา Discord**
`{{discord_price}} บาท`
💗 **ราคารับกด**
`{{shop_price_text}}`'::text)
WHERE feature_version_id='f0800000-0000-0000-0000-000000000005'
  AND config_key='PRICE_READER_RESULTS_ITEM_TEMPLATE';

UPDATE shop.feature_presentation_slots SET description='ผลการอ่านราคา Discord ตามโหมดร้านและราคารับกดแยกประเภทสินค้า'
WHERE feature_version_id='f0800000-0000-0000-0000-000000000005' AND slot_key='result';
