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
   AND available_variables @> ARRAY['item_type','pricing_mode','standard_price','nitro_price']) THEN RAISE EXCEPTION 'Missing classified result variables'; END IF;
END $$;
