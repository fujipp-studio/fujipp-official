-- Reuse the existing private redemption ledger; raw gift links are never stored.
ALTER TABLE private.truemoney_voucher_redemptions
    ADD COLUMN payment_message_id VARCHAR(30),
    ADD COLUMN expected_amount_satang BIGINT,
    ADD CONSTRAINT truemoney_payment_context_chk CHECK (
        (payment_message_id IS NULL AND expected_amount_satang IS NULL)
        OR (payment_message_id IS NOT NULL AND payment_message_id ~ '^[0-9]{15,30}$'
            AND expected_amount_satang IS NOT NULL AND expected_amount_satang BETWEEN 1 AND 100000000
            AND (status <> 'SUCCEEDED' OR amount_satang = expected_amount_satang))
    );

-- Claim an invoice before contacting TrueMoney. Failed verification allows a corrected
-- voucher; ambiguous outcomes hold the invoice for reconciliation instead of charging twice.
CREATE UNIQUE INDEX truemoney_one_payment_per_message
    ON private.truemoney_voucher_redemptions (bot_id, payment_message_id)
    WHERE payment_message_id IS NOT NULL
      AND status IN ('REDEEMING', 'SUCCEEDED', 'RECONCILIATION_REQUIRED');

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, 'TRUEMONEY_ENABLED', 'รับชำระด้วยซองอั่งเปา',
       'รับซองสำหรับผู้รับ 1 คนเข้าหมายเลข Wallet ของ Payment Trigger ยอดต้องตรงรายการ ไม่บวกค่าธรรมเนียมและไม่เพิ่มเครดิตลูกค้า',
       'BOOLEAN', false, false, 'false'::jsonb, '{"type":"boolean"}'::jsonb,
       '{"control":"toggle"}'::jsonb, 50
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
WHERE product.code = 'payment-trigger';

-- Preserve every saved design and fill only the new system-button setting.
UPDATE shop.feature_presentation_slots slot
SET default_definition = jsonb_set(slot.default_definition, '{components}',
    COALESCE(slot.default_definition->'components', '{}'::jsonb) ||
    '{"voucher_button":{"label":"ชำระด้วยซองอั่งเปา","emoji":"🧧","style":"danger"}}'::jsonb)
FROM shop.feature_versions version, shop.feature_products product
WHERE slot.feature_version_id = version.id AND version.feature_product_id = product.id
  AND product.code = 'payment-trigger' AND slot.slot_key = 'method_selector';

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id, 'payment_success', 'ชำระเงินสำเร็จ', 'แสดงเมื่อยืนยันการรับเงินจากซองอั่งเปาและยอดตรงกับรายการแล้ว',
       'COMPONENTS_V2', ARRAY['amount','base_amount','fee_amount','total_amount','paid_amount','member_mention','member_id','payment_id','reference','payment_method','datetime'], '{"mode": "COMPONENTS_V2", "embed": {"color": 5763719, "title": "✅ ชำระเงินสำเร็จ", "description": "รับชำระเงินจาก {{member_mention}} ผ่าน {{payment_method}}\n\n**ยอดชำระ:** {{paid_amount}} บาท\n**เลขรายการ:** {{payment_id}}\n**อ้างอิง:** {{reference}}", "footer": {"text": "{{datetime}}"}}, "components_v2": {"components": [{"type": 17, "accent_color": 5763719, "components": [{"type": 10, "content": "# ✅ ชำระเงินสำเร็จ"}, {"type": 14, "divider": true, "spacing": 1}, {"type": 10, "content": "รับชำระเงินจาก {{member_mention}} ผ่าน {{payment_method}}\n\n**ยอดชำระ:** `{{paid_amount}} บาท`\n**เลขรายการ:** `{{payment_id}}`\n**อ้างอิง:** `{{reference}}`"}, {"type": 10, "content": "{{datetime}}"}]}]}}'::jsonb, '{"type":"object"}'::jsonb, 50
FROM shop.feature_versions version
JOIN shop.feature_products product ON product.id = version.feature_product_id
WHERE product.code = 'payment-trigger';
