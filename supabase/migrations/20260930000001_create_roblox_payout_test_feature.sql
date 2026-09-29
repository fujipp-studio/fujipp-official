INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'e0710000-0000-0000-0000-000000000001',
    'roblox-payout-test',
    'Roblox Payout Test',
    'Private administrator test for a 1 Robux group payout and Roblox challenge response.',
    'ROBLOX', 'gamepad-2', 'DRAFT', 141
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'e0710000-0000-0000-0000-000000000002',
    'e0710000-0000-0000-0000-000000000001',
    '1.0.0', 'roblox-payout-test',
    'Private administrator payout test with isolated Roblox challenge handling.',
    'PUBLISHED'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
(
    'e0710000-0000-0000-0000-000000000002', 'ROBLOX_TEST_GROUP_ID',
    'Roblox Group ID', 'Group whose funds will send the test payout.',
    'INTEGER', true, false, NULL, '{"minimum":1}'::jsonb, '{"control":"number"}'::jsonb, 10
),
(
    'e0710000-0000-0000-0000-000000000002', 'ROBLOX_TEST_RECIPIENT_ID',
    'Recipient Roblox User ID', 'Account that receives the real 1 Robux test payout.',
    'INTEGER', true, false, NULL, '{"minimum":1}'::jsonb, '{"control":"number"}'::jsonb, 20
),
(
    'e0710000-0000-0000-0000-000000000002', 'ROBLOX_TEST_COOKIE',
    'Roblox cookie', 'Cookie for the group account used only by this test feature.',
    'SECRET', true, true, NULL, '{}'::jsonb, '{"control":"secret"}'::jsonb, 30
),
(
    'e0710000-0000-0000-0000-000000000002', 'ROBLOX_TEST_TOTP_SECRET',
    'Roblox TOTP secret', 'Optional authenticator secret when Roblox requires 2FA.',
    'SECRET', false, true, NULL, '{}'::jsonb, '{"control":"secret"}'::jsonb, 40
);
