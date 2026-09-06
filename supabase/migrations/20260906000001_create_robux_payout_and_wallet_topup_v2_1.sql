DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0700000-0000-0000-0000-000000000005';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'roblox-robux-payout';

    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '2.0.1';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status
    ) VALUES (
        target_version_id, product_id, '2.1.0', 'roblox-robux-payout',
        'Sends successful payout receipts to the purchasing member by direct message in addition to the configured audit channel.',
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

DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0600000-0000-0000-0000-000000000004';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'wallet-topup';

    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '2.0.0';

    UPDATE shop.feature_versions
       SET status = 'DEPRECATED', updated_at = now()
     WHERE id = source_version_id
       AND status = 'PUBLISHED';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status, published_at
    ) VALUES (
        target_version_id, product_id, '2.1.0', 'wallet-topup',
        'Moves administrator wallet adjustments into a modal and displays a public configurable Components V2 receipt after completion.',
        'PUBLISHED', now()
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

    INSERT INTO shop.feature_presentation_slots (
        feature_version_id, slot_key, label, description, presentation_type,
        available_variables, default_definition, validation_schema, sort_order
    ) VALUES (
        target_version_id,
        'adjustment_result',
        'Wallet adjustment result',
        'Public receipt shown in the command channel after an administrator changes a member wallet balance.',
        'COMPONENTS_V2',
        ARRAY['member_mention','actor_mention','amount','balance','currency','transaction_time','operation','reason'],
        '{
          "mode":"COMPONENTS_V2",
          "title":"✅ ปรับยอดเงินสำเร็จ",
          "description":"**สมาชิก** {{member_mention}}\n**รายการ** {{operation}}\n**จำนวน** {{amount}} {{currency}}\n**ยอดคงเหลือ** {{balance}} {{currency}}\n**ผู้ดำเนินการ** {{actor_mention}}\n**เหตุผล** {{reason}}\n**เวลา** {{transaction_time}}"
        }'::jsonb,
        '{"type":"object"}'::jsonb,
        105
    );
END $$;
