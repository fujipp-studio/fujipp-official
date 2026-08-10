
CREATE SCHEMA billing;

CREATE TYPE billing.customer_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'CLOSED'
);

CREATE TYPE billing.wallet_status AS ENUM (
    'ACTIVE',
    'FROZEN',
    'CLOSED'
);

CREATE TYPE billing.wallet_direction AS ENUM (
    'CREDIT',
    'DEBIT'
);

CREATE TYPE billing.wallet_entry_type AS ENUM (
    'TOP_UP',
    'PURCHASE',
    'REFUND',
    'ADJUSTMENT',
    'BONUS'
);

CREATE TYPE billing.topup_status AS ENUM (
    'PENDING',
    'VERIFYING',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE billing.slip_verification_status AS ENUM (
    'PENDING',
    'VERIFYING',
    'VERIFIED',
    'REJECTED',
    'ERROR'
);

CREATE TABLE billing.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE
        REFERENCES auth.users (id) ON DELETE SET NULL,
    customer_code VARCHAR(40) NOT NULL UNIQUE,
    status billing.customer_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT customers_code_format_chk CHECK (
        customer_code ~ '^CUS_[A-F0-9]{32}$'
    )
);

CREATE INDEX customers_status_idx
    ON billing.customers (status);

CREATE TABLE billing.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL
        REFERENCES billing.customers (id) ON DELETE RESTRICT,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    balance_satang BIGINT NOT NULL DEFAULT 0,
    status billing.wallet_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wallets_customer_currency_key
        UNIQUE (customer_id, currency),
    CONSTRAINT wallets_id_customer_key
        UNIQUE (id, customer_id),
    CONSTRAINT wallets_currency_chk
        CHECK (currency = 'THB'),
    CONSTRAINT wallets_balance_nonnegative_chk
        CHECK (balance_satang >= 0)
);

CREATE INDEX wallets_status_idx
    ON billing.wallets (status);

CREATE TABLE billing.wallet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL
        REFERENCES billing.wallets (id) ON DELETE RESTRICT,
    direction billing.wallet_direction NOT NULL,
    entry_type billing.wallet_entry_type NOT NULL,
    amount_satang BIGINT NOT NULL,
    balance_before_satang BIGINT NOT NULL,
    balance_after_satang BIGINT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    idempotency_key VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wallet_entries_amount_positive_chk
        CHECK (amount_satang > 0),
    CONSTRAINT wallet_entries_balances_nonnegative_chk
        CHECK (
            balance_before_satang >= 0
            AND balance_after_satang >= 0
        ),
    CONSTRAINT wallet_entries_balance_math_chk CHECK (
        (
            direction = 'CREDIT'
            AND balance_after_satang =
                balance_before_satang + amount_satang
        )
        OR (
            direction = 'DEBIT'
            AND balance_after_satang =
                balance_before_satang - amount_satang
        )
    ),
    CONSTRAINT wallet_entries_type_direction_chk CHECK (
        entry_type = 'ADJUSTMENT'
        OR (
            entry_type IN ('TOP_UP', 'REFUND', 'BONUS')
            AND direction = 'CREDIT'
        )
        OR (
            entry_type = 'PURCHASE'
            AND direction = 'DEBIT'
        )
    ),
    CONSTRAINT wallet_entries_reference_pair_chk CHECK (
        (reference_type IS NULL) = (reference_id IS NULL)
    )
);

CREATE INDEX wallet_entries_wallet_created_idx
    ON billing.wallet_entries (wallet_id, created_at DESC);
