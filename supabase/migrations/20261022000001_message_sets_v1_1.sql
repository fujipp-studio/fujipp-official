-- Existing installations retain 1.0.0 until explicitly upgraded.
INSERT INTO shop.feature_versions (id, feature_product_id, version, runtime_key, changelog, status)
SELECT 'f1600000-0000-0000-0000-000000000003', feature_product_id, '1.1.0', runtime_key,
'Send SETs and update existing bot messages by message ID.', 'DRAFT'
FROM shop.feature_versions WHERE id = 'f1600000-0000-0000-0000-000000000002';

INSERT INTO shop.feature_config_definitions (feature_version_id, config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order)
SELECT 'f1600000-0000-0000-0000-000000000003', config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
FROM shop.feature_config_definitions WHERE feature_version_id = 'f1600000-0000-0000-0000-000000000002';

INSERT INTO shop.feature_presentation_slots (feature_version_id, slot_key, label, description, presentation_type, available_variables, default_definition, validation_schema, sort_order)
SELECT 'f1600000-0000-0000-0000-000000000003', slot_key, label, description, presentation_type, available_variables, default_definition, validation_schema, sort_order
FROM shop.feature_presentation_slots WHERE feature_version_id = 'f1600000-0000-0000-0000-000000000002';
