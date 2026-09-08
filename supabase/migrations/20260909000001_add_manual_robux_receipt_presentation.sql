INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id,
       'manual_receipt',
       'Manual purchase receipt',
       'Receipt created manually by an administrator for another transaction type.',
       'EMBED',
       ARRAY['package','price','transaction_time'],
       '{
         "mode":"EMBED",
         "embed":{
           "color":9107360,
           "title":"🧾 ใบเสร็จการซื้อ Robux",
           "fields":[
             {"name":"Package","value":"```{{package}}```","inline":true},
             {"name":"ราคา","value":"```{{price}} บาท```","inline":true},
             {"name":"วันที่และเวลาทำรายการ","value":"```{{transaction_time}}```","inline":false}
           ]
         },
         "components_v2":{
           "title":"🧾 ใบเสร็จการซื้อ Robux",
           "description":"**Package**\n```{{package}}```\n**ราคา**\n```{{price}} บาท```\n**วันที่และเวลาทำรายการ**\n```{{transaction_time}}```"
         }
       }'::jsonb,
       '{"type":"object"}'::jsonb,
       86
  FROM shop.feature_versions AS version
  JOIN shop.feature_products AS product ON product.id = version.feature_product_id
 WHERE product.code = 'roblox-robux-payout'
   AND version.version = '2.2.0'
ON CONFLICT (feature_version_id, slot_key) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    presentation_type = EXCLUDED.presentation_type,
    available_variables = EXCLUDED.available_variables,
    default_definition = EXCLUDED.default_definition,
    validation_schema = EXCLUDED.validation_schema,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