CREATE INDEX wallet_entries_reference_idx
    ON billing.wallet_entries (reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

CREATE TABLE billing.topup_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    wallet_id UUID NOT NULL,
    amount_satang BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    status billing.topup_status NOT NULL DEFAULT 'PENDING',
    qr_payload TEXT NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL UNIQUE,
    wallet_entry_id UUID UNIQUE
        REFERENCES billing.wallet_entries (id) ON DELETE RESTRICT,
    expires_at TIMESTAMPTZ NOT NULL,
    verifying_at TIMESTAMPTZ,
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failure_code VARCHAR(50),
    failure_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT topup_invoices_amount_positive_chk
        CHECK (amount_satang > 0),
    CONSTRAINT topup_invoices_wallet_customer_fkey
        FOREIGN KEY (wallet_id, customer_id)
        REFERENCES billing.wallets (id, customer_id) ON DELETE RESTRICT,
    CONSTRAINT topup_invoices_currency_chk
        CHECK (currency = 'THB'),
    CONSTRAINT topup_invoices_expiry_chk
        CHECK (expires_at > created_at),
    CONSTRAINT topup_invoices_success_entry_chk CHECK (
        (status = 'SUCCESS' AND wallet_entry_id IS NOT NULL)
        OR (status <> 'SUCCESS' AND wallet_entry_id IS NULL)
    ),
    CONSTRAINT topup_invoices_status_timestamps_chk CHECK (
        (status <> 'SUCCESS' OR succeeded_at IS NOT NULL)
        AND (status <> 'FAILED' OR failed_at IS NOT NULL)
        AND (status <> 'CANCELLED' OR cancelled_at IS NOT NULL)
    )
);

CREATE INDEX topup_invoices_customer_created_idx
    ON billing.topup_invoices (customer_id, created_at DESC);
CREATE INDEX topup_invoices_wallet_status_idx
    ON billing.topup_invoices (wallet_id, status);
CREATE INDEX topup_invoices_pending_expiry_idx
    ON billing.topup_invoices (expires_at)
    WHERE status IN ('PENDING', 'FAILED');

CREATE TABLE billing.slip_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topup_invoice_id UUID NOT NULL
        REFERENCES billing.topup_invoices (id) ON DELETE RESTRICT,
    attempt_number INTEGER NOT NULL,
    status billing.slip_verification_status NOT NULL DEFAULT 'PENDING',
    slip_storage_path TEXT NOT NULL,

    slipok_error_code VARCHAR(20),
    slipok_message TEXT,
    transaction_reference VARCHAR(50),
    transaction_at TIMESTAMPTZ,
    sending_bank_code VARCHAR(10),
    receiving_bank_code VARCHAR(10),
    sender_display_name VARCHAR(100),
    receiver_display_name VARCHAR(100),
    verified_amount_satang BIGINT,
    slipok_response JSONB,

    verification_started_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT slip_verifications_invoice_attempt_key
        UNIQUE (topup_invoice_id, attempt_number),
    CONSTRAINT slip_verifications_attempt_positive_chk
        CHECK (attempt_number > 0),
    CONSTRAINT slip_verifications_storage_path_chk
        CHECK (char_length(btrim(slip_storage_path)) > 0),
    CONSTRAINT slip_verifications_amount_chk
        CHECK (
            verified_amount_satang IS NULL
            OR verified_amount_satang > 0
        ),
    CONSTRAINT slip_verifications_verified_fields_chk CHECK (
        status <> 'VERIFIED'
        OR (
            transaction_reference IS NOT NULL
            AND transaction_at IS NOT NULL
            AND verified_amount_satang IS NOT NULL
            AND verified_at IS NOT NULL
        )
    ),
    CONSTRAINT slip_verifications_rejected_at_chk CHECK (
        status <> 'REJECTED' OR rejected_at IS NOT NULL
    )
);

CREATE UNIQUE INDEX slip_verifications_transaction_reference_key
    ON billing.slip_verifications (transaction_reference)
    WHERE transaction_reference IS NOT NULL;
CREATE INDEX slip_verifications_invoice_created_idx
    ON billing.slip_verifications (topup_invoice_id, created_at DESC);
CREATE INDEX slip_verifications_status_idx
    ON billing.slip_verifications (status);

