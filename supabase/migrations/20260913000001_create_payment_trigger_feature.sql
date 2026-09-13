INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'f1400000-0000-0000-0000-000000000001',
    'payment-trigger',
    'Payment Trigger',
    'Creates a payment method selector from an administrator message such as p10, with bank QR and Wallet totals.',
    'DISCORD_UTILITY',
    'badge-dollar-sign',
    'DRAFT',
    160
);

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
) VALUES (
    'f1400000-0000-0000-0000-000000000002',
    'f1400000-0000-0000-0000-000000000001',
    '1.0.0',
    'payment-trigger',
    'Initial administrator payment trigger with configurable bank QR, Wallet surcharge, and Components V2 payment templates.',
    'DRAFT'
);

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type,
    is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order
) VALUES
(
    'f1400000-0000-0000-0000-000000000002',
    'PAYMENT_TRIGGER_PREFIX',
    'คำนำหน้า Trigger',
    'ข้อความที่ผู้ดูแลใช้เรียกหน้าชำระเงิน เช่น กำหนดเป็น p แล้วส่ง p10 สำหรับยอด 10 บาท',
    'STRING', true, false, '"p"'::jsonb,
    '{"pattern":"^[a-zA-Z]{1,10}$"}'::jsonb,
    '{"control":"text","placeholder":"p"}'::jsonb,
    10
),
(
    'f1400000-0000-0000-0000-000000000002',
    'BANK_QR_IMAGE_URL',
    'URL รูป QR ธนาคาร',
    'ลิงก์ HTTPS ของรูป QR Code ที่จะแสดงเมื่อเลือกรับชำระผ่านธนาคาร',
    'STRING', true, false, NULL,
    '{"pattern":"^https://.+","maxLength":2000}'::jsonb,
    '{"control":"text","placeholder":"https://example.com/payment-qr.png"}'::jsonb,
    20
),
(
    'f1400000-0000-0000-0000-000000000002',
    'WALLET_NUMBER',
    'หมายเลข Wallet',
    'หมายเลข Wallet ที่ลูกค้าต้องใช้สำหรับชำระเงิน',
    'STRING', true, false, NULL,
    '{"pattern":"^[0-9]{10}$"}'::jsonb,
    '{"control":"text","placeholder":"0812345678"}'::jsonb,
    30
),
(
    'f1400000-0000-0000-0000-000000000002',
    'WALLET_FEE_SATANG',
    'ค่าธรรมเนียม Wallet',
    'ค่าธรรมเนียมที่บวกเพิ่มจากยอดตั้งต้น หน่วยเป็นสตางค์ โดยค่าเริ่มต้น 500 เท่ากับ 5 บาท',
    'INTEGER', true, false, '500'::jsonb,
    '{"minimum":0,"maximum":100000}'::jsonb,
    '{"control":"number","suffix":"สตางค์"}'::jsonb,
    40
);

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
) VALUES
(
    'f1400000-0000-0000-0000-000000000002',
    'method_selector',
    'เลือกช่องทางการชำระเงิน',
    'ข้อความหลักที่แสดงยอดตั้งต้นและให้ลูกค้าเลือก QR ธนาคารหรือ Wallet',
    'COMPONENTS_V2',
    ARRAY['amount', 'base_amount', 'fee_amount', 'total_amount', 'datetime'],
    '{
      "mode":"COMPONENTS_V2",
      "components":{
        "bank_button":{"label":"สแกน QR ธนาคาร","emoji":"🏦","style":"success"},
        "wallet_button":{"label":"ชำระผ่าน Wallet","emoji":"🟠","style":"primary"}
      },
      "embed":{
        "color":5793266,
        "title":"💳 เลือกช่องทางการชำระเงิน",
        "description":"กรุณาเลือกช่องทางที่ต้องการชำระเงินจากปุ่มด้านล่าง\n\n**ยอดรายการ:** {{base_amount}} บาท\n\n> โปรดตรวจสอบยอดเงินให้ถูกต้องก่อนชำระเงิน\n> การชำระผ่าน Wallet มีค่าธรรมเนียมเพิ่มเติม {{fee_amount}} บาท",
        "footer":{"text":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
      },
      "components_v2":{
        "components":[{
          "type":17,
          "accent_color":5793266,
          "components":[
            {"type":10,"content":"# 💳 เลือกช่องทางการชำระเงิน"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"กรุณาเลือกช่องทางที่ต้องการชำระเงินจากปุ่มด้านล่าง\n\n**ยอดรายการ:** `{{base_amount}} บาท`\n\n> โปรดตรวจสอบยอดเงินให้ถูกต้องก่อนชำระเงิน\n> การชำระผ่าน Wallet มีค่าธรรมเนียมเพิ่มเติม `{{fee_amount}} บาท`"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
          ]
        }]
      }
    }'::jsonb,
    '{"type":"object"}'::jsonb,
    10
),
(
    'f1400000-0000-0000-0000-000000000002',
    'bank_payment',
    'ชำระเงินผ่าน QR ธนาคาร',
    'แสดง QR Code และยอดชำระผ่านธนาคารตามยอดตั้งต้น',
    'COMPONENTS_V2',
    ARRAY['amount', 'base_amount', 'qr_image_url', 'datetime'],
    '{
      "mode":"COMPONENTS_V2",
      "embed":{
        "color":5763719,
        "title":"🏦 ชำระเงินผ่าน QR ธนาคาร",
        "description":"กรุณาสแกน QR Code เพื่อดำเนินการชำระเงิน\n\n**ยอดที่ต้องชำระ:** {{amount}} บาท\n\n> กรุณาชำระเงินให้ตรงตามยอดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้",
        "image_url":"{{qr_image_url}}",
        "footer":{"text":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
      },
      "components_v2":{
        "components":[{
          "type":17,
          "accent_color":5763719,
          "components":[
            {"type":10,"content":"# 🏦 ชำระเงินผ่าน QR ธนาคาร\nกรุณาสแกน QR Code ด้านล่างเพื่อดำเนินการชำระเงิน"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"**ยอดที่ต้องชำระ:** `{{amount}} บาท`\n\n> กรุณาชำระเงินให้ตรงตามยอดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้"},
            {"type":12,"items":[{"media":{"url":"{{qr_image_url}}"},"description":"QR Code สำหรับชำระเงินผ่านธนาคาร"}]},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
          ]
        }]
      }
    }'::jsonb,
    '{"type":"object"}'::jsonb,
    20
),
(
    'f1400000-0000-0000-0000-000000000002',
    'wallet_payment',
    'ชำระเงินผ่าน Wallet',
    'แสดงยอดตั้งต้น ค่าธรรมเนียม และยอดรวมสำหรับชำระผ่าน Wallet',
    'COMPONENTS_V2',
    ARRAY['amount', 'base_amount', 'fee_amount', 'total_amount', 'wallet_number', 'datetime'],
    '{
      "mode":"COMPONENTS_V2",
      "embed":{
        "color":3447003,
        "title":"🟠 ชำระเงินผ่าน Wallet",
        "description":"กรุณาโอนเงินไปยังหมายเลข Wallet ด้านล่าง\n\n**ยอดรายการ:** {{base_amount}} บาท\n**ค่าธรรมเนียม Wallet:** {{fee_amount}} บาท\n**ยอดที่ต้องชำระทั้งหมด:** {{total_amount}} บาท\n**หมายเลข Wallet:** `{{wallet_number}}`\n\n> กรุณาโอนเงินให้ตรงตามยอดทั้งหมดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้",
        "footer":{"text":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
      },
      "components_v2":{
        "components":[{
          "type":17,
          "accent_color":3447003,
          "components":[
            {"type":10,"content":"# 🟠 ชำระเงินผ่าน Wallet\nกรุณาโอนเงินไปยังหมายเลข Wallet ด้านล่าง"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"**ยอดรายการ:** `{{base_amount}} บาท`\n**ค่าธรรมเนียม Wallet:** `{{fee_amount}} บาท`\n**ยอดที่ต้องชำระทั้งหมด:** `{{total_amount}} บาท`\n**หมายเลข Wallet:** `{{wallet_number}}`"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"> กรุณาโอนเงินให้ตรงตามยอดทั้งหมดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"ขอบคุณที่ใช้บริการ · {{datetime}}"}
          ]
        }]
      }
    }'::jsonb,
    '{"type":"object"}'::jsonb,
    30
),
(
    'f1400000-0000-0000-0000-000000000002',
    'invalid_amount',
    'แจ้งเตือนยอดเงินไม่ถูกต้อง',
    'แสดงเมื่อผู้ดูแลส่ง Trigger โดยไม่ระบุยอดหรือระบุยอดไม่ถูกต้อง',
    'COMPONENTS_V2',
    ARRAY['trigger'],
    '{
      "mode":"COMPONENTS_V2",
      "embed":{
        "color":15548997,
        "title":"⚠️ ไม่พบยอดชำระเงิน",
        "description":"กรุณาระบุยอดเงินต่อท้าย Trigger เช่น `{{trigger}}10` สำหรับยอด 10 บาท\n\nรองรับทศนิยมไม่เกิน 2 ตำแหน่ง และยอดต้องมากกว่า 0 บาท"
      },
      "components_v2":{
        "components":[{
          "type":17,
          "accent_color":15548997,
          "components":[
            {"type":10,"content":"# ⚠️ ไม่พบยอดชำระเงิน"},
            {"type":14,"divider":true,"spacing":1},
            {"type":10,"content":"กรุณาระบุยอดเงินต่อท้าย Trigger เช่น `{{trigger}}10` สำหรับยอด 10 บาท\n\nรองรับทศนิยมไม่เกิน 2 ตำแหน่ง และยอดต้องมากกว่า 0 บาท"}
          ]
        }]
      }
    }'::jsonb,
    '{"type":"object"}'::jsonb,
    40
);
