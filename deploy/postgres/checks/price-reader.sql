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
        WHERE feature_version_id=version_id AND config_key='PRICE_READER_GEMINI_MODEL' AND NOT is_secret AND is_required) THEN
        RAISE EXCEPTION 'Missing Gemini model configuration';
    END IF;
    IF (SELECT count(*) FROM shop.feature_presentation_slots
        WHERE feature_version_id=version_id AND slot_key IN ('processing','result','error')) <> 3 THEN
        RAISE EXCEPTION 'Missing Price Reader message slots';
    END IF;
END $$;