CREATE FUNCTION billing.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customers',
        'wallets',
        'topup_invoices',
        'slip_verifications'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at
             BEFORE UPDATE ON billing.%I
             FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION billing.set_updated_at() FROM PUBLIC;

CREATE FUNCTION billing.protect_wallet_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION
        'wallet entries are immutable; create a compensating entry instead';
END;
$$;

CREATE TRIGGER wallet_entries_immutable
    BEFORE UPDATE OR DELETE ON billing.wallet_entries
    FOR EACH ROW
    EXECUTE FUNCTION billing.protect_wallet_entry();

REVOKE ALL ON FUNCTION billing.protect_wallet_entry() FROM PUBLIC;

CREATE FUNCTION billing.apply_wallet_entry(
    p_wallet_id UUID,
    p_direction billing.wallet_direction,
    p_entry_type billing.wallet_entry_type,
    p_amount_satang BIGINT,
    p_idempotency_key TEXT,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS billing.wallet_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_wallet billing.wallets;
    existing_entry billing.wallet_entries;
    new_entry billing.wallet_entries;
    next_balance BIGINT;
BEGIN
    IF p_amount_satang <= 0 THEN
        RAISE EXCEPTION 'wallet entry amount must be greater than zero';
    END IF;

    IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
        RAISE EXCEPTION 'idempotency key is required';
    END IF;

    IF (p_reference_type IS NULL) <> (p_reference_id IS NULL) THEN
        RAISE EXCEPTION
            'reference type and reference id must both be null or non-null';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_idempotency_key, 0)
    );

    SELECT entry.*
      INTO existing_entry
      FROM billing.wallet_entries AS entry
     WHERE entry.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF existing_entry.wallet_id <> p_wallet_id
           OR existing_entry.direction <> p_direction
           OR existing_entry.entry_type <> p_entry_type
           OR existing_entry.amount_satang <> p_amount_satang
           OR existing_entry.reference_type
                IS DISTINCT FROM p_reference_type
           OR existing_entry.reference_id
                IS DISTINCT FROM p_reference_id THEN
            RAISE EXCEPTION
                'idempotency key was already used for a different wallet entry';
        END IF;

        RETURN existing_entry;
    END IF;

    SELECT wallet.*
      INTO target_wallet
      FROM billing.wallets AS wallet
     WHERE wallet.id = p_wallet_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'wallet not found';
    END IF;

    IF target_wallet.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'wallet is not active';
    END IF;

    IF p_direction = 'CREDIT' THEN
        next_balance := target_wallet.balance_satang + p_amount_satang;
    ELSE
        next_balance := target_wallet.balance_satang - p_amount_satang;
    END IF;

    IF next_balance < 0 THEN
        RAISE EXCEPTION 'insufficient wallet balance';
    END IF;

    INSERT INTO billing.wallet_entries (
        wallet_id,
        direction,
        entry_type,
        amount_satang,
        balance_before_satang,
        balance_after_satang,
        reference_type,
        reference_id,
        idempotency_key,
        description,
        created_by
    )
    VALUES (
        p_wallet_id,
        p_direction,
        p_entry_type,
        p_amount_satang,
        target_wallet.balance_satang,
        next_balance,
        p_reference_type,
        p_reference_id,
        p_idempotency_key,
        NULLIF(btrim(p_description), ''),
        p_created_by
    )
    RETURNING * INTO new_entry;

    UPDATE billing.wallets
       SET balance_satang = next_balance
     WHERE id = p_wallet_id;

    RETURN new_entry;
END;
$$;

