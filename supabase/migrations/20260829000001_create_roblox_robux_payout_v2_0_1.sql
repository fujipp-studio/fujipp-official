DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0700000-0000-0000-0000-000000000004';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'roblox-robux-payout';

    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '2.0.0';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status
    ) VALUES (
        target_version_id, product_id, '2.0.1', 'roblox-robux-payout',
        'Expands the purchase username field and renames the purchase form to make its purpose clearer.',
        'DRAFT'
    );

    INSERT INTO shop.feature_config_definitions (
        feature_version_id, config_key, label, description, value_type,
        is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
    )
    SELECT target_version_id, config_key, label, description, value_type,
           is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
      FROM shop.feature_config_definitions
     WHERE feature_version_id = source_version_id;

    INSERT INTO shop.feature_presentation_slots (
        feature_version_id, slot_key, label, description, presentation_type,
        available_variables, default_definition, validation_schema, sort_order
    )
    SELECT target_version_id, slot_key, label, description, presentation_type,
           available_variables, default_definition, validation_schema, sort_order
      FROM shop.feature_presentation_slots
     WHERE feature_version_id = source_version_id;
END $$;
