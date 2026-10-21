-- Role pings require a separate opt-in; existing everyone settings keep their scope.
INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, setting.config_key, setting.label,
    'อนุญาต Role ที่แท็กด้วย <@&ROLE_ID> ในข้อความหรือ Components V2 โดย Role ต้องเปิดให้แท็กได้ หรือบอทมี Mention Everyone',
    'BOOLEAN', false, false, 'false'::jsonb,
    '{"type":"boolean"}'::jsonb,
    '{}'::jsonb, setting.sort_order
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
CROSS JOIN (VALUES
    ('SHOP_OPEN_ALLOW_ROLE_MENTIONS', 'อนุญาต Ping Role ตอนเปิดร้าน', 58),
    ('SHOP_CLOSE_ALLOW_ROLE_MENTIONS', 'อนุญาต Ping Role ตอนปิดร้าน', 78)
) AS setting(config_key, label, sort_order)
WHERE product.code = 'shop-status' AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;
