DO $$
DECLARE
    product_id UUID;
    source_version_id UUID;
    target_version_id UUID := 'e0700000-0000-0000-0000-000000000006';
BEGIN
    SELECT id INTO product_id
      FROM shop.feature_products
     WHERE code = 'roblox-robux-payout';

    SELECT id INTO source_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = product_id
       AND version = '2.1.0';

    INSERT INTO shop.feature_versions (
        id, feature_product_id, version, runtime_key, changelog, status
    ) VALUES (
        target_version_id, product_id, '2.2.0', 'roblox-robux-payout',
        'Adds a separately configurable member receipt containing only the purchased package, price, selected group, and transaction time.',
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
        'ROBUX_RECEIPT_CHANNEL_ID',
        'Receipt channel',
        'Channel receiving successful Robux purchase receipts.',
        'CHANNEL_ID',
        false,
        false,
        NULL,
        '{}'::jsonb,
        '{"control":"discord-channel","clearable":true}'::jsonb,
        63
    );

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
        'receipt',
        'Purchase receipt',
        'Receipt sent to the purchasing member after a successful Robux payout.',
        'EMBED',
        ARRAY['package','price','group_name','transaction_time'],
        '{
          "mode":"EMBED",
          "embed":{
            "color":9107360,
            "title":"🧾 ใบเสร็จการซื้อ Robux",
            "fields":[
              {"name":"Package","value":"```{{package}}```","inline":true},
              {"name":"ราคา","value":"```{{price}} บาท```","inline":true},
              {"name":"กลุ่มที่เลือก","value":"```{{group_name}}```","inline":false},
              {"name":"วันที่และเวลาทำรายการ","value":"```{{transaction_time}}```","inline":false}
            ]
          },
          "components_v2":{
            "title":"🧾 ใบเสร็จการซื้อ Robux",
            "description":"**Package**\n```{{package}}```\n**ราคา**\n```{{price}} บาท```\n**กลุ่มที่เลือก**\n```{{group_name}}```\n**วันที่และเวลาทำรายการ**\n```{{transaction_time}}```"
          }
        }'::jsonb,
        '{"type":"object"}'::jsonb,
        85
    );
END $$;