REVOKE ALL ON FUNCTION billing.apply_wallet_entry(
    UUID,
    billing.wallet_direction,
    billing.wallet_entry_type,
    BIGINT,
    TEXT,
    TEXT,
    UUID,
    TEXT,
    UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION billing.apply_wallet_entry(
    UUID,
    billing.wallet_direction,
    billing.wallet_entry_type,
    BIGINT,
    TEXT,
    TEXT,
    UUID,
    TEXT,
    UUID
) TO service_role;

CREATE FUNCTION billing.complete_slipok_topup(
    p_topup_invoice_id UUID,
    p_slip_verification_id UUID
)
RETURNS billing.topup_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_invoice billing.topup_invoices;
    target_verification billing.slip_verifications;
    credited_entry billing.wallet_entries;
BEGIN
    SELECT invoice.*
      INTO target_invoice
      FROM billing.topup_invoices AS invoice
     WHERE invoice.id = p_topup_invoice_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'top-up invoice not found';
    END IF;

    IF target_invoice.status = 'SUCCESS' THEN
        RETURN target_invoice;
    END IF;

    IF target_invoice.status IN ('CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'top-up invoice cannot be completed in its current status';
    END IF;

    SELECT verification.*
      INTO target_verification
      FROM billing.slip_verifications AS verification
     WHERE verification.id = p_slip_verification_id
       AND verification.topup_invoice_id = p_topup_invoice_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'slip verification not found for this invoice';
    END IF;

    IF target_verification.status <> 'VERIFIED' THEN
        RAISE EXCEPTION 'slip verification is not verified';
    END IF;

    IF target_verification.verified_amount_satang
       <> target_invoice.amount_satang THEN
        RAISE EXCEPTION 'verified slip amount does not match invoice amount';
    END IF;

    credited_entry := billing.apply_wallet_entry(
        target_invoice.wallet_id,
        'CREDIT',
        'TOP_UP',
        target_invoice.amount_satang,
        'slipok-topup:' || target_invoice.id::text,
        'TOPUP_INVOICE',
        target_invoice.id,
        'SlipOK verified wallet top-up',
        NULL
    );

    UPDATE billing.topup_invoices
       SET status = 'SUCCESS',
           wallet_entry_id = credited_entry.id,
           succeeded_at = now(),
           failure_code = NULL,
           failure_message = NULL
     WHERE id = target_invoice.id
     RETURNING * INTO target_invoice;

    RETURN target_invoice;
END;
$$;

REVOKE ALL ON FUNCTION billing.complete_slipok_topup(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION billing.complete_slipok_topup(UUID, UUID)
    TO service_role;

CREATE FUNCTION billing.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_customer_id UUID;
BEGIN
    INSERT INTO billing.customers (
        user_id,
        customer_code
    )
    VALUES (
        NEW.id,
        'CUS_' || upper(replace(NEW.id::text, '-', ''))
    )
    ON CONFLICT (user_id) DO UPDATE
        SET user_id = EXCLUDED.user_id
    RETURNING id INTO new_customer_id;

    INSERT INTO billing.wallets (
        customer_id,
        currency
    )
    VALUES (
        new_customer_id,
        'THB'
    )
    ON CONFLICT (customer_id, currency) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_billing
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION billing.handle_new_profile();

REVOKE ALL ON FUNCTION billing.handle_new_profile() FROM PUBLIC;

INSERT INTO billing.customers (
    user_id,
    customer_code
)
SELECT
    profile.id,
    'CUS_' || upper(replace(profile.id::text, '-', ''))
  FROM public.profiles AS profile
ON CONFLICT (user_id) DO UPDATE
    SET user_id = EXCLUDED.user_id;

INSERT INTO billing.wallets (
    customer_id,
    currency
)
SELECT
    customer.id,
    'THB'
  FROM billing.customers AS customer
 WHERE customer.user_id IS NOT NULL
ON CONFLICT (customer_id, currency) DO NOTHING;

GRANT USAGE ON SCHEMA billing TO service_role;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customers',
        'wallets',
        'wallet_entries',
        'topup_invoices',
        'slip_verifications'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY',
            table_name
        );
        EXECUTE format(
            'REVOKE ALL ON TABLE billing.%I FROM anon, authenticated',
            table_name
        );
        EXECUTE format(
            'GRANT ALL ON TABLE billing.%I TO service_role',
            table_name
        );
    END LOOP;
END;
$$;
