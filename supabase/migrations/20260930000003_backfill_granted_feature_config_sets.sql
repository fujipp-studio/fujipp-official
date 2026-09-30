INSERT INTO private.feature_config_sets (license_id, feature_product_id, feature_version_id)
SELECT license.id, license.feature_product_id, license.acquired_version_id
  FROM private.feature_licenses AS license
 WHERE license.source = 'GRANT'
   AND NOT EXISTS (
       SELECT 1
         FROM private.feature_config_sets AS config_set
        WHERE config_set.license_id = license.id
   )
ON CONFLICT (license_id) DO NOTHING;
