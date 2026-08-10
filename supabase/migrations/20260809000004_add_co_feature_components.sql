UPDATE shop.feature_presentation_slots AS slot
SET default_definition = jsonb_set(
    slot.default_definition,
    '{co_features}',
    '[
      {"featureCode":"wallet-topup","action":"wallet.topup","label":"เติมเงิน","emoji":"💰","style":"success"},
      {"featureCode":"wallet-topup","action":"wallet.balance","label":"เช็คยอดเงินคงเหลือ","emoji":"💳","style":"secondary"}
    ]'::jsonb,
    true
)
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = 'panel';

COMMENT ON TABLE shop.feature_actions IS
    'Stable Co-Feature actions. Editors may reference them, but runtimes must render them only when owner_feature_code is installed on the same bot.';
