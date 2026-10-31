-- Only new Wallet claims opt in. Historical attempts (including Admin-compensated
-- incidents) must never become automatic credits as a side effect of this migration.
ALTER TABLE private.truemoney_voucher_redemptions
  ADD COLUMN provider_evidence JSONB CHECK (provider_evidence IS NULL OR jsonb_typeof(provider_evidence)='object'),
  ADD COLUMN wallet_flow_version SMALLINT,
  ADD COLUMN wallet_fee_mode TEXT,
  ADD COLUMN wallet_fee_value BIGINT,
  ADD COLUMN wallet_ledger_id UUID REFERENCES private.member_wallet_entries(id),
  ADD COLUMN wallet_settled_at TIMESTAMPTZ,
  ADD CONSTRAINT truemoney_wallet_policy_chk CHECK (
    (wallet_flow_version IS NULL AND wallet_fee_mode IS NULL AND wallet_fee_value IS NULL)
    OR (wallet_flow_version IS NOT NULL AND wallet_flow_version = 2 AND payment_message_id IS NULL
      AND wallet_fee_mode IS NOT NULL AND wallet_fee_mode IN ('FIXED','PERCENT') AND wallet_fee_value IS NOT NULL
      AND wallet_fee_value BETWEEN 0 AND 9007199254740991
      AND (wallet_fee_mode <> 'PERCENT' OR wallet_fee_value <= 100))),
  ADD CONSTRAINT truemoney_wallet_settlement_chk CHECK (
    (wallet_ledger_id IS NULL AND wallet_settled_at IS NULL)
    OR (wallet_ledger_id IS NOT NULL AND wallet_settled_at IS NOT NULL
      AND status='SUCCEEDED' AND payment_message_id IS NULL));

CREATE UNIQUE INDEX truemoney_wallet_ledger_idx
  ON private.truemoney_voucher_redemptions(wallet_ledger_id) WHERE wallet_ledger_id IS NOT NULL;
CREATE UNIQUE INDEX truemoney_wallet_receipt_idx
  ON private.truemoney_voucher_redemptions(upstream_reference)
  WHERE wallet_flow_version=2 AND status='SUCCEEDED';
CREATE INDEX truemoney_wallet_recovery_idx
  ON private.truemoney_voucher_redemptions(completed_at)
  WHERE wallet_flow_version=2 AND status='SUCCEEDED' AND wallet_ledger_id IS NULL;
CREATE INDEX member_wallet_topups_bot_time_idx
  ON private.member_wallet_entries(bot_id,created_at DESC,id DESC) WHERE kind='TOPUP';

