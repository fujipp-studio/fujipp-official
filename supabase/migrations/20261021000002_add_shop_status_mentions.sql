-- Existing installations keep suppressing all mentions until explicitly enabled.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, setting.config_key, setting.label,
    'อนุญาต @here / @everyone ในข้อความประกาศหรือ Components V2 บอทต้องมี Mention Everyone ในห้องประกาศ',
    'BOOLEAN', false, false, 'false'::jsonb,
    '{"type":"boolean"}'::jsonb,
    '{}'::jsonb, setting.sort_order
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
CROSS JOIN (VALUES
    ('SHOP_OPEN_ALLOW_EVERYONE_MENTIONS', 'อนุญาต Ping ตอนเปิดร้าน', 57),
    ('SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS', 'อนุญาต Ping ตอนปิดร้าน', 77)
) AS setting(config_key, label, sort_order)
WHERE product.code = 'shop-status' AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;
