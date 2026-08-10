
CREATE TYPE private.wallet_entry_kind AS ENUM ('TOPUP', 'DEBIT', 'ADJUSTMENT');
CREATE TYPE private.topup_method AS ENUM ('TRUEMONEY', 'SLIPOK');
CREATE TYPE private.topup_session_status AS ENUM (
    'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED'
);

CREATE TABLE private.member_wallets (
    bot_id UUID NOT NULL REFERENCES bots.bot_instances (id) ON DELETE RESTRICT,
    member_discord_id VARCHAR(30) NOT NULL,
    balance_satang BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bot_id, member_discord_id),
    CONSTRAINT member_wallet_discord_id_chk CHECK (member_discord_id ~ '^[0-9]{15,30}$'),
    CONSTRAINT member_wallet_balance_chk CHECK (balance_satang >= 0)
);

CREATE TABLE private.member_wallet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL,
    member_discord_id VARCHAR(30) NOT NULL,
    kind private.wallet_entry_kind NOT NULL,
    amount_satang BIGINT NOT NULL,
    balance_after_satang BIGINT NOT NULL,
    method private.topup_method,
    source_reference VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (bot_id, member_discord_id)
        REFERENCES private.member_wallets (bot_id, member_discord_id) ON DELETE RESTRICT,
    CONSTRAINT member_wallet_entry_source_key UNIQUE (bot_id, method, source_reference),
    CONSTRAINT member_wallet_entry_idempotency_key UNIQUE (bot_id, idempotency_key),
    CONSTRAINT member_wallet_entry_amount_chk CHECK (amount_satang <> 0),
    CONSTRAINT member_wallet_entry_balance_chk CHECK (balance_after_satang >= 0),
    CONSTRAINT member_wallet_entry_metadata_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE private.topup_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots.bot_instances (id) ON DELETE RESTRICT,
    member_discord_id VARCHAR(30) NOT NULL,
    method private.topup_method NOT NULL,
    requested_satang BIGINT,
    fee_satang BIGINT NOT NULL DEFAULT 0,
    status private.topup_session_status NOT NULL DEFAULT 'PENDING',
    external_reference VARCHAR(255),
    failure_code VARCHAR(80),
    failure_message VARCHAR(500),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT topup_session_member_chk CHECK (member_discord_id ~ '^[0-9]{15,30}$'),
    CONSTRAINT topup_session_amount_chk CHECK (requested_satang IS NULL OR requested_satang > 0),
    CONSTRAINT topup_session_fee_chk CHECK (fee_satang >= 0),
    CONSTRAINT topup_session_expiry_chk CHECK (expires_at > created_at),
    CONSTRAINT topup_session_terminal_chk CHECK (
        (status IN ('PENDING', 'PROCESSING') AND completed_at IS NULL)
        OR (status IN ('SUCCEEDED', 'FAILED', 'EXPIRED') AND completed_at IS NOT NULL)
    )
);

CREATE INDEX member_wallet_entries_history_idx
    ON private.member_wallet_entries (bot_id, member_discord_id, created_at DESC);
CREATE INDEX topup_sessions_pending_idx
    ON private.topup_sessions (expires_at) WHERE status IN ('PENDING', 'PROCESSING');

CREATE TRIGGER member_wallets_set_updated_at BEFORE UPDATE ON private.member_wallets
    FOR EACH ROW EXECUTE FUNCTION private.set_store_updated_at();
CREATE TRIGGER topup_sessions_set_updated_at BEFORE UPDATE ON private.topup_sessions
    FOR EACH ROW EXECUTE FUNCTION private.set_store_updated_at();

