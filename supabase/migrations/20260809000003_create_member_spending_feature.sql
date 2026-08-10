CREATE TABLE private.member_spending (
    bot_id UUID NOT NULL REFERENCES bots.bot_instances(id) ON DELETE CASCADE,
    member_discord_id VARCHAR(30) NOT NULL,
    amount_satang BIGINT NOT NULL DEFAULT 0 CHECK (amount_satang >= 0),
    tx_count INTEGER NOT NULL DEFAULT 0 CHECK (tx_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bot_id, member_discord_id),
    CONSTRAINT member_spending_discord_id_chk CHECK (member_discord_id ~ '^[0-9]{15,30}$')
);
CREATE INDEX member_spending_rank_idx ON private.member_spending(bot_id,amount_satang DESC,tx_count DESC);
REVOKE ALL ON private.member_spending FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.member_spending TO service_role;

INSERT INTO shop.feature_products(id,code,name,description,category,icon_key,status,sort_order) VALUES
('f1100000-0000-0000-0000-000000000001','member-spending','Member Spending Card',
 'Manual member spending cards with configurable tiers, Top 1/Top 5 roles, and platform or customer-owned PostgreSQL storage.',
 'COMMUNITY','badge-dollar-sign','DRAFT',160);
INSERT INTO shop.feature_versions(id,feature_product_id,version,runtime_key,changelog,status) VALUES
('f1100000-0000-0000-0000-000000000002','f1100000-0000-0000-0000-000000000001','1.0.0','member-spending',
 'Initial manual spending cards, role tiers, leaderboard, and optional customer PostgreSQL storage.','DRAFT');

INSERT INTO shop.feature_config_definitions(feature_version_id,config_key,label,description,value_type,is_required,is_secret,default_value,validation_schema,ui_metadata,sort_order) VALUES
('f1100000-0000-0000-0000-000000000002','SPENDING_DB_USE_OWN','ใช้ Database ของตัวเอง','ปิดเพื่อใช้ Database ของ Fujipp หรือเปิดเพื่อเชื่อม PostgreSQL/Neon/Supabase ของร้าน','BOOLEAN',true,false,'false','{}','{"control":"switch"}',10),
('f1100000-0000-0000-0000-000000000002','SPENDING_DB_URL','PostgreSQL Connection URL','ใช้เฉพาะเมื่อเปิด Database ของตัวเอง ระบบเข้ารหัสค่าและสร้างตาราง shop.member_spending ให้อัตโนมัติ','SECRET',false,true,NULL,'{"pattern":"^postgres(?:ql)?://"}','{"control":"secret","placeholder":"postgresql://..."}',20),
('f1100000-0000-0000-0000-000000000002','SPENDING_FIRST_ROLE_ID','ยศสมาชิกครั้งแรก','ยศที่มอบเมื่อมีการเพิ่มยอดครั้งแรก','ROLE_ID',false,false,NULL,'{"pattern":"^[0-9]{15,30}$"}','{"control":"role-select"}',30),
('f1100000-0000-0000-0000-000000000002','SPENDING_UPGRADE_TIERS','ระดับยอดสะสม','JSON array เช่น [{"amount":1000,"roleId":"..."}] โดย amount เป็นบาท','JSON',false,false,'[]','{"type":"array","items":{"type":"object","required":["amount","roleId"]}}','{"control":"json-editor"}',40),
('f1100000-0000-0000-0000-000000000002','SPENDING_TIER_STACK','สะสมยศทุกระดับ','เปิดเพื่อเก็บยศระดับก่อนหน้า ปิดเพื่อให้เหลือเฉพาะระดับสูงสุด','BOOLEAN',true,false,'true','{}','{"control":"switch"}',50),
('f1100000-0000-0000-0000-000000000002','SPENDING_COUNT_ENABLED','ใช้จำนวนครั้งเลื่อนระดับ','ให้จำนวนครั้งเป็นอีกเงื่อนไขของระดับแรก','BOOLEAN',true,false,'false','{}','{"control":"switch"}',60),
('f1100000-0000-0000-0000-000000000002','SPENDING_UPGRADE_COUNT','จำนวนครั้งที่เลื่อนระดับ','จำนวนครั้งขั้นต่ำสำหรับระดับแรก','INTEGER',true,false,'5','{"minimum":1,"maximum":100000}','{"control":"number"}',70),
('f1100000-0000-0000-0000-000000000002','SPENDING_TOP1_ROLE_ID','ยศ Top 1','ยศสำหรับสมาชิกอันดับหนึ่ง','ROLE_ID',false,false,NULL,'{"pattern":"^[0-9]{15,30}$"}','{"control":"role-select"}',80),
('f1100000-0000-0000-0000-000000000002','SPENDING_TOP5_ROLE_ID','ยศ Top 2–5','ยศสำหรับสมาชิกอันดับสองถึงห้า','ROLE_ID',false,false,NULL,'{"pattern":"^[0-9]{15,30}$"}','{"control":"role-select"}',90);

INSERT INTO shop.feature_presentation_slots(feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order) VALUES
('f1100000-0000-0000-0000-000000000002','first_card','บัตรสะสมครั้งแรก','การ์ดเมื่อเพิ่มสมาชิกครั้งแรก','EMBED',ARRAY['member','member_mention','today','total','count','avatar'],
 '{"mode":"EMBED","embeds":[{"color":16761571,"title":"💗 บัตรสะสมของ {{member}}","description":"ยินดีต้อนรับสมาชิกใหม่ {{member_mention}}\nยอดรอบนี้ **{{today}} บาท**\nยอดสะสม **{{total}} บาท** · **{{count}} ครั้ง**","thumbnail":{"url":"{{avatar}}"}}]}'::jsonb,'{"type":"object"}',10),
('f1100000-0000-0000-0000-000000000002','returning_card','บัตรสะสมครั้งถัดไป','การ์ดเมื่อลูกค้ากลับมาใช้บริการ','COMPONENTS_V2',ARRAY['member','member_mention','today','total','count','avatar'],
 '{"mode":"COMPONENTS_V2","components":[{"type":17,"components":[{"type":10,"content":"## 💗 บัตรสะสมของ {{member}}\nขอบคุณที่กลับมาใช้บริการอีกครั้ง {{member_mention}}"},{"type":14,"divider":true,"spacing":2},{"type":10,"content":"ยอดรอบนี้ **{{today}} บาท**\nยอดสะสมทั้งหมด **{{total}} บาท**\nใช้บริการแล้ว **{{count}} ครั้ง**"}]}]}'::jsonb,'{"type":"object"}',20),
('f1100000-0000-0000-0000-000000000002','leaderboard','อันดับยอดสะสม','รายการอันดับสมาชิก','COMPONENTS_V2',ARRAY['leaderboard_lines','member_count'],
 '{"mode":"COMPONENTS_V2","components":[{"type":17,"components":[{"type":10,"content":"## 🏆 อันดับยอดสะสม\n{{leaderboard_lines}}"},{"type":14,"divider":true,"spacing":1},{"type":10,"content":"สมาชิกในรายการ {{member_count}} คน"}]}]}'::jsonb,'{"type":"object"}',30);
