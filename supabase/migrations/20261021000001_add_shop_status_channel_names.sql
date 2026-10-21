-- Blank names preserve existing channel names for every installed configuration.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, setting.config_key, setting.label,
    'เว้นว่างเพื่อไม่เปลี่ยนชื่อห้องประกาศ บอทต้องมี Manage Channels (Manage Threads สำหรับเธรด)',
    'STRING', false, false, '""'::jsonb,
    '{"type":"string","maxLength":100}'::jsonb,
    '{}'::jsonb, setting.sort_order
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
CROSS JOIN (VALUES
    ('SHOP_OPEN_CHANNEL_NAME', 'ชื่อห้องตอนเปิดร้าน (ไม่บังคับ)', 56),
    ('SHOP_CLOSE_CHANNEL_NAME', 'ชื่อห้องตอนปิดร้าน (ไม่บังคับ)', 76)
) AS setting(config_key, label, sort_order)
WHERE product.code = 'shop-status' AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;
