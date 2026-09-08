UPDATE shop.feature_presentation_slots AS slot
SET default_definition = '{
      "mode":"EMBED",
      "embed":{
        "color":9107360,
        "title":"🧾 ใบเสร็จการซื้อ Robux",
        "fields":[
          {"name":"Package","value":"```{{package}}```","inline":true},
          {"name":"ราคา","value":"```{{price}} บาท```","inline":true},
          {"name":"{{#group_name}}กลุ่มที่เลือก{{/group_name}}","value":"{{#group_name}}```{{group_name}}```{{/group_name}}","inline":false},
          {"name":"วันที่และเวลาทำรายการ","value":"```{{transaction_time}}```","inline":false}
        ]
      },
      "components_v2":{
        "title":"🧾 ใบเสร็จการซื้อ Robux",
        "description":"**Package**\n```{{package}}```\n**ราคา**\n```{{price}} บาท```{{#group_name}}\n**กลุ่มที่เลือก**\n```{{group_name}}```{{/group_name}}\n**วันที่และเวลาทำรายการ**\n```{{transaction_time}}```"
      }
    }'::jsonb,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '2.2.0'
  AND slot.slot_key = 'receipt';