CREATE FUNCTION private.settle_truemoney_wallet(target_redemption_id UUID, target_bot_id UUID, target_member_id TEXT)
RETURNS TABLE(entry_id UUID, credited_satang BIGINT, balance_satang BIGINT, created BOOLEAN, completed_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  receipt private.truemoney_voucher_redemptions%ROWTYPE;
  ledger private.member_wallet_entries%ROWTYPE;
  fee BIGINT;
  credit RECORD;
BEGIN
  SELECT * INTO receipt FROM private.truemoney_voucher_redemptions
    WHERE id=target_redemption_id AND bot_id=target_bot_id AND member_discord_id=target_member_id FOR UPDATE;
  IF NOT FOUND OR receipt.status<>'SUCCEEDED' OR receipt.payment_message_id IS NOT NULL THEN
    RAISE EXCEPTION 'verified Wallet receipt required';
  END IF;
  IF receipt.wallet_ledger_id IS NOT NULL THEN
    SELECT * INTO STRICT ledger FROM private.member_wallet_entries
      WHERE id=receipt.wallet_ledger_id AND bot_id=target_bot_id AND member_discord_id=target_member_id;
    RETURN QUERY SELECT ledger.id,ledger.amount_satang,ledger.balance_after_satang,false,ledger.created_at;
    RETURN;
  END IF;
  IF receipt.wallet_flow_version IS NULL THEN
    -- Old successful credits can be read back, but old uncredited attempts require
    -- manual investigation. They may already have an Admin compensating entry.
    SELECT * INTO ledger FROM private.member_wallet_entries
      WHERE bot_id=target_bot_id AND member_discord_id=target_member_id
        AND kind='TOPUP' AND method='TRUEMONEY' AND source_reference=receipt.upstream_reference;
    IF NOT FOUND THEN RAISE EXCEPTION 'LEGACY_REDEMPTION_REVIEW_REQUIRED'; END IF;
    RETURN QUERY SELECT ledger.id,ledger.amount_satang,ledger.balance_after_satang,false,ledger.created_at;
    RETURN;
  END IF;
  fee := CASE WHEN receipt.wallet_fee_mode='PERCENT'
    THEN round(receipt.amount_satang::numeric * receipt.wallet_fee_value / 100)::bigint
    ELSE receipt.wallet_fee_value END;
  IF fee IS NULL OR fee < 0 OR receipt.amount_satang<=fee THEN RAISE EXCEPTION 'invalid Wallet fee snapshot'; END IF;
  SELECT * INTO STRICT credit FROM private.credit_member_wallet(target_bot_id,target_member_id,
    receipt.amount_satang-fee,'TRUEMONEY',receipt.upstream_reference,'truemoney:'||receipt.id,
    jsonb_build_object('provider','TRUEMONEY','redemptionId',receipt.id,
      'grossSatang',receipt.amount_satang,'feeSatang',fee,'flowVersion',2));
  UPDATE private.truemoney_voucher_redemptions SET wallet_ledger_id=credit.entry_id,wallet_settled_at=now()
    WHERE id=receipt.id;
  SELECT * INTO STRICT ledger FROM private.member_wallet_entries WHERE id=credit.entry_id;
  RETURN QUERY SELECT ledger.id,ledger.amount_satang,ledger.balance_after_satang,credit.created,ledger.created_at;
END;
$$;
REVOKE ALL ON FUNCTION private.settle_truemoney_wallet(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fujipp_backend') THEN
    GRANT EXECUTE ON FUNCTION private.settle_truemoney_wallet(UUID,UUID,TEXT) TO fujipp_backend;
  END IF;
END $$;

CREATE FUNCTION private.protect_member_wallet_entry() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Wallet ledger is append-only; use a compensating entry'; END;
$$;
CREATE TRIGGER member_wallet_entries_immutable BEFORE UPDATE OR DELETE ON private.member_wallet_entries
  FOR EACH ROW EXECUTE FUNCTION private.protect_member_wallet_entry();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fujipp_backend') THEN
    REVOKE UPDATE,DELETE,TRUNCATE ON private.member_wallet_entries FROM fujipp_backend;
  END IF;
END $$;
COMMENT ON COLUMN private.truemoney_voucher_redemptions.wallet_flow_version IS
  'Explicit v2 Wallet receipts only. NULL historical rows are never automatically credited.';

CREATE FUNCTION private.protect_truemoney_receipt() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (NEW.bot_id,NEW.member_discord_id,NEW.recipient_phone,NEW.voucher_hash,NEW.request_fingerprint,
      NEW.idempotency_key,NEW.payment_message_id,NEW.expected_amount_satang,NEW.wallet_flow_version,
      NEW.wallet_fee_mode,NEW.wallet_fee_value) IS DISTINCT FROM
     (OLD.bot_id,OLD.member_discord_id,OLD.recipient_phone,OLD.voucher_hash,OLD.request_fingerprint,
      OLD.idempotency_key,OLD.payment_message_id,OLD.expected_amount_satang,OLD.wallet_flow_version,
      OLD.wallet_fee_mode,OLD.wallet_fee_value) THEN RAISE EXCEPTION 'Receipt identity and fee snapshot are immutable'; END IF;
  IF OLD.status='SUCCEEDED' AND (NEW.status,NEW.amount_satang,NEW.upstream_reference,NEW.currency,NEW.issuer,NEW.provider_evidence)
      IS DISTINCT FROM (OLD.status,OLD.amount_satang,OLD.upstream_reference,OLD.currency,OLD.issuer,OLD.provider_evidence) THEN
    RAISE EXCEPTION 'Verified receipt is immutable';
  END IF;
  IF OLD.wallet_ledger_id IS NOT NULL AND (NEW.wallet_ledger_id,NEW.wallet_settled_at)
      IS DISTINCT FROM (OLD.wallet_ledger_id,OLD.wallet_settled_at) THEN RAISE EXCEPTION 'Receipt settlement is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER truemoney_receipt_immutable BEFORE UPDATE ON private.truemoney_voucher_redemptions
  FOR EACH ROW EXECUTE FUNCTION private.protect_truemoney_receipt();
