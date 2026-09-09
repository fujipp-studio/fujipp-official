UPDATE shop.feature_presentation_slots AS slot
SET presentation_type = 'COMPONENTS_V2',
    available_variables = ARRAY['package','price','transaction_time','image_url'],
    default_definition = '{
      "mode":"COMPONENTS_V2",
      "components_v2":{
        "title":"🧾 ใบเสร็จการซื้อ Robux",
        "description":"**Package**\n```{{package}}```\n**ราคา**\n```{{price}} บาท```\n**วันที่และเวลาทำรายการ**\n```{{transaction_time}}```",
        "image_url":"{{image_url}}"
      }
    }'::jsonb,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '2.2.0'
  AND slot.slot_key = 'manual_receipt';
