DO $$
DECLARE version_id uuid;
BEGIN
    SELECT version.id INTO version_id FROM shop.feature_versions version
      JOIN shop.feature_products product ON product.id=version.feature_product_id
     WHERE product.code='price-reader' AND version.version='3.0.0' AND version.runtime_key='price-reader';
    IF version_id IS NULL THEN RAISE EXCEPTION 'Missing Gemini Price Reader version'; END IF;
    IF NOT EXISTS (SELECT 1 FROM shop.feature_config_definitions
        WHERE feature_version_id=version_id AND config_key='GEMINI_API_KEY'
          AND is_secret AND is_required AND value_type='SECRET' AND default_value IS NULL) THEN
        RAISE EXCEPTION 'Gemini key must be a required secret without a default';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM shop.feature_config_definitions
        WHERE feature_version_id=version_id AND config_key='GEMINI_API_KEY'
          AND 'AQ.synthetic-customer.gemini-key' ~ (validation_schema->>'pattern')
          AND 'AIza-synthetic-legacy-google-key' ~ (validation_schema->>'pattern')
          AND NOT ('invalid key with spaces' ~ (validation_schema->>'pattern'))) THEN
        RAISE EXCEPTION 'Gemini key validation must accept auth and legacy keys without whitespace';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM shop.feature_config_definitions
        WHERE feature_version_id=version_id AND config_key='PRICE_READER_GEMINI_MODEL' AND NOT is_secret AND is_required) THEN
        RAISE EXCEPTION 'Missing Gemini model configuration';
    END IF;
    IF (SELECT count(*) FROM shop.feature_presentation_slots
        WHERE feature_version_id=version_id AND slot_key IN ('processing','result','error')) <> 3 THEN
        RAISE EXCEPTION 'Missing Price Reader message slots';
    END IF;
END $$;

DO $$
DECLARE target uuid;
BEGIN
 SELECT version.id INTO target FROM shop.feature_versions version JOIN shop.feature_products product ON product.id=version.feature_product_id
 WHERE product.code='price-reader' AND version.version='3.1.0' AND version.runtime_key='price-reader';
 IF target IS NULL THEN RAISE EXCEPTION 'Missing classified Price Reader version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='GEMINI_API_KEY' AND is_secret
   AND 'AQ.synthetic-customer.gemini-key' ~ (validation_schema->>'pattern')) THEN RAISE EXCEPTION 'Missing Gemini auth key support in classified version'; END IF;
 IF (SELECT count(*) FROM shop.feature_config_definitions WHERE feature_version_id=target AND is_required AND NOT is_secret
   AND config_key IN ('PRICE_READER_PRICING_MODE','PRICE_READER_PRICE_RULES')) <> 2 THEN RAISE EXCEPTION 'Missing classified pricing controls'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_PRICE_MAP')
 THEN RAISE EXCEPTION 'Legacy prices must remain available for reviewed import'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_presentation_slots WHERE feature_version_id=target AND slot_key='result'
   AND available_variables @> ARRAY['item_type','pricing_mode','standard_price','nitro_price','standard_shop_price','nitro_shop_price','standard_shop_price_text','nitro_shop_price_text']) THEN RAISE EXCEPTION 'Missing classified result variables'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_PRICING_MODE'
   AND validation_schema->'enum' @> '["STANDARD","NITRO","BOTH"]'::jsonb
   AND ui_metadata->'options' @> '["STANDARD","NITRO","BOTH"]'::jsonb)
 THEN RAISE EXCEPTION 'Missing dual pricing mode'; END IF;
END $$;

DO $$
DECLARE target uuid;
BEGIN
 SELECT v.id INTO target FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
 WHERE p.code='price-reader' AND v.version='3.2.0' AND v.runtime_key='price-reader';
 IF target IS NULL THEN RAISE EXCEPTION 'Missing counted Price Reader version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_COUNT_PRICE_RULES'
   AND is_required AND default_value='[]'::jsonb AND validation_schema->'items'->'required' @> '["itemCount"]'::jsonb
   AND (validation_schema->'items'->'properties'->'itemCount'->>'maximum')::integer=5)
 THEN RAISE EXCEPTION 'Missing bounded counted pricing schema'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_LANGUAGE'
   AND validation_schema->'enum' @> '["TH","EN"]'::jsonb)
 THEN RAISE EXCEPTION 'Missing bilingual response configuration'; END IF;
 IF (SELECT count(*) FROM shop.feature_presentation_slots WHERE feature_version_id=target
   AND available_variables @> ARRAY['item_count','image_label','order_label'])<>3
 THEN RAISE EXCEPTION 'Missing count and language presentation variables'; END IF;
 IF EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_MATCH_TOLERANCE_SATANG')
 THEN RAISE EXCEPTION 'Counted pricing must use exact matches'; END IF;
 IF (SELECT count(*) FROM shop.feature_config_definitions WHERE feature_version_id=target
   AND config_key IN ('PRICE_READER_BOTH_DISCORD_TEMPLATE','PRICE_READER_BOTH_SHOP_TEMPLATE','PRICE_READER_MISSING_PRICE_TEXT')
   AND NOT is_secret AND is_required AND default_value='"{{default}}"'::jsonb
   AND (validation_schema->>'maxLength')::integer=1000)<>3
 THEN RAISE EXCEPTION 'Missing compatible price text controls'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_presentation_slots WHERE feature_version_id=target AND slot_key='result'
   AND available_variables @> ARRAY['standard_price_text','nitro_price_text','standard_shop_amount_text','nitro_shop_amount_text'])
 THEN RAISE EXCEPTION 'Missing editable tier price variables'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_PRICING_MODE'
   AND validation_schema->'enum' @> '["AUTO"]'::jsonb AND ui_metadata->'options' @> '["AUTO"]'::jsonb AND default_value='"BOTH"'::jsonb)
 THEN RAISE EXCEPTION 'AUTO must be available without changing the existing default tier mode'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_OFFER_MODE'
   AND default_value='"SHOP"'::jsonb AND validation_schema->'enum' @> '["SHOP","GIFT","BOTH"]'::jsonb)
 THEN RAISE EXCEPTION 'Gift offers must default to existing shop-only output'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_config_definitions WHERE feature_version_id=target AND config_key='PRICE_READER_COUNT_PRICE_RULES'
   AND NOT(validation_schema->'items'->'required' @> '["giftPriceSatang"]'::jsonb)
   AND validation_schema->'items'->'properties'->'giftPriceSatang'->'type' @> '["integer","null"]'::jsonb)
 THEN RAISE EXCEPTION 'Gift prices must remain optional whole satang values'; END IF;
 IF (SELECT count(*) FROM shop.feature_config_definitions WHERE feature_version_id=target
   AND config_key IN ('PRICE_READER_GIFT_UNAVAILABLE_TEXT','PRICE_READER_BOTH_GIFT_TEMPLATE','PRICE_READER_OFFER_TEMPLATE')
   AND default_value='"{{default}}"'::jsonb AND (validation_schema->>'maxLength')::integer=1000)<>3
 THEN RAISE EXCEPTION 'Missing configurable Gift wording'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shop.feature_presentation_slots WHERE feature_version_id=target AND slot_key='result'
   AND available_variables @> ARRAY['gift_price_text','offer_price_text','pricing_selection_key'])
 THEN RAISE EXCEPTION 'Missing Gift quote variables'; END IF;
END $$;
