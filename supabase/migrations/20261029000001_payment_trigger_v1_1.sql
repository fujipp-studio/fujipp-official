-- Installations keep their current version and saved designs until explicitly upgraded.
DO $$
DECLARE
    source_id UUID;
    target_id UUID := 'f1400000-0000-0000-0000-000000000003';
BEGIN
    SELECT version.id INTO STRICT source_id
    FROM shop.feature_versions version
    JOIN shop.feature_products product ON product.id = version.feature_product_id
    WHERE product.code = 'payment-trigger' AND version.version = '1.0.0';

    -- The catalog permits one published version per product. Installed licenses
    -- retain the supported older version until their owner explicitly upgrades.
    UPDATE shop.feature_versions
       SET status = 'DEPRECATED', updated_at = now()
     WHERE id = source_id AND status = 'PUBLISHED';

    INSERT INTO shop.feature_versions (id, feature_product_id, version, runtime_key, changelog, status, published_at)
    SELECT target_id, feature_product_id, '1.1.0', runtime_key,
           'Back buttons in bank and Wallet screens, with per-button update or new-message responses.',
           'PUBLISHED', now()
    FROM shop.feature_versions WHERE id = source_id;

    INSERT INTO shop.feature_config_definitions (feature_version_id, config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order)
    SELECT target_id, config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
    FROM shop.feature_config_definitions WHERE feature_version_id = source_id;

    INSERT INTO shop.feature_presentation_slots (feature_version_id, slot_key, label, description, presentation_type, available_variables, default_definition, validation_schema, sort_order)
    SELECT target_id, slot_key, label, description, presentation_type, available_variables,
           CASE WHEN slot_key IN ('bank_payment', 'wallet_payment')
                THEN jsonb_set(default_definition, '{components}', COALESCE(default_definition->'components', '{}'::jsonb) || '{"back_button":{"label":"กลับไปเลือกช่องทาง","emoji":"↩️","style":"secondary","response_mode":"UPDATE"}}'::jsonb)
                WHEN slot_key = 'method_selector'
                THEN jsonb_set(jsonb_set(jsonb_set(default_definition,
                    '{components,bank_button,response_mode}', '"UPDATE"'::jsonb),
                    '{components,wallet_button,response_mode}', '"UPDATE"'::jsonb),
                    '{components,voucher_button,response_mode}', '"NEW_MESSAGE"'::jsonb)
                ELSE default_definition END,
           validation_schema, sort_order
    FROM shop.feature_presentation_slots WHERE feature_version_id = source_id;
END $$;
