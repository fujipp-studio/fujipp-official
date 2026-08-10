
CREATE TYPE private.robux_payout_status AS ENUM (
    'DEBITED', 'PROCESSING', 'SUCCEEDED', 'REFUNDED', 'REVIEW_REQUIRED'
);

CREATE TABLE private.robux_payout_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots.bot_instances (id) ON DELETE RESTRICT,
    member_discord_id VARCHAR(30) NOT NULL,
    roblox_user_id BIGINT NOT NULL,
    roblox_username VARCHAR(20) NOT NULL,
    group_key VARCHAR(40) NOT NULL,
    group_id BIGINT NOT NULL,
    robux_amount BIGINT NOT NULL,
    price_satang BIGINT NOT NULL,
    status private.robux_payout_status NOT NULL DEFAULT 'DEBITED',
    idempotency_key VARCHAR(120) NOT NULL,
    wallet_debit_entry_id UUID NOT NULL REFERENCES private.member_wallet_entries (id),
    wallet_refund_entry_id UUID REFERENCES private.member_wallet_entries (id),
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code VARCHAR(80),
    error_message VARCHAR(500),
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT robux_payout_job_idempotency_uniq UNIQUE (bot_id, idempotency_key),
    CONSTRAINT robux_payout_member_chk CHECK (member_discord_id ~ '^[0-9]{15,30}$'),
    CONSTRAINT robux_payout_user_chk CHECK (roblox_user_id > 0),
    CONSTRAINT robux_payout_group_chk CHECK (group_id > 0),
    CONSTRAINT robux_payout_amount_chk CHECK (robux_amount > 0 AND price_satang > 0),
    CONSTRAINT robux_payout_result_chk CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX robux_payout_jobs_recovery_idx
    ON private.robux_payout_jobs (bot_id, status, created_at)
    WHERE status IN ('DEBITED', 'PROCESSING');

CREATE TRIGGER robux_payout_jobs_set_updated_at BEFORE UPDATE ON private.robux_payout_jobs
    FOR EACH ROW EXECUTE FUNCTION private.set_store_updated_at();

ALTER TABLE private.robux_payout_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.robux_payout_jobs FROM anon, authenticated;

CREATE FUNCTION private.begin_robux_payout(
    target_bot_id UUID,
    target_member_discord_id TEXT,
    target_roblox_user_id BIGINT,
    target_roblox_username TEXT,
    target_group_key TEXT,
    target_group_id BIGINT,
    target_robux_amount BIGINT,
    target_price_satang BIGINT,
    payout_idempotency_key TEXT
) RETURNS TABLE (job_id UUID, balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    existing private.robux_payout_jobs%ROWTYPE;
    current_balance BIGINT;
    next_balance BIGINT;
    debit_entry UUID;
    new_job UUID;
BEGIN
    IF target_price_satang <= 0 OR target_robux_amount <= 0 THEN
        RAISE EXCEPTION 'invalid Robux payout amount';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(target_bot_id::text || ':' || payout_idempotency_key, 0)
    );
    SELECT * INTO existing FROM private.robux_payout_jobs
     WHERE bot_id=target_bot_id AND idempotency_key=payout_idempotency_key;
    IF FOUND THEN
        IF existing.member_discord_id<>target_member_discord_id
           OR existing.roblox_user_id<>target_roblox_user_id
           OR existing.group_id<>target_group_id
           OR existing.robux_amount<>target_robux_amount
           OR existing.price_satang<>target_price_satang THEN
            RAISE EXCEPTION 'Robux payout idempotency conflict';
        END IF;
        SELECT balance_after_satang INTO current_balance
          FROM private.member_wallet_entries WHERE id=existing.wallet_debit_entry_id;
        RETURN QUERY SELECT existing.id,current_balance,false;
        RETURN;
    END IF;

    INSERT INTO private.member_wallets(bot_id,member_discord_id)
    VALUES(target_bot_id,target_member_discord_id) ON CONFLICT DO NOTHING;
    SELECT balance_satang INTO current_balance FROM private.member_wallets
     WHERE bot_id=target_bot_id AND member_discord_id=target_member_discord_id FOR UPDATE;
    IF current_balance < target_price_satang THEN RAISE EXCEPTION 'insufficient wallet balance'; END IF;
    next_balance := current_balance-target_price_satang;
    UPDATE private.member_wallets SET balance_satang=next_balance
     WHERE bot_id=target_bot_id AND member_discord_id=target_member_discord_id;
    INSERT INTO private.member_wallet_entries(
        bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
        source_reference,idempotency_key,metadata
    ) VALUES(
        target_bot_id,target_member_discord_id,'DEBIT',-target_price_satang,next_balance,
        'ROBUX:'||payout_idempotency_key,'robux-debit:'||payout_idempotency_key,
        pg_catalog.jsonb_build_object('robux',target_robux_amount,'roblox_user_id',target_roblox_user_id,
          'roblox_username',target_roblox_username,'group_id',target_group_id,'group_key',target_group_key)
    ) RETURNING id INTO debit_entry;
    INSERT INTO private.robux_payout_jobs(
        bot_id,member_discord_id,roblox_user_id,roblox_username,group_key,group_id,
        robux_amount,price_satang,idempotency_key,wallet_debit_entry_id
    ) VALUES(
        target_bot_id,target_member_discord_id,target_roblox_user_id,target_roblox_username,
        target_group_key,target_group_id,target_robux_amount,target_price_satang,
        payout_idempotency_key,debit_entry
    ) RETURNING id INTO new_job;
    RETURN QUERY SELECT new_job,next_balance,true;
