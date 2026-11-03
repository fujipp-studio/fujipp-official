-- Opt-in release. Never change existing licenses, tables, secrets or custom designs.
INSERT INTO shop.feature_versions(id,feature_product_id,version,runtime_key,changelog,status)
SELECT 'f0800000-0000-0000-0000-000000000006',id,'3.2.0','price-reader',
 'Match single items and bundles of 2–5 items with independent Nitro tables, Thai/English responses and sender-confirmed counts.','DRAFT'
FROM shop.feature_products WHERE code='price-reader';

INSERT INTO shop.feature_config_definitions(feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
SELECT target.id,d.config_key,d.label,d.description,d.value_type,d.is_required,d.is_secret,d.default_value,d.validation_schema,d.ui_metadata,d.sort_order
FROM shop.feature_config_definitions d
JOIN shop.feature_versions source ON source.id=d.feature_version_id AND source.version='3.1.0'
JOIN shop.feature_products p ON p.id=source.feature_product_id AND p.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=p.id AND target.version='3.2.0'
WHERE d.config_key<>'PRICE_READER_MATCH_TOLERANCE_SATANG';

INSERT INTO shop.feature_config_definitions(feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order)
VALUES
('f0800000-0000-0000-0000-000000000006','PRICE_READER_LANGUAGE','ภาษาที่บอทตอบ','ภาษาสำหรับข้อความมาตรฐานของบอทและการเลือกจำนวนชิ้น','ENUM',true,false,'"TH"'::jsonb,'{"enum":["TH","EN"]}'::jsonb,'{"control":"select","options":["TH","EN"]}'::jsonb,4),
('f0800000-0000-0000-0000-000000000006','PRICE_READER_COUNT_PRICE_RULES','ตารางราคาแยกจำนวนชิ้น','ชิ้นเดียวและบันเดิล 2–5 ชิ้น แยกมี/ไม่มี Nitro ราคาเป็นจำนวนเต็มสตางค์ ต้องตรงราคาเท่านั้น','JSON',true,false,'[]'::jsonb,
 '{"type":"array","maxItems":400,"items":{"type":"object","required":["itemType","itemCount","pricingMode","discordPriceSatang","shopPriceSatang"],"properties":{"itemType":{"enum":["SINGLE","BUNDLE"]},"itemCount":{"type":"integer","minimum":1,"maximum":5},"pricingMode":{"enum":["STANDARD","NITRO"]},"discordPriceSatang":{"type":"integer","minimum":1,"maximum":100000000},"shopPriceSatang":{"type":"integer","minimum":0,"maximum":100000000}}}}'::jsonb,'{"control":"json-editor"}'::jsonb,32);

UPDATE shop.feature_config_definitions SET default_value='"BOTH"'::jsonb
WHERE feature_version_id='f0800000-0000-0000-0000-000000000006' AND config_key='PRICE_READER_PRICING_MODE';

-- Label variables follow PRICE_READER_LANGUAGE. Custom overrides are never translated automatically.
UPDATE shop.feature_config_definitions SET default_value=to_jsonb('### {{image_label}} {{result_index}} · {{item_type}} · {{pricing_mode}}
💙 **{{discord_price_label}}**
`{{discord_price}} {{currency_label}}`
💗 **{{shop_price_label}}**
`{{shop_price_text}}`'::text)
WHERE feature_version_id='f0800000-0000-0000-0000-000000000006' AND config_key='PRICE_READER_RESULTS_ITEM_TEMPLATE';
UPDATE shop.feature_config_definitions SET default_value=to_jsonb('### {{image_label}} {{result_index}}
❌ {{error_message}}'::text)
WHERE feature_version_id='f0800000-0000-0000-0000-000000000006' AND config_key='PRICE_READER_ERROR_ITEM_TEMPLATE';
UPDATE shop.feature_config_definitions SET default_value='"{{default}}"'::jsonb
WHERE feature_version_id='f0800000-0000-0000-0000-000000000006' AND config_key IN ('PRICE_READER_NOT_FOUND_TEXT','PRICE_READER_OCR_ERROR_TEXT','PRICE_READER_UNMATCHED_PRICE_TEXT');

INSERT INTO shop.feature_presentation_slots(feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order)
SELECT target.id,d.slot_key,d.label,d.description,d.presentation_type,
 ARRAY(SELECT DISTINCT variable FROM unnest(d.available_variables || ARRAY['item_count','image_label','discord_price_label','shop_price_label','currency_label','results_heading','processing_text','images_label','order_label']) variable),
 CASE d.slot_key
 WHEN 'processing' THEN '{"mode":"COMPONENTS_V2","title":"⏳ {{processing_text}}","description":"{{image_count}} {{images_label}}"}'::jsonb
 WHEN 'result' THEN '{"mode":"COMPONENTS_V2","components":[{"type":17,"components":[{"type":10,"content":"💗 **{{results_heading}} ({{image_count}} {{images_label}})**"},{"type":14,"divider":true,"spacing":2},{"type":10,"content":"{{results_text}}"}]}],"links":[{"url":"{{order_url}}","label":"{{order_label}}","emoji":"🍃"}]}'::jsonb
 ELSE d.default_definition END,d.validation_schema,d.sort_order
FROM shop.feature_presentation_slots d
JOIN shop.feature_versions source ON source.id=d.feature_version_id AND source.version='3.1.0'
JOIN shop.feature_products p ON p.id=source.feature_product_id AND p.code='price-reader'
JOIN shop.feature_versions target ON target.feature_product_id=p.id AND target.version='3.2.0';
