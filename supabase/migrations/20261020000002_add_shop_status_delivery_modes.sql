-- Preserve existing announcements unless a delivery policy is explicitly selected.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, mode.config_key, mode.label,
    'ใช้กับประกาศร้านล่าสุดในห้องเดียวกัน หากยังไม่มีจะส่งข้อความใหม่',
    'ENUM', true, false, '"NEW"'::jsonb,
    '{"type":"string","enum":["NEW","UPDATE","REPLACE"]}'::jsonb,
    '{"control":"select","options":[{"value":"NEW","label":"ส่งข้อความใหม่"},{"value":"UPDATE","label":"อัปเดตข้อความเดิม"},{"value":"REPLACE","label":"ลบข้อความเดิมแล้วส่งใหม่"}]}'::jsonb,
    mode.sort_order
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
CROSS JOIN (VALUES
    ('SHOP_OPEN_DELIVERY_MODE', 'การส่งประกาศเปิดร้าน', 55),
    ('SHOP_CLOSE_DELIVERY_MODE', 'การส่งประกาศปิดร้าน', 75)
) AS mode(config_key, label, sort_order)
WHERE product.code = 'shop-status' AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;
