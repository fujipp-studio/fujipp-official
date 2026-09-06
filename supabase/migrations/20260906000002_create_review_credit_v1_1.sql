DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    source_status shop.feature_version_status;
    target_version_id UUID := 'd0300000-0000-0000-0000-000000000003';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'review-credit';

    SELECT id, status INTO source_version_id, source_status
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '1.0.0';

    IF source_version_id IS NULL THEN
        RAISE EXCEPTION 'Review Credit 1.0.0 was not found';
    END IF;

    UPDATE shop.feature_versions
       SET status = 'DEPRECATED', updated_at = now()
     WHERE id = source_version_id
       AND status = 'PUBLISHED';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status, published_at
    ) VALUES (
        target_version_id,
        product_id,
        '1.1.0',
        'review-credit',
        'Counts member and webhook review messages and lets administrators replace the saved review count.',
        CASE
            WHEN source_status = 'PUBLISHED' THEN 'PUBLISHED'::shop.feature_version_status
            ELSE 'DRAFT'::shop.feature_version_status
        END,
        CASE WHEN source_status = 'PUBLISHED' THEN now() ELSE NULL END
    );

    INSERT INTO shop.feature_config_definitions (
        feature_version_id, config_key, label, description, value_type,
        is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
    )
    SELECT target_version_id, config_key, label, description, value_type,
           is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
      FROM shop.feature_config_definitions
     WHERE feature_version_id = source_version_id;

    INSERT INTO shop.feature_config_definitions (
        feature_version_id, config_key, label, description, value_type,
        is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
    ) VALUES (
        target_version_id,
        'REVIEW_COUNT_WEBHOOKS',
        'Count webhook messages',
        'Include webhook messages in the review count while excluding ordinary bot messages.',
        'BOOLEAN',
        true,
        false,
        'true'::jsonb,
        '{}'::jsonb,
        '{"control":"switch"}'::jsonb,
        80
    );

    INSERT INTO shop.feature_presentation_slots (
        feature_version_id, slot_key, label, description, presentation_type,
        available_variables, default_definition, validation_schema, sort_order
    )
    SELECT target_version_id, slot_key, label, description, presentation_type,
           available_variables, default_definition, validation_schema, sort_order
      FROM shop.feature_presentation_slots
     WHERE feature_version_id = source_version_id;
END $$;