END $$;

CREATE FUNCTION private.refund_robux_payout(
    target_bot_id UUID, target_job_id UUID, failure_code TEXT, failure_message TEXT
) RETURNS TABLE (balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job private.robux_payout_jobs%ROWTYPE; next_balance BIGINT; refund_entry UUID;
BEGIN
    SELECT * INTO job FROM private.robux_payout_jobs
     WHERE id=target_job_id AND bot_id=target_bot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Robux payout job not found'; END IF;
    IF job.status='REFUNDED' THEN
        SELECT balance_after_satang INTO next_balance FROM private.member_wallet_entries WHERE id=job.wallet_refund_entry_id;
        RETURN QUERY SELECT next_balance,false; RETURN;
    END IF;
    IF job.status NOT IN ('DEBITED','PROCESSING') THEN RAISE EXCEPTION 'Robux payout cannot be refunded'; END IF;
    SELECT balance_satang INTO next_balance FROM private.member_wallets
     WHERE bot_id=target_bot_id AND member_discord_id=job.member_discord_id FOR UPDATE;
    next_balance := next_balance+job.price_satang;
    UPDATE private.member_wallets SET balance_satang=next_balance
     WHERE bot_id=target_bot_id AND member_discord_id=job.member_discord_id;
    INSERT INTO private.member_wallet_entries(
      bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
      source_reference,idempotency_key,metadata
    ) VALUES(
      target_bot_id,job.member_discord_id,'ADJUSTMENT',job.price_satang,next_balance,
      'ROBUX_REFUND:'||job.id,'robux-refund:'||job.id,
      pg_catalog.jsonb_build_object('reason','Roblox payout failed','job_id',job.id,
        'error_code',failure_code,'error_message',failure_message)
    ) RETURNING id INTO refund_entry;
    UPDATE private.robux_payout_jobs SET status='REFUNDED',wallet_refund_entry_id=refund_entry,
      error_code=failure_code,error_message=left(failure_message,500),completed_at=now() WHERE id=job.id;
    RETURN QUERY SELECT next_balance,true;
END $$;

REVOKE ALL ON FUNCTION private.begin_robux_payout(UUID,TEXT,BIGINT,TEXT,TEXT,BIGINT,BIGINT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.refund_robux_payout(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

INSERT INTO shop.feature_products(id,code,name,description,category,icon_key,status,sort_order)
VALUES('e0700000-0000-0000-0000-000000000001','roblox-robux-payout','Roblox Robux Payout',
 'Sell Robux packages from Roblox group funds using the member wallet.','ROBLOX','gamepad-2','DRAFT',140)
ON CONFLICT(code) DO NOTHING;

INSERT INTO shop.feature_versions(id,feature_product_id,version,runtime_key,changelog,status)
SELECT 'e0700000-0000-0000-0000-000000000002',id,'1.0.0','roblox-robux-payout',
 'Wallet-backed package purchase, eligibility checks, queued payouts, refunds, and recovery.','DRAFT'
FROM shop.feature_products WHERE code='roblox-robux-payout'
ON CONFLICT(feature_product_id,version) DO NOTHING;

INSERT INTO shop.feature_actions(action_code,owner_feature_code,label,description) VALUES
 ('robux.buy','roblox-robux-payout','ซื้อ Robux','Open the Robux purchase flow.'),
 ('robux.stock','roblox-robux-payout','ยอด Robux','Refresh group Robux stock.')
ON CONFLICT(action_code) DO NOTHING;

INSERT INTO shop.feature_config_definitions(
 feature_version_id,config_key,label,description,value_type,is_required,is_secret,
 default_value,validation_schema,ui_metadata,sort_order)
SELECT fv.id,c.key,c.label,c.description,c.value_type::shop.feature_config_value_type,
 c.required,c.secret,c.default_value,c.validation,c.ui,c.sort_order
FROM shop.feature_versions fv
CROSS JOIN (VALUES
 ('PANEL_COMMAND_NAME','Panel command','Administrator command used to post the Robux shop panel.','STRING',true,false,'"robux-panel"'::jsonb,'{"pattern":"^[a-z0-9_-]{1,32}$"}'::jsonb,'{"control":"text","prefix":"/"}'::jsonb,10),
 ('ROBUX_ENABLED','Sales enabled','Allow members to start new Robux purchases.','BOOLEAN',true,false,'true'::jsonb,'{}'::jsonb,'{"control":"switch"}'::jsonb,20),
 ('ROBUX_RATE','Robux rate','Robux received per one baht when packages are not configured.','DECIMAL',true,false,'3.5'::jsonb,'{"exclusiveMinimum":0}'::jsonb,'{"control":"number"}'::jsonb,30),
 ('ROBUX_PACKAGES','Robux packages','Optional array of {robux,priceBaht}.','JSON',false,false,'[]'::jsonb,'{"type":"array"}'::jsonb,'{"control":"json"}'::jsonb,40),
 ('ROBUX_PAYOUT_COOLDOWN_SECONDS','Payout cooldown','Delay between queued payouts.','INTEGER',true,false,'5'::jsonb,'{"minimum":0,"maximum":300}'::jsonb,'{"control":"number"}'::jsonb,50),
 ('ROBUX_NOTIFICATION_CHANNEL_ID','Notification channel','Channel receiving payout results.','CHANNEL_ID',false,false,NULL,'{}'::jsonb,'{"control":"discord-channel","clearable":true}'::jsonb,60),
 ('ROBLOX_GROUPS','Roblox groups','Array of {key,name,groupId}. Secrets use matching keys in ROBLOX_CREDENTIALS.','JSON',true,false,NULL,'{"type":"array","minItems":1}'::jsonb,'{"control":"json"}'::jsonb,70),
 ('ROBLOX_CREDENTIALS','Roblox credentials','Secret object keyed by group key with cookie and optional totpSecret.','SECRET',true,true,NULL,'{}'::jsonb,'{"control":"secret"}'::jsonb,80)
) c(key,label,description,value_type,required,secret,default_value,validation,ui,sort_order)
WHERE fv.feature_product_id=(SELECT id FROM shop.feature_products WHERE code='roblox-robux-payout') AND fv.version='1.0.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

INSERT INTO shop.feature_presentation_slots(
 feature_version_id,slot_key,label,description,presentation_type,available_variables,
 default_definition,validation_schema,sort_order)
SELECT fv.id,s.key,s.label,s.description,'COMPONENTS_V2',s.variables,s.definition,'{"type":"object"}'::jsonb,s.sort_order
FROM shop.feature_versions fv
CROSS JOIN (VALUES
 ('panel','Robux shop panel','Public panel with live group stock.',ARRAY['stock_lines'],
  '{"mode":"COMPONENTS_V2","title":"ร้าน Robux","description":"เลือกกลุ่มและกดซื้อ Robux\n\n{{stock_lines}}","actions":["robux.buy"]}'::jsonb,10),
 ('eligibility','Eligibility result','Private result after checking a Roblox username.',ARRAY['roblox_username','group_name'],
  '{"mode":"COMPONENTS_V2","title":"ตรวจสอบสิทธิ์สำเร็จ","description":"ผู้ใช้ **{{roblox_username}}** พร้อมรับ Robux จาก {{group_name}}"}'::jsonb,20),
 ('package_selector','Package selector','Available packages filtered by wallet and group stock.',ARRAY['roblox_username','balance','group_stock','currency'],
  '{"mode":"COMPONENTS_V2","title":"เลือกแพ็กเกจ Robux","description":"บัญชี {{roblox_username}}\nยอดเงิน {{balance}} {{currency}} · Robux ในกลุ่ม {{group_stock}}"}'::jsonb,30),
 ('confirmation','Purchase confirmation','Confirmation shown before wallet debit.',ARRAY['roblox_username','robux','price','balance_after','currency'],
  '{"mode":"COMPONENTS_V2","title":"ยืนยันการซื้อ","description":"รับ {{robux}} Robux ที่ **{{roblox_username}}**\nราคา {{price}} {{currency}}\nคงเหลือ {{balance_after}} {{currency}}"}'::jsonb,40),
 ('processing','Payout processing','Shown after debit while queued for Roblox.',ARRAY['roblox_username','robux'],
  '{"mode":"COMPONENTS_V2","title":"กำลังดำเนินการ","description":"กำลังโอน {{robux}} Robux ไปยัง **{{roblox_username}}**"}'::jsonb,50),
 ('succeeded','Payout succeeded','Successful payout receipt.',ARRAY['roblox_username','robux','price','balance','currency'],
  '{"mode":"COMPONENTS_V2","title":"🟢 ซื้อ Robux สำเร็จ","description":"โอน {{robux}} Robux ให้ **{{roblox_username}}** แล้ว\nชำระ {{price}} {{currency}} · คงเหลือ {{balance}} {{currency}}"}'::jsonb,60),
 ('failed','Payout failed','Failure and refund receipt.',ARRAY['failure_reason','refund','balance','currency'],
  '{"mode":"COMPONENTS_V2","title":"🔴 ซื้อ Robux ไม่สำเร็จ","description":"{{failure_reason}}\nคืนเงิน {{refund}} {{currency}} แล้ว · คงเหลือ {{balance}} {{currency}}"}'::jsonb,70),
 ('notification','Payout audit notification','Private payout result notification.',ARRAY['member_mention','roblox_username','robux','price','status','detail'],
  '{"mode":"COMPONENTS_V2","title":"Robux Payout {{status}}","description":"สมาชิก {{member_mention}}\nRoblox **{{roblox_username}}** · {{robux}} Robux · {{price}} บาท\n{{detail}}"}'::jsonb,80)
) s(key,label,description,variables,definition,sort_order)
WHERE fv.feature_product_id=(SELECT id FROM shop.feature_products WHERE code='roblox-robux-payout') AND fv.version='1.0.0'
ON CONFLICT(feature_version_id,slot_key) DO NOTHING;

COMMENT ON TABLE private.robux_payout_jobs IS
 'Recoverable financial jobs. PROCESSING jobs require manual review after runner restart because Roblox payouts are not idempotent.';

UPDATE shop.feature_presentation_slots s SET default_definition=v.definition,available_variables=v.variables
FROM shop.feature_versions fv
CROSS JOIN (VALUES
 ('panel',ARRAY['stock_lines'],
  '{"color":1579032,"title":"ร้านค้า Robux","description":"เลือกกลุ่มที่ต้องการซื้อจากเมนูด้านล่าง","image":{"url":"https://img5.pic.in.th/file/secure-sv1/robux-groupRate3.5.png"},"components":{"group_select":{"placeholder":"เลือกกลุ่มที่ต้องการซื้อ Robux","emoji":"<:Ts_20_discord_shop:1397694256067514622>"},"btn_topup":{"label":"เติมเงิน","emoji":"<:Ts_0_discord_bank:1398972893416914965>","style":"primary"},"btn_buy":{"label":"ซื้อสินค้า","emoji":"<:Ts_20_discord_shop:1397694256067514622>","style":"danger"},"btn_balance":{"label":"เช็คยอดคงเหลือ","emoji":"<:Ts_19_discord_coin:1397694253676630066>","style":"secondary"}}}'::jsonb),
 ('package_selector',ARRAY['message','username','balance','rate','group_robux','group_name','avatar'],
  '{"color":9107360,"title":"<:Ts_22_discord_1ture:1397892606209429584> สามารถซื้อ Robux ได้แล้ว","description":"> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```{{message}}```\n> <:Ts_9_discord_member:1397694189575344298> : Roblox Username\n```{{username}}```\n> <:Ts_19_discord_coin:1397694253676630066> : ยอดคงเหลือ\n```{{balance}} บาท```\n> <:Ts_19_discord_coin:1397694253676630066> : เรทปัจจุบัน\n```1 บาท = {{rate}} Robux```\n> <:Icon_Square_robux_1:1397902872146083861> : Robux ในกลุ่ม\n```{{group_robux}} R$```\n> <:Ts_7_discord_id:1397694178846310520> : กลุ่มที่เลือก\n```{{group_name}}```","thumbnail":{"url":"{{avatar}}"},"image":{"url":"https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif"},"components":{"pkg_select":{"placeholder":"🎮 เลือก Robux Package","option_label":"{{robux}} Robux ({{price}} บาท)","option_ok":"✅","option_insufficient":"❌ ยอดเงินไม่พอ"}}}'::jsonb),
 ('confirmation',ARRAY['roblox_id','robux','price','balance_after','avatar'],
  '{"color":16247178,"title":"<:Icon_Square_robux_1:1397902872146083861> ยืนยันการซื้อ Robux","description":"> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```ตรวจสอบข้อมูลก่อนยืนยัน```\n> <:Ts_7_discord_id:1397694178846310520> : Roblox ID\n```{{roblox_id}}```\n> <:Ts_12_discord_abane:1397694204863315998> : เงื่อนไขการใช้บริการ\n```เมื่อกดยืนยัน ระบบจะหักเงินและโอน Robux ทันที```","thumbnail":{"url":"{{avatar}}"},"fields":[{"name":"<:Icon_Square_robux_1:1397902872146083861> : Package","value":"```{{robux}}```","inline":true},{"name":"<:Ts_19_discord_coin:1397694253676630066> : ราคา","value":"```{{price}} บาท```","inline":true},{"name":"<:Ts_19_discord_coin:1397694253676630066> : ยอดเงินหลังการซื้อ","value":"```{{balance_after}} บาท```","inline":false}],"components":{"btn_confirm":{"label":"ยืนยัน","style":"success"},"btn_cancel":{"label":"ยกเลิก","style":"danger"}}}'::jsonb),
 ('processing',ARRAY['detail','avatar'],
  '{"color":15902662,"title":"<a:Ts_22_discord_3loading:1397892630729461841> กำลังประมวลผล","description":"\n> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```{{detail}}```","thumbnail":{"url":"{{avatar}}"}}'::jsonb),
 ('succeeded',ARRAY['roblox_id','robux','price','balance','avatar'],
  '{"color":9107360,"title":"<:Ts_22_discord_1ture:1397892606209429584> โอน Robux สำเร็จ","description":"> <:Ts_7_discord_id:1397694178846310520> : Roblox ID\n```{{roblox_id}}```\n> <:Icon_Square_robux_1:1397902872146083861> : Robux\n```{{robux}} R$```\n> <:Ts_19_discord_coin:1397694253676630066> : ราคา\n```{{price}} บาท```\n> <:Ts_19_discord_coin:1397694253676630066> : ยอดคงเหลือ\n```{{balance}} บาท```","thumbnail":{"url":"{{avatar}}"},"image":{"url":"https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif"}}'::jsonb),
 ('failed',ARRAY['reason','username','datetime','avatar','refund','balance'],
  '{"color":16222858,"title":"<:Ts_12_discord_bbane:1397694208969543720> เกิดข้อผิดพลาด","description":"> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```{{reason}}```\n> <:Ts_9_discord_member:1397694189575344298> : Roblox Username\n```{{username}}```\n> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ\n```{{datetime}}```","image":{"url":"https://www.animatedimages.org/data/media/562/animated-line-image-0378.gif"},"thumbnail":{"url":"{{avatar}}"}}'::jsonb)
) v(key,variables,definition)
WHERE s.feature_version_id=fv.id AND fv.feature_product_id=(SELECT id FROM shop.feature_products WHERE code='roblox-robux-payout')
AND fv.version='1.0.0' AND s.slot_key=v.key;

INSERT INTO shop.feature_presentation_slots(feature_version_id,slot_key,label,description,presentation_type,available_variables,default_definition,validation_schema,sort_order)
SELECT fv.id,v.key,v.label,v.description,'EMBED',v.variables,v.definition,'{"type":"object"}'::jsonb,v.sort_order
FROM shop.feature_versions fv CROSS JOIN (VALUES
 ('queued','ซื้อ Robux: เข้าคิวโอน','ข้อความหลังหักเงินสำเร็จระหว่างรอคิวโอน',ARRAY['queue','robux','price','balance','avatar'],
  '{"color":9107360,"title":"<:Ts_22_discord_1ture:1397892606209429584> กำลังดำเนินการ...","description":"> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```หักเงินเรียบร้อย! กำลังโอน Robux... (คิว #{{queue}})```\n> <:Icon_Square_robux_1:1397902872146083861> : Robux\n```{{robux}} R$```\n> <:Ts_19_discord_coin:1397694253676630066> : ราคา\n```{{price}} บาท```\n> <:Ts_19_discord_coin:1397694253676630066> : ยอดคงเหลือ\n```{{balance}} บาท```","thumbnail":{"url":"{{avatar}}"},"image":{"url":"https://www.animatedimages.org/data/media/562/animated-line-image-0388.gif"}}'::jsonb,55),
 ('notification_success','แจ้งเตือน: ทำรายการสำเร็จ','ข้อความแจ้งเตือนเมื่อโอน Robux สำเร็จ',ARRAY['username','roblox_id','robux','price','datetime','avatar'],
  '{"color":15902662,"title":"<:Ts_22_discord_1ture:1397892606209429584> ทำรายการสำเร็จ","description":"> <:Ts_9_discord_member:1397694189575344298> : Discord User ID\n```{{username}}```\n> <:Ts_7_discord_id:1397694178846310520> : Roblox ID\n```{{roblox_id}}```\n> <:Icon_Square_robux_1:1397902872146083861> : Robux\n```{{robux}} R$```\n> <:Ts_19_discord_coin:1397694253676630066> : ราคา\n```{{price}} บาท```\n> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ\n```{{datetime}}```","thumbnail":{"url":"{{avatar}}"},"image":{"url":"https://pixelsafari.neocities.org/dividers/more/cat8.gif"}}'::jsonb,90),
 ('notification_error','แจ้งเตือน: เกิดข้อผิดพลาด','ข้อความแจ้งเตือนเมื่อโอน Robux ไม่สำเร็จ',ARRAY['error','username','roblox_id','datetime','avatar'],
  '{"color":16222858,"title":"<:Ts_12_discord_bbane:1397694208969543720> เกิดข้อผิดพลาด","description":"> <:Ts_4_discord_trade:1397694172416180236> : รายละเอียด\n```{{error}}```\n> <:Ts_9_discord_member:1397694189575344298> : Discord User ID\n```{{username}}```\n> <:Ts_7_discord_id:1397694178846310520> : Roblox ID\n```{{roblox_id}}```\n> <:Ts_10_discord_Clock:1397694191429095675> : วันที่และเวลาทำรายการ\n```{{datetime}}```","thumbnail":{"url":"{{avatar}}"},"image":{"url":"https://www.animatedimages.org/data/media/562/animated-line-image-0378.gif"}}'::jsonb,100)
) v(key,label,description,variables,definition,sort_order)
WHERE fv.feature_product_id=(SELECT id FROM shop.feature_products WHERE code='roblox-robux-payout') AND fv.version='1.0.0'
ON CONFLICT(feature_version_id,slot_key) DO UPDATE SET default_definition=EXCLUDED.default_definition,available_variables=EXCLUDED.available_variables;

UPDATE shop.feature_presentation_slots s
SET available_variables=ARRAY['group_name','group_id','group_robux'],
    default_definition='{
      "mode":"EMBED",
      "title":"Roblox Auto 24 hrs.",
      "image":{"url":""},
      "components_v2":{"title":"Roblox Auto 24 hrs."},
      "components":{
        "group_select":{"placeholder":"เลือกกลุ่มที่ต้องการซื้อ"},
        "btn_topup":{"label":"เติมเงิน","emoji":"💰","style":"success"},
        "btn_balance":{"label":"เช็คยอดเงินคงเหลือ","emoji":"💳","style":"secondary"}
      }
    }'::jsonb,
    presentation_type='EMBED'
FROM shop.feature_versions fv
JOIN shop.feature_products p ON p.id=fv.feature_product_id
WHERE s.feature_version_id=fv.id AND p.code='roblox-robux-payout'
  AND fv.version='1.0.0' AND s.slot_key='panel';

UPDATE shop.feature_presentation_slots AS slot
SET available_variables = template.variables,
    default_definition = template.definition,
    presentation_type = 'EMBED'
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
CROSS JOIN (VALUES
  (
    'failed',
    ARRAY['reason','content','username','datetime','avatar','refund','balance'],
    '{
      "mode":"EMBED",
      "title":"🔴 เกิดข้อผิดพลาด",
      "description":"**รายละเอียด**\n{{reason}}",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🔴 เกิดข้อผิดพลาด",
        "description":"**รายละเอียด**\n{{reason}}"
      }
    }'::jsonb
  ),
  (
    'package_selector',
    ARRAY['roblox_username','usernameRoblox','balance','rate','group_robux','group_name','avatar'],
    '{
      "mode":"EMBED",
      "title":"🟢 สามารถซื้อ Robux ได้แล้ว",
      "description":"**Roblox Username**\n{{roblox_username}}\n\n**ยอดคงเหลือ**\n{{balance}}\n\n**เรทปัจจุบัน**\n1 บาท = {{rate}} Robux\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**Robux ในกลุ่ม**\n{{group_robux}} R$",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🟢 สามารถซื้อ Robux ได้แล้ว",
        "description":"**Roblox Username**\n{{roblox_username}}\n\n**ยอดคงเหลือ**\n{{balance}}\n\n**เรทปัจจุบัน**\n1 บาท = {{rate}} Robux\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**Robux ในกลุ่ม**\n{{group_robux}} R$"
      },
      "components":{
        "pkg_select":{"placeholder":"เลือก Package ที่ต้องการซื้อ"}
      }
    }'::jsonb
  ),
  (
    'confirmation',
    ARRAY['roblox_username','usernameRoblox','roblox_id','idRoblox','robux','price','balance_after','group_name','avatar','currency'],
    '{
      "mode":"EMBED",
      "title":"🟢 ยืนยันการซื้อ Robux",
      "description":"**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**ยอดเงินหลังการซื้อ**\n{{balance_after}} {{currency}}",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🟢 ยืนยันการซื้อ Robux",
        "description":"**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**ยอดเงินหลังการซื้อ**\n{{balance_after}} {{currency}}"
      },
      "components":{
        "btn_confirm":{"label":"ยืนยัน","style":"success"},
        "btn_cancel":{"label":"ยกเลิก","style":"danger"}
      }
    }'::jsonb
  ),
  (
    'succeeded',
    ARRAY['member_mention','roblox_username','usernameRoblox','roblox_id','idRoblox','robux','price','group_name','datetime','avatar','currency'],
    '{
      "mode":"EMBED",
      "title":"🟢 ทำรายการสำเร็จ",
      "description":"**คนทำรายการ**\n{{member_mention}}\n\n**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**วันที่และเวลาทำรายการ**\n{{datetime}}",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🟢 ทำรายการสำเร็จ",
        "description":"**คนทำรายการ**\n{{member_mention}}\n\n**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**วันที่และเวลาทำรายการ**\n{{datetime}}"
      }
    }'::jsonb
  )
) AS template(slot_key, variables, definition)
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = template.slot_key;

