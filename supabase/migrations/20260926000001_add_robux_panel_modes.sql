DO $$
DECLARE
    target_version_id UUID;
BEGIN
    SELECT version.id INTO target_version_id
      FROM shop.feature_versions AS version
      JOIN shop.feature_products AS product
        ON product.id = version.feature_product_id
     WHERE product.code = 'roblox-robux-payout'
       AND version.version = '3.0.0';

    UPDATE shop.feature_config_definitions
       SET description = 'Panels with independent presentation slots. Mode storefront enables purchase and wallet actions; membership_only shows only the group join-date check.',
           validation_schema = '{"type":"array","maxItems":25,"items":{"type":"object","required":["key","name","groupKeys","presentationSlot"],"properties":{"key":{"type":"string","pattern":"^[a-z0-9_-]{1,40}$"},"name":{"type":"string","minLength":1,"maxLength":100},"groupKeys":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,40}$"}},"presentationSlot":{"type":"string","pattern":"^panel_([1-9]|1[0-9]|2[0-5])$"},"mode":{"type":"string","enum":["storefront","membership_only"],"default":"storefront"}}}}'::jsonb,
           updated_at = now()
     WHERE feature_version_id = target_version_id
       AND config_key = 'ROBUX_PANELS';
END $$;
