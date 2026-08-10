UPDATE shop.feature_config_definitions AS definition
SET description = 'Robux amounts offered for sale. Prices are calculated from ROBUX_RATE.',
    default_value = (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('robux', item->'robux')), '[]'::jsonb)
      FROM jsonb_array_elements(definition.default_value) AS item
    ),
    ui_metadata = '{"control":"robux-packages"}'::jsonb,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE definition.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND definition.config_key = 'ROBUX_PACKAGES';

UPDATE private.feature_config_values AS config
SET value = (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('robux', item->'robux')), '[]'::jsonb)
      FROM jsonb_array_elements(config.value) AS item
    ),
    updated_at = now()
FROM shop.feature_config_definitions AS definition
JOIN shop.feature_versions AS version ON version.id = definition.feature_version_id
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE config.definition_id = definition.id
  AND product.code = 'roblox-robux-payout'
  AND definition.config_key = 'ROBUX_PACKAGES';