UPDATE shop.feature_config_definitions AS definition
SET default_value = '[
  {"robux":200,"priceBaht":58},
  {"robux":300,"priceBaht":86},
  {"robux":350,"priceBaht":100},
  {"robux":400,"priceBaht":115},
  {"robux":500,"priceBaht":143},
  {"robux":600,"priceBaht":172},
  {"robux":800,"priceBaht":229},
  {"robux":1000,"priceBaht":286},
  {"robux":1200,"priceBaht":343},
  {"robux":1400,"priceBaht":400},
  {"robux":1600,"priceBaht":455},
  {"robux":2000,"priceBaht":570},
  {"robux":3000,"priceBaht":855},
  {"robux":4000,"priceBaht":1140},
  {"robux":5000,"priceBaht":1425}
]'::jsonb,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE definition.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND definition.config_key = 'ROBUX_PACKAGES';

UPDATE shop.feature_presentation_slots AS slot
SET available_variables = ARRAY['roblox_username','robux','detail','avatar'],
    default_definition = '{
      "mode":"EMBED",
      "title":"⌛ กำลังทำรายการ",
      "description":"กรุณารอสักครู่",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"⌛ กำลังทำรายการ",
        "description":"กรุณารอสักครู่"
      }
    }'::jsonb,
    presentation_type = 'EMBED',
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = 'processing';

