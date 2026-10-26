-- Existing undated balances stay in lifetime totals; monthly tracking starts on deployment.
CREATE TABLE private.member_spending_monthly (
    bot_id UUID NOT NULL,
    member_discord_id VARCHAR(30) NOT NULL,
    month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
    amount_satang BIGINT NOT NULL DEFAULT 0 CHECK (amount_satang >= 0),
    tx_count INTEGER NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    PRIMARY KEY (bot_id, member_discord_id, month),
    FOREIGN KEY (bot_id, member_discord_id) REFERENCES private.member_spending ON DELETE CASCADE
);
CREATE INDEX member_spending_monthly_rank_idx
    ON private.member_spending_monthly(bot_id, month, amount_satang DESC, tx_count DESC, member_discord_id);

CREATE TABLE private.member_spending_operations (
    bot_id UUID NOT NULL REFERENCES bots.bot_instances(id) ON DELETE CASCADE,
    operation_key TEXT NOT NULL,
    member_discord_id VARCHAR(30) NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('ADD', 'SET', 'DELETE')),
    requested_amount BIGINT,
    requested_count INTEGER,
    amount_delta BIGINT NOT NULL,
    count_delta INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bot_id, operation_key)
);
ALTER TABLE private.member_spending_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.member_spending_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.member_spending_monthly, private.member_spending_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.member_spending_monthly TO service_role;
GRANT SELECT, INSERT ON private.member_spending_operations TO service_role;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fujipp_backend') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON private.member_spending_monthly TO fujipp_backend;
        GRANT SELECT, INSERT ON private.member_spending_operations TO fujipp_backend;
    END IF;
END;
$$;

INSERT INTO shop.feature_config_definitions
    (feature_version_id, config_key, label, description, value_type, is_required, is_secret, default_value, validation_schema, ui_metadata, sort_order)
SELECT v.id, d.key, d.label, d.description, d.type::shop.feature_config_value_type, d.required, false, d.value::jsonb, d.validation::jsonb, d.ui::jsonb, d.position
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id = v.feature_product_id
CROSS JOIN (VALUES
    ('SPENDING_MONTHLY_ROLES_ENABLED', 'เปิดยศอันดับประจำเดือน', 'จัดอันดับจากยอดเดือนปัจจุบันตามเวลาไทย แยกจากยศยอดรวม', 'BOOLEAN', true, 'false', '{}', '{"control":"switch"}', 100),
    ('SPENDING_MONTHLY_TOP1_ROLE_ID', 'ยศ Top 1 ประจำเดือน', 'เว้นว่างได้หากไม่ต้องการมอบยศ', 'ROLE_ID', false, NULL, '{"pattern":"^[0-9]{15,30}$"}', '{"control":"role-select"}', 110),
    ('SPENDING_MONTHLY_TOP5_ROLE_ID', 'ยศ Top 2–5 ประจำเดือน', 'ใช้ยศแยกจากยศอันดับยอดรวม', 'ROLE_ID', false, NULL, '{"pattern":"^[0-9]{15,30}$"}', '{"control":"role-select"}', 120),
    ('SPENDING_MONTHLY_ROLES_RESET', 'ถอนยศเมื่อหลุดอันดับหรือเปลี่ยนเดือน', 'ปิดเพื่อเก็บยศที่เคยได้รับไว้ เปิดเพื่อให้ยศเฉพาะอันดับเดือนปัจจุบัน', 'BOOLEAN', true, 'true', '{}', '{"control":"switch"}', 130)
) AS d(key, label, description, type, required, value, validation, ui, position)
WHERE p.code = 'member-spending' AND v.version = '1.0.0';

UPDATE shop.feature_presentation_slots s
SET available_variables = s.available_variables || ARRAY['this_month', 'this_month_count', 'month']
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id = v.feature_product_id
WHERE s.feature_version_id = v.id AND p.code = 'member-spending'
    AND s.slot_key IN ('first_card', 'returning_card');

INSERT INTO shop.feature_presentation_slots
    (feature_version_id, slot_key, label, description, presentation_type, available_variables, default_definition, validation_schema, sort_order)
SELECT v.id, 'monthly_leaderboard', 'อันดับยอดสะสมประจำเดือน', 'อันดับรายเดือนตามเวลาไทย แยกจากอันดับยอดรวม',
    'COMPONENTS_V2', ARRAY['leaderboard_lines', 'member_count', 'month'],
    '{"mode":"COMPONENTS_V2","components":[{"type":17,"components":[{"type":10,"content":"## 🏆 อันดับประจำเดือน {{month}}\n{{leaderboard_lines}}"}]}]}'::jsonb,
    '{"type":"object"}'::jsonb, 40
FROM shop.feature_versions v JOIN shop.feature_products p ON p.id = v.feature_product_id
WHERE p.code = 'member-spending' AND v.version = '1.0.0';
