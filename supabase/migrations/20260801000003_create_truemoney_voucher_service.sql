
CREATE TYPE private.voucher_redemption_status AS ENUM (
    'REDEEMING',
    'VERIFY_FAILED',
    'REDEEM_FAILED',
    'RECONCILIATION_REQUIRED',
    'SUCCEEDED'
);

CREATE TABLE private.truemoney_voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL
        REFERENCES bots.bot_instances (id) ON DELETE RESTRICT,
    member_discord_id VARCHAR(30) NOT NULL,
    recipient_phone VARCHAR(10) NOT NULL,
    voucher_hash CHAR(64) NOT NULL UNIQUE,
    request_fingerprint CHAR(64) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    status private.voucher_redemption_status NOT NULL DEFAULT 'REDEEMING',
    amount_satang BIGINT,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    issuer VARCHAR(255),
    upstream_reference VARCHAR(255),
    failure_code VARCHAR(80),
    failure_message VARCHAR(500),
    processing_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT truemoney_voucher_bot_idempotency_key
        UNIQUE (bot_id, idempotency_key),
    CONSTRAINT truemoney_voucher_member_format_chk CHECK (
        member_discord_id ~ '^[0-9]{15,30}$'
    ),
    CONSTRAINT truemoney_voucher_phone_format_chk CHECK (
        recipient_phone ~ '^0[0-9]{8,9}$'
    ),
    CONSTRAINT truemoney_voucher_hash_format_chk CHECK (
        voucher_hash ~ '^[0-9a-f]{64}$'
        AND request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT truemoney_voucher_idempotency_format_chk CHECK (
        idempotency_key ~ '^[A-Za-z0-9._:-]{8,100}$'
    ),
    CONSTRAINT truemoney_voucher_currency_chk CHECK (currency = 'THB'),
    CONSTRAINT truemoney_voucher_outcome_chk CHECK (
        (
            status = 'REDEEMING'
            AND amount_satang IS NULL
            AND completed_at IS NULL
            AND failure_code IS NULL
        )
        OR (
            status = 'SUCCEEDED'
            AND amount_satang > 0
            AND completed_at IS NOT NULL
            AND failure_code IS NULL
            AND upstream_reference IS NOT NULL
        )
        OR (
            status IN ('VERIFY_FAILED', 'REDEEM_FAILED', 'RECONCILIATION_REQUIRED')
            AND amount_satang IS NULL
            AND completed_at IS NOT NULL
            AND failure_code IS NOT NULL
        )
    )
);

CREATE INDEX truemoney_voucher_bot_created_idx
    ON private.truemoney_voucher_redemptions (bot_id, created_at DESC);

CREATE INDEX truemoney_voucher_member_created_idx
    ON private.truemoney_voucher_redemptions (bot_id, member_discord_id, created_at DESC);

CREATE INDEX truemoney_voucher_processing_idx
    ON private.truemoney_voucher_redemptions (processing_started_at)
    WHERE status = 'REDEEMING';

CREATE TRIGGER truemoney_voucher_redemptions_set_updated_at
    BEFORE UPDATE ON private.truemoney_voucher_redemptions
    FOR EACH ROW EXECUTE FUNCTION private.set_store_updated_at();

ALTER TABLE private.truemoney_voucher_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.truemoney_voucher_redemptions FROM anon, authenticated;

COMMENT ON TABLE private.truemoney_voucher_redemptions IS
    'Append-preserved TrueMoney voucher attempts; successful amounts are stored in satang.';
COMMENT ON COLUMN private.truemoney_voucher_redemptions.voucher_hash IS
    'Global SHA-256 voucher claim; raw gift URLs are never persisted.';