UPDATE shop.feature_config_definitions AS definition
SET default_value = jsonb_build_array(
      jsonb_build_object('robux', 1, 'priceBaht', 1)
    ) || definition.default_value,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE definition.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND definition.config_key = 'ROBUX_PACKAGES'
  AND NOT definition.default_value @> '[{"robux":1}]'::jsonb;

CREATE OR REPLACE FUNCTION private.begin_robux_payout(
    target_bot_id UUID,
    target_member_discord_id TEXT,
    target_roblox_user_id BIGINT,
    target_roblox_username TEXT,
    target_group_key TEXT,
    target_group_id BIGINT,
    target_robux_amount BIGINT,
    target_price_satang BIGINT,
    payout_idempotency_key TEXT
) RETURNS TABLE (job_id UUID, balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    existing private.robux_payout_jobs%ROWTYPE;
    current_balance BIGINT;
    next_balance BIGINT;
    debit_entry UUID;
    new_job UUID;
BEGIN
    IF target_price_satang <= 0 OR target_robux_amount <= 0 THEN
        RAISE EXCEPTION 'invalid Robux payout amount';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(target_bot_id::text || ':' || payout_idempotency_key, 0)
    );
    SELECT * INTO existing FROM private.robux_payout_jobs AS payout_job
     WHERE payout_job.bot_id=target_bot_id
       AND payout_job.idempotency_key=payout_idempotency_key;
    IF FOUND THEN
        IF existing.member_discord_id<>target_member_discord_id
           OR existing.roblox_user_id<>target_roblox_user_id
           OR existing.group_id<>target_group_id
           OR existing.robux_amount<>target_robux_amount
           OR existing.price_satang<>target_price_satang THEN
            RAISE EXCEPTION 'Robux payout idempotency conflict';
        END IF;
        SELECT wallet_entry.balance_after_satang INTO current_balance
          FROM private.member_wallet_entries AS wallet_entry
         WHERE wallet_entry.id=existing.wallet_debit_entry_id;
        RETURN QUERY SELECT existing.id,current_balance,false;
        RETURN;
    END IF;

    INSERT INTO private.member_wallets(bot_id,member_discord_id)
    VALUES(target_bot_id,target_member_discord_id) ON CONFLICT DO NOTHING;
    SELECT wallet.balance_satang INTO current_balance
      FROM private.member_wallets AS wallet
     WHERE wallet.bot_id=target_bot_id
       AND wallet.member_discord_id=target_member_discord_id
     FOR UPDATE;
    IF current_balance < target_price_satang THEN
        RAISE EXCEPTION 'insufficient wallet balance';
    END IF;
    next_balance := current_balance-target_price_satang;
    UPDATE private.member_wallets AS wallet
       SET balance_satang=next_balance
     WHERE wallet.bot_id=target_bot_id
       AND wallet.member_discord_id=target_member_discord_id;
    INSERT INTO private.member_wallet_entries(
        bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
        source_reference,idempotency_key,metadata
    ) VALUES(
        target_bot_id,target_member_discord_id,'DEBIT',-target_price_satang,next_balance,
        'ROBUX:'||payout_idempotency_key,'robux-debit:'||payout_idempotency_key,
        pg_catalog.jsonb_build_object('robux',target_robux_amount,'roblox_user_id',target_roblox_user_id,
          'roblox_username',target_roblox_username,'group_id',target_group_id,'group_key',target_group_key)
    ) RETURNING id INTO debit_entry;
    INSERT INTO private.robux_payout_jobs(
        bot_id,member_discord_id,roblox_user_id,roblox_username,group_key,group_id,
        robux_amount,price_satang,idempotency_key,wallet_debit_entry_id
    ) VALUES(
        target_bot_id,target_member_discord_id,target_roblox_user_id,target_roblox_username,
        target_group_key,target_group_id,target_robux_amount,target_price_satang,
        payout_idempotency_key,debit_entry
    ) RETURNING id INTO new_job;
    RETURN QUERY SELECT new_job,next_balance,true;
