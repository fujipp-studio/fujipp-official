-- Google AI Studio auth keys use the AQ. prefix. Keep existing keys and values;
-- only correct the catalog validation applied by configuration forms.
UPDATE shop.feature_config_definitions definition
   SET validation_schema = jsonb_set(
       COALESCE(definition.validation_schema, '{}'::jsonb),
       '{pattern}', to_jsonb('^[A-Za-z0-9_.\-]+$'::text)
   )
  FROM shop.feature_versions version
  JOIN shop.feature_products product ON product.id=version.feature_product_id
 WHERE definition.feature_version_id=version.id
   AND product.code='price-reader' AND version.version='3.0.0'
   AND definition.config_key='GEMINI_API_KEY' AND definition.is_secret;
