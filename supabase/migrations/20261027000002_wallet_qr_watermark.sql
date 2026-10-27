-- Existing wallets keep the plain locally generated QR unless branding is selected.
INSERT INTO shop.feature_config_definitions (
    feature_version_id,config_key,label,description,value_type,is_required,is_secret,
    default_value,validation_schema,ui_metadata,sort_order
)
SELECT version.id,'PROMPTPAY_QR_WATERMARK','QR watermark',
    'Optional shop-name text or an uploaded logo below the QR. NONE preserves the plain payment QR.',
    'JSON',false,false,'{"mode":"NONE","text":"","logoDataUri":""}'::jsonb,
    '{"type":"object","required":["mode"],"properties":{"mode":{"type":"string","enum":["NONE","TEXT","LOGO"]},"text":{"type":"string","maxLength":60},"logoDataUri":{"type":"string","maxLength":60000}}}'::jsonb,
    '{"control":"wallet-qr-watermark"}'::jsonb,47
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id=version.feature_product_id
WHERE product.code='wallet-topup'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;
