-- Monthly tracking is opt-in; enabling or changing its cycle affects future additions only.
INSERT INTO shop.feature_config_definitions
    (feature_version_id, config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order)
SELECT v.id, d.key, d.label, d.description, d.type::shop.feature_config_value_type, true, false,
    d.value::jsonb, d.validation::jsonb, d.ui::jsonb, d.position
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id = v.feature_product_id
CROSS JOIN (VALUES
    ('SPENDING_MONTHLY_ENABLED', 'เปิดระบบยอดสะสมรายเดือน', 'ปิดเพื่อสะสมเฉพาะยอดรวมทั้งหมด โดยเก็บประวัติรายเดือนเดิมไว้', 'BOOLEAN', 'false', '{}', '{"control":"switch"}', 94),
    ('SPENDING_MONTHLY_START_DAY', 'วันที่เริ่มรอบประจำเดือน', 'เริ่มรอบเวลา 00:00 น. ตามเวลาไทย วันที่ 29–31 ใช้วันสุดท้ายหากเดือนนั้นมีวันไม่ถึง การเปลี่ยนวันไม่ย้ายยอดย้อนหลัง', 'INTEGER', '1', '{"minimum":1,"maximum":31}', '{"control":"number"}', 95)
) AS d(key, label, description, type, value, validation, ui, position)
WHERE p.code = 'member-spending' AND v.version = '1.0.0';
