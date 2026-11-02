-- Add dual quotes to the existing opt-in 3.1 version without changing saved modes or price rules.
UPDATE shop.feature_config_definitions definition
SET validation_schema = '{"enum":["STANDARD","NITRO","BOTH"]}'::jsonb,
    ui_metadata = jsonb_set(COALESCE(definition.ui_metadata, '{}'::jsonb), '{options}', '["STANDARD","NITRO","BOTH"]'::jsonb),
    description = 'เลือกราคา Discord แบบมี Nitro ไม่มี Nitro หรือแสดงราคารับกดทั้งสองแบบแยกกัน'
FROM shop.feature_versions version JOIN shop.feature_products product ON product.id = version.feature_product_id
WHERE definition.feature_version_id = version.id AND product.code = 'price-reader'
  AND version.version = '3.1.0' AND definition.config_key = 'PRICE_READER_PRICING_MODE';

UPDATE shop.feature_presentation_slots slot
SET available_variables = ARRAY(SELECT DISTINCT value FROM unnest(slot.available_variables ||
    ARRAY['standard_shop_price','nitro_shop_price','standard_shop_price_text','nitro_shop_price_text']) value)
FROM shop.feature_versions version JOIN shop.feature_products product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id AND product.code = 'price-reader' AND version.version = '3.1.0';