CREATE FUNCTION private.credit_member_wallet(
    target_bot_id UUID,
    target_member_discord_id TEXT,
    credit_satang BIGINT,
    credit_method private.topup_method,
    credit_reference TEXT,
    credit_idempotency_key TEXT,
    credit_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (entry_id UUID, balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing private.member_wallet_entries%ROWTYPE;
    next_balance BIGINT;
    new_entry_id UUID;
BEGIN
    IF credit_satang <= 0 THEN RAISE EXCEPTION 'credit amount must be positive'; END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(target_bot_id::text || ':' || credit_method::text || ':' || credit_reference, 0)
    );

    SELECT * INTO existing
      FROM private.member_wallet_entries
     WHERE bot_id = target_bot_id
       AND (idempotency_key = credit_idempotency_key
            OR (method = credit_method AND source_reference = credit_reference))
     LIMIT 1;
    IF FOUND THEN
        IF existing.member_discord_id <> target_member_discord_id
           OR existing.amount_satang <> credit_satang
           OR existing.method <> credit_method
           OR existing.source_reference <> credit_reference THEN
            RAISE EXCEPTION 'wallet credit idempotency conflict';
        END IF;
        RETURN QUERY SELECT existing.id, existing.balance_after_satang, false;
        RETURN;
    END IF;

    INSERT INTO private.member_wallets (bot_id, member_discord_id)
    VALUES (target_bot_id, target_member_discord_id)
    ON CONFLICT DO NOTHING;

    SELECT wallet.balance_satang INTO next_balance
      FROM private.member_wallets AS wallet
     WHERE wallet.bot_id = target_bot_id
       AND wallet.member_discord_id = target_member_discord_id
     FOR UPDATE;
    next_balance := next_balance + credit_satang;

    UPDATE private.member_wallets
       SET balance_satang = next_balance
     WHERE bot_id = target_bot_id AND member_discord_id = target_member_discord_id;

    INSERT INTO private.member_wallet_entries (
        bot_id, member_discord_id, kind, amount_satang, balance_after_satang,
        method, source_reference, idempotency_key, metadata
    ) VALUES (
        target_bot_id, target_member_discord_id, 'TOPUP', credit_satang, next_balance,
        credit_method, credit_reference, credit_idempotency_key, credit_metadata
    ) RETURNING id INTO new_entry_id;

    RETURN QUERY SELECT new_entry_id, next_balance, true;
END;
$$;

REVOKE ALL ON FUNCTION private.credit_member_wallet(UUID, TEXT, BIGINT, private.topup_method, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;

ALTER TABLE private.member_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.member_wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.topup_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.member_wallets, private.member_wallet_entries, private.topup_sessions
    FROM anon, authenticated;

CREATE TABLE shop.feature_actions (
    action_code VARCHAR(100) PRIMARY KEY,
    owner_feature_code VARCHAR(80) NOT NULL REFERENCES shop.feature_products (code),
    label VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    available_variables TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feature_actions_code_chk CHECK (action_code ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$')
);

INSERT INTO shop.feature_products (
    id, code, name, description, category, icon_key, status, sort_order
) VALUES (
    'e0600000-0000-0000-0000-000000000001', 'wallet-topup', 'Wallet Top-up',
    'Member wallet top-ups through PromptPay with SlipOK and TrueMoney gift vouchers.',
    'PAYMENTS', 'wallet-cards', 'DRAFT', 130
) ON CONFLICT (code) DO NOTHING;

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, changelog, status
)
SELECT 'e0600000-0000-0000-0000-000000000002', id, '1.0.0', 'wallet-topup',
       'Initial wallet, reusable actions, SlipOK and TrueMoney top-up flows.', 'DRAFT'
  FROM shop.feature_products WHERE code = 'wallet-topup'
ON CONFLICT (feature_product_id, version) DO NOTHING;

INSERT INTO shop.feature_actions (action_code, owner_feature_code, label, description) VALUES
    ('wallet.topup', 'wallet-topup', 'เติมเงิน', 'Open the configured top-up method selector.'),
    ('wallet.balance', 'wallet-topup', 'เช็คยอดเงินคงเหลือ', 'Show the current member wallet balance.'),
    ('wallet.promptpay', 'wallet-topup', 'พร้อมเพย์ธนาคาร', 'Start a five-minute PromptPay session.'),
    ('wallet.truemoney', 'wallet-topup', 'ซองอั่งเปาทรูมันนี่', 'Open the TrueMoney voucher form.')
ON CONFLICT (action_code) DO NOTHING;

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, config.key, config.label, config.description,
       config.value_type::shop.feature_config_value_type, config.required,
       config.secret, config.default_value, config.validation, config.ui, config.sort_order
  FROM shop.feature_versions AS version
  CROSS JOIN (VALUES
    ('PANEL_COMMAND_NAME','Panel command','Administrator command used to post the wallet panel.','STRING',true,false,'"wallet-panel"'::jsonb,'{"pattern":"^[a-z0-9_-]{1,32}$"}'::jsonb,'{"control":"text","prefix":"/"}'::jsonb,10),
    ('MIN_TOPUP_SATANG','Minimum top-up','Minimum accepted amount in satang.','INTEGER',true,false,'1000'::jsonb,'{"minimum":1}'::jsonb,'{"control":"money-satang"}'::jsonb,20),
    ('TRUEMONEY_FEE_SATANG','TrueMoney fee','Fee deducted from a successful voucher in satang.','INTEGER',true,false,'500'::jsonb,'{"minimum":0}'::jsonb,'{"control":"money-satang"}'::jsonb,30),
    ('TRUEMONEY_PHONE','TrueMoney phone','Recipient phone used by the Voucher API.','STRING',true,false,NULL,'{"pattern":"^0[0-9]{8,9}$"}'::jsonb,'{"control":"text"}'::jsonb,40),
    ('PROMPTPAY_ID','PromptPay ID','Phone or national ID used to generate the QR.','STRING',true,false,NULL,'{"pattern":"^[0-9]{10,13}$"}'::jsonb,'{"control":"text"}'::jsonb,50),
    ('PROMPTPAY_ACCOUNT_NAME','PromptPay account name','Account name displayed beside the QR.','STRING',true,false,NULL,'{"minLength":1,"maxLength":120}'::jsonb,'{"control":"text"}'::jsonb,60),
    ('SLIPOK_BRANCH_ID','SlipOK branch ID','Branch ID from SlipOK.','SECRET',true,true,NULL,'{}'::jsonb,'{"control":"secret"}'::jsonb,70),
    ('SLIPOK_API_KEY','SlipOK API key','API key sent as x-authorization.','SECRET',true,true,NULL,'{}'::jsonb,'{"control":"secret"}'::jsonb,80)
  ) AS config(key,label,description,value_type,required,secret,default_value,validation,ui,sort_order)
 WHERE version.feature_product_id = (SELECT id FROM shop.feature_products WHERE code='wallet-topup')
   AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id, slot.key, slot.label, slot.description, 'COMPONENTS_V2',
       slot.variables, slot.definition, '{"type":"object"}'::jsonb, slot.sort_order
  FROM shop.feature_versions AS version
  CROSS JOIN (VALUES
    ('panel','Wallet panel','Main wallet panel posted by an administrator.',ARRAY['member_mention'],
     '{"mode":"COMPONENTS_V2","title":"เติมเงินเข้ากระเป๋า","description":"กดปุ่ม เติมเงิน ด้านล่างเพื่อเลือกช่องทางและเติมเงินเข้ากระเป๋าเงินของคุณ","image_url":"","actions":["wallet.topup","wallet.balance"]}'::jsonb,10),
    ('balance','Wallet balance','Private member balance response.',ARRAY['member_mention','member_avatar_url','balance','currency'],
     '{"mode":"COMPONENTS_V2","title":"💳 เงินในบัญชีของคุณ","description":"# ยอดคงเหลือ {{balance}} {{currency}}","thumbnail_url":"{{member_avatar_url}}","image_url":""}'::jsonb,20),
    ('method_selector','Top-up methods','Private selector for enabled payment methods.',ARRAY['truemoney_fee','minimum_amount'],
     '{"mode":"COMPONENTS_V2","title":"เลือกช่องทางเติมเงิน","description":"**🔻 อ่านก่อนเติม**\nเติมผ่านซองอั่งเปาทรูมันนี่หักค่าธรรมเนียม {{truemoney_fee}} บาท","actions":["wallet.promptpay","wallet.truemoney"]}'::jsonb,30),
    ('minimum_warning','Minimum warning','Shown when the requested or net amount is too low.',ARRAY['minimum_amount'],
     '{"mode":"COMPONENTS_V2","title":"⚠️ แจ้งเตือน","description":"ต้องเติมขั้นต่ำ {{minimum_amount}} บาท","actions":["wallet.topup"]}'::jsonb,40),
    ('promptpay_qr','PromptPay QR','Five-minute PromptPay payment request.',ARRAY['amount','currency','account_name','remaining_time','qr_url','session_id'],
     '{"mode":"COMPONENTS_V2","title":"🏦 เติมเงินผ่านพร้อมเพย์","description":"จำนวนเงินที่ต้องชำระ {{amount}} {{currency}}\n-# **👤 ชื่อบัญชี** {{account_name}}\n-# **⏰ เหลือเวลาอีก** {{remaining_time}}","image_url":"{{qr_url}}","footer":"ใช้ /topup-slip session:{{session_id}} slip:<ไฟล์>"}'::jsonb,50),
    ('expired','Payment expired','Shown after the five-minute payment window.',ARRAY['session_id'],
     '{"mode":"COMPONENTS_V2","title":"🔴 เกินเวลาที่กำหนด","description":"**📋 รายละเอียด**\nหากทำรายการไม่ทัน ให้กดทำรายการใหม่อีกครั้ง"}'::jsonb,60),
    ('processing','Processing slip','Shown while SlipOK is verifying.',ARRAY['payment_method'],
     '{"mode":"COMPONENTS_V2","title":"⌛️ กำลังประมวลผล","description":"**📋 รายละเอียด**\nกำลังตรวจสอบสลิป กรุณารอสักครู่"}'::jsonb,70),
    ('failed','Top-up failed','Safe failure response.',ARRAY['failure_reason','failure_code'],
     '{"mode":"COMPONENTS_V2","title":"🔴 เติมเงินไม่สำเร็จ","description":"**📋 รายละเอียด**\n{{failure_reason}}"}'::jsonb,80),
    ('succeeded','Top-up succeeded','Successful settlement receipt.',ARRAY['member_mention','amount','balance','currency','payment_method','transaction_time'],
     '{"mode":"COMPONENTS_V2","title":"🟢 เติมเงินสำเร็จ","description":"**👤 คนทำรายการ**\n{{member_mention}}\n\n**💰 จำนวนเงินที่เติม**\n{{amount}} {{currency}}\n\n**🏧 ยอดทั้งหมดที่มี**\n{{balance}} {{currency}}\n\n**🏦 ช่องทางการเติม**\n{{payment_method}}\n\n**🕑 วันที่และเวลาทำรายการ**\n{{transaction_time}}"}'::jsonb,90)
  ) AS slot(key,label,description,variables,definition,sort_order)
 WHERE version.feature_product_id = (SELECT id FROM shop.feature_products WHERE code='wallet-topup')
   AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, slot_key) DO NOTHING;

COMMENT ON TABLE shop.feature_actions IS
    'Stable reusable actions that any feature presentation may reference.';
COMMENT ON TABLE private.member_wallet_entries IS
    'Append-only per-bot member wallet ledger; corrections use compensating entries.';

CREATE OR REPLACE FUNCTION private.credit_member_wallet(
    target_bot_id UUID, target_member_discord_id TEXT, credit_satang BIGINT,
    credit_method private.topup_method, credit_reference TEXT,
    credit_idempotency_key TEXT, credit_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (entry_id UUID, balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    existing private.member_wallet_entries%ROWTYPE;
    next_balance BIGINT;
    new_entry_id UUID;
BEGIN
    IF credit_satang <= 0 THEN RAISE EXCEPTION 'credit amount must be positive'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(target_bot_id::text || ':' || credit_method::text || ':' || credit_reference, 0)
    );

    SELECT * INTO existing FROM private.member_wallet_entries
     WHERE bot_id=target_bot_id AND (idempotency_key=credit_idempotency_key
        OR (method=credit_method AND source_reference=credit_reference)) LIMIT 1;
    IF FOUND THEN
        IF existing.member_discord_id<>target_member_discord_id
           OR existing.amount_satang<>credit_satang OR existing.method<>credit_method
           OR existing.source_reference<>credit_reference THEN
            RAISE EXCEPTION 'wallet credit idempotency conflict';
        END IF;
        RETURN QUERY SELECT existing.id,existing.balance_after_satang,false;
        RETURN;
    END IF;

    INSERT INTO private.member_wallets(bot_id,member_discord_id)
    VALUES(target_bot_id,target_member_discord_id) ON CONFLICT DO NOTHING;
    SELECT w.balance_satang INTO next_balance FROM private.member_wallets w
     WHERE w.bot_id=target_bot_id AND w.member_discord_id=target_member_discord_id FOR UPDATE;
    next_balance:=next_balance+credit_satang;
    UPDATE private.member_wallets SET balance_satang=next_balance
     WHERE bot_id=target_bot_id AND member_discord_id=target_member_discord_id;
    INSERT INTO private.member_wallet_entries(
      bot_id,member_discord_id,kind,amount_satang,balance_after_satang,method,
      source_reference,idempotency_key,metadata
    ) VALUES(target_bot_id,target_member_discord_id,'TOPUP',credit_satang,next_balance,
      credit_method,credit_reference,credit_idempotency_key,credit_metadata)
    RETURNING id INTO new_entry_id;
    RETURN QUERY SELECT new_entry_id,next_balance,true;
END;
$$;

REVOKE ALL ON FUNCTION private.credit_member_wallet(
    UUID,TEXT,BIGINT,private.topup_method,TEXT,TEXT,JSONB
) FROM PUBLIC,anon,authenticated;

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT version.id, config.key, config.label, config.description,
       config.value_type::shop.feature_config_value_type, config.required,
       false, NULL, '{}'::jsonb, config.ui, config.sort_order
  FROM shop.feature_versions AS version
  CROSS JOIN (VALUES
    ('SLIP_CHANNEL_ID','Slip channel','Channel where members submit PromptPay slips.','CHANNEL_ID',true,'{"control":"discord-channel"}'::jsonb,90),
    ('SLIP_SUBMITTER_ROLE_ID','Slip submitter role','Only members with this role may submit slips.','ROLE_ID',true,'{"control":"discord-role"}'::jsonb,100),
    ('TOPUP_NOTIFICATION_CHANNEL_ID','Top-up notification channel','Private channel receiving successful top-up and adjustment notifications.','CHANNEL_ID',true,'{"control":"discord-channel"}'::jsonb,110),
    ('WALLET_ADMIN_ROLE_ID','Wallet administrator role','Optional role allowed to inspect and adjust member balances. Server administrators are always allowed.','ROLE_ID',false,'{"control":"discord-role","clearable":true}'::jsonb,120)
  ) AS config(key,label,description,value_type,required,ui,sort_order)
 WHERE version.feature_product_id = (SELECT id FROM shop.feature_products WHERE code='wallet-topup')
   AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;

INSERT INTO shop.feature_presentation_slots (
    feature_version_id, slot_key, label, description, presentation_type,
    available_variables, default_definition, validation_schema, sort_order
)
SELECT version.id, 'admin_notification', 'Wallet audit notification',
       'Sent to the configured notification channel after a top-up or administrator adjustment.',
       'COMPONENTS_V2',
       ARRAY['member_mention','amount','balance','currency','payment_method','transaction_time','actor_mention','reason','operation'],
       '{"mode":"COMPONENTS_V2","title":"💰 รายการกระเป๋าเงิน","description":"**สมาชิก** {{member_mention}}\n**รายการ** {{operation}}\n**จำนวน** {{amount}} {{currency}}\n**ยอดคงเหลือ** {{balance}} {{currency}}\n**ช่องทาง** {{payment_method}}\n**ผู้ดำเนินการ** {{actor_mention}}\n**เหตุผล** {{reason}}\n**เวลา** {{transaction_time}}"}'::jsonb,
       '{"type":"object"}'::jsonb, 100
  FROM shop.feature_versions AS version
 WHERE version.feature_product_id = (SELECT id FROM shop.feature_products WHERE code='wallet-topup')
   AND version.version = '1.0.0'
ON CONFLICT (feature_version_id, slot_key) DO NOTHING;

CREATE FUNCTION private.adjust_member_wallet(
    target_bot_id UUID,
    target_member_discord_id TEXT,
    adjustment_operation TEXT,
    adjustment_value_satang BIGINT,
    actor_discord_id TEXT,
    adjustment_reason TEXT,
    adjustment_idempotency_key TEXT
) RETURNS TABLE (entry_id UUID, amount_satang BIGINT, balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing private.member_wallet_entries%ROWTYPE;
    current_balance BIGINT;
    delta BIGINT;
    next_balance BIGINT;
    new_entry_id UUID;
    source_ref TEXT := 'ADMIN:' || adjustment_idempotency_key;
BEGIN
    IF adjustment_operation NOT IN ('ADD','REMOVE','SET') THEN
        RAISE EXCEPTION 'invalid wallet adjustment operation';
    END IF;
    IF adjustment_value_satang < 0 OR
       (adjustment_operation IN ('ADD','REMOVE') AND adjustment_value_satang = 0) THEN
        RAISE EXCEPTION 'invalid wallet adjustment amount';
    END IF;
    IF actor_discord_id !~ '^[0-9]{15,30}$' OR target_member_discord_id !~ '^[0-9]{15,30}$' THEN
        RAISE EXCEPTION 'invalid Discord user ID';
    END IF;
    IF length(adjustment_reason) NOT BETWEEN 1 AND 300 THEN
        RAISE EXCEPTION 'adjustment reason is required';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(target_bot_id::text || ':' || adjustment_idempotency_key, 0)
    );

    SELECT * INTO existing
      FROM private.member_wallet_entries
     WHERE bot_id = target_bot_id AND idempotency_key = adjustment_idempotency_key
     LIMIT 1;
    IF FOUND THEN
        IF existing.member_discord_id <> target_member_discord_id
           OR existing.source_reference <> source_ref
           OR existing.metadata ->> 'operation' <> adjustment_operation
           OR (existing.metadata ->> 'value_satang')::bigint <> adjustment_value_satang
           OR existing.metadata ->> 'actor_discord_id' <> actor_discord_id
           OR existing.metadata ->> 'reason' <> adjustment_reason THEN
            RAISE EXCEPTION 'wallet adjustment idempotency conflict';
        END IF;
        RETURN QUERY SELECT existing.id, existing.amount_satang,
                            existing.balance_after_satang, false;
        RETURN;
    END IF;

    INSERT INTO private.member_wallets (bot_id, member_discord_id)
    VALUES (target_bot_id, target_member_discord_id)
    ON CONFLICT DO NOTHING;

    SELECT wallet.balance_satang INTO current_balance
      FROM private.member_wallets AS wallet
     WHERE wallet.bot_id = target_bot_id
       AND wallet.member_discord_id = target_member_discord_id
     FOR UPDATE;

    delta := CASE adjustment_operation
        WHEN 'ADD' THEN adjustment_value_satang
        WHEN 'REMOVE' THEN -adjustment_value_satang
        ELSE adjustment_value_satang - current_balance
    END;
    next_balance := current_balance + delta;
    IF delta = 0 THEN RAISE EXCEPTION 'wallet balance is already at requested value'; END IF;
    IF next_balance < 0 THEN RAISE EXCEPTION 'wallet balance cannot be negative'; END IF;

    UPDATE private.member_wallets SET balance_satang = next_balance
     WHERE bot_id = target_bot_id AND member_discord_id = target_member_discord_id;

    INSERT INTO private.member_wallet_entries (
        bot_id, member_discord_id, kind, amount_satang, balance_after_satang,
        method, source_reference, idempotency_key, metadata
    ) VALUES (
        target_bot_id, target_member_discord_id, 'ADJUSTMENT', delta, next_balance,
        NULL, source_ref, adjustment_idempotency_key,
        jsonb_build_object('operation',adjustment_operation,'value_satang',adjustment_value_satang,
                           'actor_discord_id',actor_discord_id,'reason',adjustment_reason)
    ) RETURNING id INTO new_entry_id;

    RETURN QUERY SELECT new_entry_id, delta, next_balance, true;
END;
$$;

REVOKE ALL ON FUNCTION private.adjust_member_wallet(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;

UPDATE shop.feature_config_definitions d
   SET label='PromptPay minimum top-up',
       description='Minimum PromptPay amount accepted, in satang.'
  FROM shop.feature_versions fv, shop.feature_products p
 WHERE d.feature_version_id=fv.id AND fv.feature_product_id=p.id
   AND p.code='wallet-topup' AND fv.version='1.0.0'
   AND d.config_key='MIN_TOPUP_SATANG';

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT fv.id,c.key,c.label,c.description,c.value_type::shop.feature_config_value_type,
       true,false,c.default_value,c.validation,c.ui,c.sort_order
  FROM shop.feature_versions fv
  JOIN shop.feature_products p ON p.id=fv.feature_product_id
  CROSS JOIN (VALUES
    ('TRUEMONEY_FEE_MODE','TrueMoney fee mode','Choose a fixed THB fee or a percentage of the voucher amount.','STRING','"FIXED"'::jsonb,'{"enum":["FIXED","PERCENT"]}'::jsonb,'{"control":"select"}'::jsonb,31),
    ('TRUEMONEY_FEE_PERCENT','TrueMoney percentage fee','Percentage deducted when fee mode is PERCENT.','INTEGER','0'::jsonb,'{"minimum":0,"maximum":100}'::jsonb,'{"control":"number","suffix":"%"}'::jsonb,32)
  ) c(key,label,description,value_type,default_value,validation,ui,sort_order)
 WHERE p.code='wallet-topup' AND fv.version='1.0.0'
ON CONFLICT (feature_version_id,config_key) DO NOTHING;

UPDATE shop.feature_presentation_slots slot
   SET available_variables=array_append(slot.available_variables,'slip_channel_url'),
       default_definition=jsonb_set(
           slot.default_definition,
           '{links}',
           '[{"label":"โอนแล้วแนบสลิปที่นี่","emoji":"📎","url":"{{slip_channel_url}}"}]'::jsonb,
           true
       )
  FROM shop.feature_versions fv, shop.feature_products p
 WHERE slot.feature_version_id=fv.id AND fv.feature_product_id=p.id
   AND p.code='wallet-topup' AND fv.version='1.0.0'
   AND slot.slot_key='promptpay_qr'
   AND NOT (slot.available_variables @> ARRAY['slip_channel_url']);

UPDATE shop.feature_presentation_slots slot
   SET default_definition=jsonb_set(
       slot.default_definition,'{description}',
       to_jsonb(replace(slot.default_definition ->> 'description','{{truemoney_fee}} บาท','{{truemoney_fee}}'))
   )
  FROM shop.feature_versions fv, shop.feature_products p
 WHERE slot.feature_version_id=fv.id AND fv.feature_product_id=p.id
   AND p.code='wallet-topup' AND fv.version='1.0.0'
   AND slot.slot_key='method_selector';

INSERT INTO shop.feature_config_definitions (
    feature_version_id,config_key,label,description,value_type,is_required,is_secret,
    default_value,validation_schema,ui_metadata,sort_order
)
SELECT fv.id,c.key,c.label,c.description,c.value_type::shop.feature_config_value_type,
       c.required,false,c.default_value,c.validation,c.ui,c.sort_order
  FROM shop.feature_versions fv
  JOIN shop.feature_products p ON p.id=fv.feature_product_id
  CROSS JOIN (VALUES
    ('TOPUP_MEMBER_ROLE_ID','Top-up member role','Optional permanent role granted after a successful top-up.','ROLE_ID',false,NULL,'{}'::jsonb,'{"control":"discord-role","clearable":true}'::jsonb,130),
    ('WALLET_HISTORY_DEFAULT_LIMIT','History default limit','Default number of ledger rows shown by /history.','INTEGER',true,'10'::jsonb,'{"minimum":1,"maximum":50}'::jsonb,'{"control":"number"}'::jsonb,140),
    ('TOP_SPENDER_TOP1_ROLE_ID','Top spender #1 role','Optional role for the lifetime top-up leader.','ROLE_ID',false,NULL,'{}'::jsonb,'{"control":"discord-role","clearable":true}'::jsonb,150),
    ('TOP_SPENDER_TOP10_ROLE_ID','Top spender top 10 role','Optional role for lifetime ranks 1–10.','ROLE_ID',false,NULL,'{}'::jsonb,'{"control":"discord-role","clearable":true}'::jsonb,160),
    ('TOP_SPENDER_MILESTONE_ROLES','Top spender milestones','JSON array of {thresholdBaht,roleId}.','JSON',false,'[]'::jsonb,'{"type":"array"}'::jsonb,'{"control":"json"}'::jsonb,170),
    ('TOP_SPENDER_LEADERBOARD_CHANNEL_ID','Leaderboard channel','Optional channel receiving the public Top 10 board.','CHANNEL_ID',false,NULL,'{}'::jsonb,'{"control":"discord-channel","clearable":true}'::jsonb,180)
  ) c(key,label,description,value_type,required,default_value,validation,ui,sort_order)
 WHERE p.code='wallet-topup' AND fv.version='1.0.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

INSERT INTO shop.feature_presentation_slots (
    feature_version_id,slot_key,label,description,presentation_type,
    available_variables,default_definition,validation_schema,sort_order
)
SELECT fv.id,s.key,s.label,s.description,'COMPONENTS_V2',s.variables,s.definition,
       '{"type":"object"}'::jsonb,s.sort_order
  FROM shop.feature_versions fv
  JOIN shop.feature_products p ON p.id=fv.feature_product_id
  CROSS JOIN (VALUES
    ('history','Wallet history','Administrator wallet ledger response.',ARRAY['member_mention','entry_count','history_lines','total','currency'],
     '{"mode":"COMPONENTS_V2","title":"📜 ประวัติกระเป๋าเงิน","description":"**สมาชิก** {{member_mention}}\n**ล่าสุด {{entry_count}} รายการ**\n{{history_lines}}\n\n**รวมการเปลี่ยนแปลง** {{total}} {{currency}}"}'::jsonb,110),
    ('monthly_summary','Monthly top-up summary','One-month member or shop top-up summary.',ARRAY['member_mention','amount','entry_count','member_count','currency'],
     '{"mode":"COMPONENTS_V2","title":"📅 สรุปยอดเติมเงิน 1 เดือน","description":"**สมาชิก** {{member_mention}}\n**ยอดเติมรวม** {{amount}} {{currency}}\n**จำนวนรายการ** {{entry_count}}\n**สมาชิกทั้งหมด** {{member_count}}"}'::jsonb,120),
    ('leaderboard','Top spender leaderboard','Lifetime top-up Top 10 and role sync result.',ARRAY['leaderboard_lines','updated_count','error_lines'],
     '{"mode":"COMPONENTS_V2","title":"🏆 อันดับผู้เติมเงินสูงสุด","description":"{{leaderboard_lines}}\n\nอัปเดตยศ {{updated_count}} คน\n{{error_lines}}"}'::jsonb,130)
  ) s(key,label,description,variables,definition,sort_order)
 WHERE p.code='wallet-topup' AND fv.version='1.0.0'
ON CONFLICT(feature_version_id,slot_key) DO NOTHING;

INSERT INTO shop.feature_config_definitions (
    feature_version_id, config_key, label, description, value_type, is_required,
    is_secret, default_value, validation_schema, ui_metadata, sort_order
)
SELECT fv.id,
       'PROMPTPAY_QR_EXPIRY_MINUTES',
       'PromptPay QR lifetime',
       'Minutes before a PromptPay QR and its temporary slip access expire.',
       'INTEGER'::shop.feature_config_value_type,
       true,
       false,
       '5'::jsonb,
       '{"minimum":1,"maximum":60}'::jsonb,
       '{"control":"number","suffix":"minutes"}'::jsonb,
       61
  FROM shop.feature_versions fv
  JOIN shop.feature_products p ON p.id = fv.feature_product_id
 WHERE p.code = 'wallet-topup'
   AND fv.version = '1.0.0'
ON CONFLICT (feature_version_id, config_key) DO NOTHING;