END $$;

CREATE OR REPLACE FUNCTION private.refund_robux_payout(
    target_bot_id UUID, target_job_id UUID, failure_code TEXT, failure_message TEXT
) RETURNS TABLE (balance_satang BIGINT, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job private.robux_payout_jobs%ROWTYPE; next_balance BIGINT; refund_entry UUID;
BEGIN
    SELECT * INTO job FROM private.robux_payout_jobs AS payout_job
     WHERE payout_job.id=target_job_id AND payout_job.bot_id=target_bot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Robux payout job not found'; END IF;
    IF job.status='REFUNDED' THEN
        SELECT wallet_entry.balance_after_satang INTO next_balance
          FROM private.member_wallet_entries AS wallet_entry
         WHERE wallet_entry.id=job.wallet_refund_entry_id;
        RETURN QUERY SELECT next_balance,false; RETURN;
    END IF;
    IF job.status NOT IN ('DEBITED','PROCESSING') THEN RAISE EXCEPTION 'Robux payout cannot be refunded'; END IF;
    SELECT wallet.balance_satang INTO next_balance
      FROM private.member_wallets AS wallet
     WHERE wallet.bot_id=target_bot_id AND wallet.member_discord_id=job.member_discord_id FOR UPDATE;
    next_balance := next_balance+job.price_satang;
    UPDATE private.member_wallets AS wallet SET balance_satang=next_balance
     WHERE wallet.bot_id=target_bot_id AND wallet.member_discord_id=job.member_discord_id;
    INSERT INTO private.member_wallet_entries(
      bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
      source_reference,idempotency_key,metadata
    ) VALUES(
      target_bot_id,job.member_discord_id,'ADJUSTMENT',job.price_satang,next_balance,
      'ROBUX_REFUND:'||job.id,'robux-refund:'||job.id,
      pg_catalog.jsonb_build_object('reason','Roblox payout failed','job_id',job.id,
        'error_code',failure_code,'error_message',failure_message)
    ) RETURNING id INTO refund_entry;
    UPDATE private.robux_payout_jobs AS payout_job
       SET status='REFUNDED',wallet_refund_entry_id=refund_entry,
           error_code=failure_code,error_message=left(failure_message,500),completed_at=now()
     WHERE payout_job.id=job.id;
    RETURN QUERY SELECT next_balance,true;
END $$;

REVOKE ALL ON FUNCTION private.begin_robux_payout(UUID,TEXT,BIGINT,TEXT,TEXT,BIGINT,BIGINT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.refund_robux_payout(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;

UPDATE shop.feature_presentation_slots AS slot
SET available_variables = ARRAY['queue','robux','price','balance','avatar'],
    default_definition = '{
      "mode":"EMBED",
      "title":"⌛ กำลังทำรายการ",
      "description":"กรุณารอสักครู่",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"⌛ กำลังทำรายการ",
        "description":"กรุณารอสักครู่"
      }
    }'::jsonb,
    presentation_type = 'EMBED',
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = 'queued';

UPDATE shop.feature_presentation_slots AS slot
SET available_variables = ARRAY[
      'member_mention','username','roblox_username','usernameRoblox',
      'roblox_id','idRoblox','robux','price','group_name','datetime',
      'avatar','currency','status','detail','error','reason'
    ],
    presentation_type = 'EMBED',
    default_definition = $$
    {
      "mode":"EMBED",
      "title":"🟢 ทำรายการสำเร็จ",
      "description":"**คนทำรายการ**\n{{member_mention}}\n\n**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**วันที่และเวลาทำรายการ**\n{{datetime}}",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🟢 ทำรายการสำเร็จ",
        "description":"**คนทำรายการ**\n{{member_mention}}\n\n**Roblox username**\n{{roblox_username}}\n\n**Roblox id**\n{{roblox_id}}\n\n**Package**\n{{robux}} Robux\n\n**ราคา**\n{{price}} {{currency}}\n\n**กลุ่มที่เลือก**\n{{group_name}}\n\n**วันที่และเวลาทำรายการ**\n{{datetime}}"
      }
    }
    $$::jsonb
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = 'notification_success';

