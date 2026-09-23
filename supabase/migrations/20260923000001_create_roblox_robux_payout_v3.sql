DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0700000-0000-0000-0000-000000000007';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'roblox-robux-payout';

    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '2.2.0';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status
    ) VALUES (
        target_version_id, product_id, '3.0.0', 'roblox-robux-payout',
        'Adds multiple independently posted sales panels, assigns groups to each panel, and supports a separate Robux rate for every group.',
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

    INSERT INTO shop.feature_config_definitions (
        feature_version_id, config_key, label, description, value_type,
        is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
    ) VALUES (
        target_version_id,
        'ROBUX_PANELS',
        'Robux panels',
        'Sales panels. Each panel contains a key, display name, and the group keys offered by that panel.',
        'JSON',
        false,
        false,
        '[]'::jsonb,
        '{"type":"array","maxItems":25,"items":{"type":"object","required":["key","name","groupKeys"],"properties":{"key":{"type":"string","pattern":"^[a-z0-9_-]{1,40}$"},"name":{"type":"string","minLength":1,"maxLength":100},"groupKeys":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,40}$"}}}}}'::jsonb,
        '{"control":"robux-panels"}'::jsonb,
        75
    );

    UPDATE shop.feature_config_definitions
       SET description = 'Array of {key,name,groupId,rate}. Rate is the Robux received per one baht for this group. Secrets use matching keys in ROBLOX_CREDENTIALS.',
           validation_schema = '{"type":"array","minItems":1,"maxItems":25,"items":{"type":"object","required":["key","name","groupId","rate"],"properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,40}$"},"name":{"type":"string","minLength":1,"maxLength":100},"groupId":{"type":"integer","minimum":1},"rate":{"type":"number","exclusiveMinimum":0}}}}'::jsonb,
           updated_at = now()
     WHERE feature_version_id = target_version_id
       AND config_key = 'ROBLOX_GROUPS';

    UPDATE shop.feature_config_definitions
       SET label = 'Default Robux rate',
           description = 'Fallback Robux per one baht used only when an upgraded group has no group-specific rate.',
           updated_at = now()
     WHERE feature_version_id = target_version_id
       AND config_key = 'ROBUX_RATE';

    INSERT INTO shop.feature_presentation_slots (
        feature_version_id, slot_key, label, description, presentation_type,
        available_variables, default_definition, validation_schema, sort_order
    )
    SELECT target_version_id, slot_key, label, description, presentation_type,
           available_variables, default_definition, validation_schema, sort_order
      FROM shop.feature_presentation_slots
     WHERE feature_version_id = source_version_id;
END $$;
