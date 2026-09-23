DO $$
DECLARE
    target_version_id UUID;
BEGIN
    SELECT version.id INTO target_version_id
      FROM shop.feature_versions AS version
      JOIN shop.feature_products AS product
        ON product.id = version.feature_product_id
     WHERE product.code = 'roblox-robux-payout'
       AND version.version = '3.0.0';

    UPDATE shop.feature_config_definitions
       SET description = 'Sales panels. Each panel contains a key, display name, offered group keys, and its independent presentation slot.',
           validation_schema = '{"type":"array","maxItems":25,"items":{"type":"object","required":["key","name","groupKeys","presentationSlot"],"properties":{"key":{"type":"string","pattern":"^[a-z0-9_-]{1,40}$"},"name":{"type":"string","minLength":1,"maxLength":100},"groupKeys":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,40}$"}},"presentationSlot":{"type":"string","pattern":"^panel_([1-9]|1[0-9]|2[0-5])$"}}}}'::jsonb,
           updated_at = now()
     WHERE feature_version_id = target_version_id
       AND config_key = 'ROBUX_PANELS';

    UPDATE shop.feature_presentation_slots
       SET sort_order = sort_order + 100,
           updated_at = now()
     WHERE feature_version_id = target_version_id
       AND slot_key <> 'panel';

    INSERT INTO shop.feature_presentation_slots (
        feature_version_id, slot_key, label, description, presentation_type,
        available_variables, default_definition, validation_schema, sort_order
    )
    SELECT target_version_id,
           'panel_' || panel_number,
           'Panel ' || panel_number,
           'Independently configurable sales panel ' || panel_number || '.',
           source.presentation_type,
           source.available_variables,
           source.default_definition,
           source.validation_schema,
           source.sort_order + panel_number
      FROM shop.feature_presentation_slots AS source
      CROSS JOIN generate_series(1, 25) AS panel_number
     WHERE source.feature_version_id = target_version_id
       AND source.slot_key = 'panel';
END $$;