UPDATE shop.feature_presentation_slots AS slot
SET available_variables = ARRAY[
      'member_mention','username','roblox_username','usernameRoblox',
      'roblox_id','idRoblox','robux','price','group_name','datetime',
      'avatar','currency','status','detail','error','reason'
    ],
    presentation_type = 'EMBED',
    default_definition = $$
    {
      "mode":"EMBED",
      "title":"🔴 เกิดข้อผิดพลาด",
      "description":"**รายละเอียด**\n{{reason}}",
      "image":{"url":""},
      "thumbnail":{"url":""},
      "components_v2":{
        "title":"🔴 เกิดข้อผิดพลาด",
        "description":"**รายละเอียด**\n{{reason}}"
      }
    }
    $$::jsonb
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE slot.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND slot.slot_key = 'notification_error';

UPDATE shop.feature_config_definitions AS definition
SET default_value = jsonb_build_array(
      jsonb_build_object('robux', 10, 'priceBaht', 3),
      jsonb_build_object('robux', 15, 'priceBaht', 5),
      jsonb_build_object('robux', 20, 'priceBaht', 6)
    ) || definition.default_value,
    updated_at = now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id = version.feature_product_id
WHERE definition.feature_version_id = version.id
  AND product.code = 'roblox-robux-payout'
  AND version.version = '1.0.0'
  AND definition.config_key = 'ROBUX_PACKAGES'
  AND NOT (
    definition.default_value @> '[{"robux":10}]'::jsonb
    AND definition.default_value @> '[{"robux":15}]'::jsonb
    AND definition.default_value @> '[{"robux":20}]'::jsonb
  );

