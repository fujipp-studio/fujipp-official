CREATE TABLE private.role_shop_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots.bot_instances(id) ON DELETE RESTRICT,
    member_discord_id VARCHAR(30) NOT NULL CHECK (member_discord_id ~ '^[0-9]{15,30}$'),
    product_key VARCHAR(40) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    role_id VARCHAR(30) NOT NULL CHECK (role_id ~ '^[0-9]{15,30}$'),
    price_satang BIGINT NOT NULL CHECK (price_satang > 0 AND price_satang <= 9007199254740991),
    status VARCHAR(20) NOT NULL DEFAULT 'DEBITED'
        CHECK (status IN ('DEBITED','PROCESSING','SUCCEEDED','REFUNDED')),
    idempotency_key VARCHAR(100) NOT NULL,
    wallet_debit_entry_id UUID NOT NULL REFERENCES private.member_wallet_entries(id),
    wallet_refund_entry_id UUID REFERENCES private.member_wallet_entries(id),
    claim_token UUID,
    processing_started_at TIMESTAMPTZ,
    error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE (bot_id, idempotency_key),
    FOREIGN KEY (bot_id, member_discord_id) REFERENCES private.member_wallets(bot_id, member_discord_id),
    CHECK ((status IN ('DEBITED','PROCESSING') AND completed_at IS NULL)
        OR (status IN ('SUCCEEDED','REFUNDED') AND completed_at IS NOT NULL)),
    CHECK ((status = 'REFUNDED') = (wallet_refund_entry_id IS NOT NULL))
);
CREATE UNIQUE INDEX role_shop_owned_role_idx
    ON private.role_shop_purchases(bot_id,member_discord_id,role_id)
    WHERE status IN ('DEBITED','PROCESSING','SUCCEEDED');
ALTER TABLE private.role_shop_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.role_shop_purchases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.role_shop_purchases TO service_role;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fujipp_backend') THEN
        GRANT SELECT,INSERT,UPDATE ON private.role_shop_purchases TO fujipp_backend;
    END IF;
END $$;

INSERT INTO shop.feature_products (id,code,name,description,category,icon_key,status,sort_order)
VALUES ('e0800000-0000-0000-0000-000000000001','role-shop','Role Shop',
    'ขายยศ Discord โดยใช้ยอดเงินร่วมกับ Wallet Top-up และ Roblox Payout',
    'PAYMENTS','badge-check','DRAFT',132);
INSERT INTO shop.feature_versions (id,feature_product_id,version,runtime_key,changelog,status)
VALUES ('e0800000-0000-0000-0000-000000000002','e0800000-0000-0000-0000-000000000001',
    '1.0.0','role-shop','Discord role purchases with shared Wallet balances, receipts, refunds and restart recovery.','DRAFT');
INSERT INTO shop.feature_config_definitions (
    feature_version_id,config_key,label,description,value_type,is_required,is_secret,
    default_value,validation_schema,ui_metadata,sort_order
) VALUES
('e0800000-0000-0000-0000-000000000002','ROLE_SHOP_COMMAND_NAME','คำสั่งแผงขายยศ',
 'คำสั่งสำหรับผู้ดูแลเพื่อส่งแผงขายยศ','STRING',true,false,'"role-shop-panel"',
 '{"pattern":"^[a-z0-9_-]{1,32}$"}','{}',10),
('e0800000-0000-0000-0000-000000000002','ROLE_SHOP_PRODUCTS','ยศที่ขาย',
 'กำหนดชื่อยศ Role ID และราคา ใช้ยอด Wallet Top-up ของบอทเดียวกัน ยศที่ขายเป็นยศถาวร',
 'JSON',true,false,'[]',
 '{"type":"array","maxItems":25,"items":{"type":"object","required":["key","name","roleId","priceSatang"],"properties":{"key":{"type":"string","pattern":"^[a-z0-9_-]{1,40}$"},"name":{"type":"string","minLength":1,"maxLength":100},"roleId":{"type":"string","pattern":"^[0-9]{15,30}$"},"priceSatang":{"type":"integer","minimum":1,"maximum":9007199254740991}}}}',
 '{"control":"role-shop-products"}',20),
('e0800000-0000-0000-0000-000000000002','ROLE_SHOP_NOTIFICATION_CHANNEL_ID','ช่องใบเสร็จซื้อยศ',
 'ไม่บังคับ ช่องแจ้งรายการซื้อยศสำเร็จ','CHANNEL_ID',false,false,NULL,'{}',
 '{"control":"discord-channel","clearable":true}',30);
INSERT INTO shop.feature_presentation_slots (
 feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order
)
SELECT 'e0800000-0000-0000-0000-000000000002',key,label,description,'EMBED',
 ARRAY['member_mention','product_name','role_mention','price','balance','currency','product_lines','transaction_id','transaction_time','failure_reason'],
 jsonb_build_object('mode','EMBED','title',title,'description',body), '{}',sort_order
FROM (VALUES
 ('panel','แผงขายยศ','แสดงรายการยศและปุ่มซื้อ','🏅 ร้านขายยศ',E'{{product_lines}}\n\nใช้ยอดเงินจาก Wallet กดเติมเงินหรือเช็คยอดได้ด้านล่าง',10),
 ('confirmation','ยืนยันซื้อยศ','แสดงราคาและยอดคงเหลือก่อนซื้อ','ยืนยันซื้อยศ',E'ยศ: {{role_mention}}\nราคา: **{{price}} {{currency}}**\nยอดเงินปัจจุบัน: {{balance}} {{currency}}',20),
 ('succeeded','ซื้อยศสำเร็จ','ใบเสร็จหลังมอบยศสำเร็จ','✅ ซื้อยศสำเร็จ',E'{{member_mention}} ได้รับ {{role_mention}}\nราคา: {{price}} {{currency}}\nยอดคงเหลือ: {{balance}} {{currency}}\nรายการ: {{transaction_id}}\n{{transaction_time}}',30),
 ('failed','ซื้อยศไม่สำเร็จ','แสดงสาเหตุเมื่อซื้อยศไม่สำเร็จ','❌ ซื้อยศไม่สำเร็จ','{{failure_reason}}',40)
) AS slots(key,label,description,title,body,sort_order);
