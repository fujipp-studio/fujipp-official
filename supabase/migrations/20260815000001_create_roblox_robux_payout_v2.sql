DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0700000-0000-0000-0000-000000000003';
BEGIN
    SELECT id INTO product_id FROM shop.feature_products WHERE code = 'roblox-robux-payout';
    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id AND version = '1.0.0';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status
    ) VALUES (
        target_version_id, product_id, '2.0.0', 'roblox-robux-payout',
        'Adds an Open Cloud membership checker that resolves Roblox usernames and displays the current group join date and membership age.',
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

UPDATE shop.feature_config_definitions
SET description = 'Secret object keyed by group key. Every group stores its own cookie, optional totpSecret, and openCloudApiKey with group:read permission.',
    updated_at = now()
WHERE feature_version_id = 'e0700000-0000-0000-0000-000000000003'
  AND config_key = 'ROBLOX_CREDENTIALS';

UPDATE shop.feature_presentation_slots
SET default_definition = jsonb_set(
        default_definition,
        '{components,btn_membership}',
        '{"label":"เช็กวันที่เข้ากลุ่ม","emoji":"📅","style":"primary"}'::jsonb,
        true
    ),
    updated_at = now()
WHERE feature_version_id = 'e0700000-0000-0000-0000-000000000003'
  AND slot_key = 'panel';

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
) VALUES (
    'e0700000-0000-0000-0000-000000000003',
    'membership_result',
    'Group membership result',
    'Private result showing the Roblox group join date and current membership age.',
    'EMBED',
    ARRAY['roblox_username','roblox_id','group_name','group_id','joined_date','days_in_group','avatar'],
    '{
      "color":9107360,
      "title":"📅 วันที่เข้ากลุ่ม Roblox",
      "description":"**Roblox Username**\n```{{roblox_username}}```\n**กลุ่ม**\n```{{group_name}}```\n**วันที่เข้ากลุ่ม**\n```{{joined_date}}```\n**ระยะเวลาที่อยู่ในกลุ่ม**\n```{{days_in_group}} วัน```",
      "thumbnail":{"url":"{{avatar}}"}
    }'::jsonb,
    '{"type":"object"}'::jsonb,
    25
);