INSERT INTO shop.feature_config_definitions(
  feature_version_id,config_key,label,description,value_type,is_required,is_secret,
  default_value,validation_schema,ui_metadata,sort_order)
SELECT version.id, config.config_key, config.label, config.description,
       config.value_type::shop.feature_config_value_type, false, false,
       NULL, '{}'::jsonb, '{"control":"discord-channel","clearable":true}'::jsonb,
       config.sort_order
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id=version.feature_product_id
CROSS JOIN (VALUES
  ('ROBUX_SUCCESS_NOTIFICATION_CHANNEL_ID','Success notification channel','Channel receiving successful Robux payout receipts.','CHANNEL_ID',61),
  ('ROBUX_ERROR_NOTIFICATION_CHANNEL_ID','Error notification channel','Channel receiving failed or refunded Robux payout receipts.','CHANNEL_ID',62)
) AS config(config_key,label,description,value_type,sort_order)
WHERE product.code='roblox-robux-payout' AND version.version='1.0.0'
ON CONFLICT(feature_version_id,config_key) DO NOTHING;

UPDATE shop.feature_config_definitions AS definition
SET default_value='30'::jsonb,
    description='Delay between queued payouts in seconds. A longer delay reduces Roblox Session challenges.',
    updated_at=now()
FROM shop.feature_versions AS version
JOIN shop.feature_products AS product ON product.id=version.feature_product_id
WHERE definition.feature_version_id=version.id
  AND product.code='roblox-robux-payout'
  AND version.version='1.0.0'
  AND definition.config_key='ROBUX_PAYOUT_COOLDOWN_SECONDS';
