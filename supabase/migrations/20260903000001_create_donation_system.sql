CREATE SCHEMA support;

CREATE TYPE support.donation_status AS ENUM (
    'PENDING',
    'SUCCESS',
    'CANCELLED'
);

CREATE TYPE support.donation_funding_method AS ENUM (
    'WALLET',
    'TOPUP'
);

CREATE TABLE support.donation_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    goal_satang BIGINT NOT NULL DEFAULT 10000000,
    updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT donation_settings_singleton_chk CHECK (id = 1),
    CONSTRAINT donation_settings_title_chk CHECK (char_length(btrim(title)) > 0),
    CONSTRAINT donation_settings_goal_chk CHECK (goal_satang >= 0)
);

INSERT INTO support.donation_settings (id, title, description, goal_satang)
VALUES (
    1,
    'Support Fujipp',
    'ร่วมสนับสนุนค่าใช้จ่ายในการพัฒนาและดูแลโปรเจกต์ Fujipp',
    10000000
);

CREATE TABLE support.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_number VARCHAR(40) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    donor_name VARCHAR(60) NOT NULL,
    message VARCHAR(280),
    anonymous BOOLEAN NOT NULL DEFAULT false,
    amount_satang BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    funding_method support.donation_funding_method NOT NULL,
    status support.donation_status NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(150) NOT NULL UNIQUE,
    wallet_entry_id UUID UNIQUE
        REFERENCES billing.wallet_entries (id) ON DELETE RESTRICT,
    succeeded_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT donations_name_chk CHECK (char_length(btrim(donor_name)) > 0),
    CONSTRAINT donations_amount_positive_chk CHECK (amount_satang > 0),
    CONSTRAINT donations_currency_chk CHECK (currency = 'THB'),
    CONSTRAINT donations_success_entry_chk CHECK (
        (status = 'SUCCESS' AND wallet_entry_id IS NOT NULL AND succeeded_at IS NOT NULL)
        OR (status <> 'SUCCESS' AND wallet_entry_id IS NULL AND succeeded_at IS NULL)
    ),
    CONSTRAINT donations_cancelled_at_chk CHECK (
        status <> 'CANCELLED' OR cancelled_at IS NOT NULL
    )
);

CREATE INDEX donations_user_succeeded_idx
    ON support.donations (user_id, succeeded_at DESC)
    WHERE status = 'SUCCESS';
CREATE INDEX donations_leaderboard_idx
    ON support.donations (amount_satang DESC, succeeded_at DESC)
    WHERE status = 'SUCCESS';
CREATE INDEX donations_pending_user_idx
    ON support.donations (user_id, created_at DESC)
    WHERE status = 'PENDING';

ALTER TABLE billing.topup_invoices
    ADD COLUMN donation_id UUID
        REFERENCES support.donations (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX topup_active_donation_idx
    ON billing.topup_invoices (donation_id)
    WHERE donation_id IS NOT NULL
      AND status IN ('PENDING', 'VERIFYING', 'FAILED');

CREATE FUNCTION support.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER donation_settings_set_updated_at
    BEFORE UPDATE ON support.donation_settings
    FOR EACH ROW EXECUTE FUNCTION support.set_updated_at();
CREATE TRIGGER donations_set_updated_at
    BEFORE UPDATE ON support.donations
    FOR EACH ROW EXECUTE FUNCTION support.set_updated_at();

REVOKE ALL ON FUNCTION support.set_updated_at() FROM PUBLIC;

CREATE FUNCTION support.complete_wallet_donation(
    p_donation_id UUID,
    p_user_id UUID
)
RETURNS support.donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_donation support.donations;
    target_wallet billing.wallets;
    debit_entry billing.wallet_entries;
BEGIN
    SELECT donation.*
      INTO target_donation
      FROM support.donations AS donation
     WHERE donation.id = p_donation_id
     FOR UPDATE;

    IF NOT FOUND OR target_donation.user_id <> p_user_id THEN
        RAISE EXCEPTION 'donation not found for this user';
    END IF;

    IF target_donation.status = 'SUCCESS' THEN
        RETURN target_donation;
    END IF;

    IF target_donation.status <> 'PENDING' THEN
        RAISE EXCEPTION 'donation cannot be completed in its current status';
    END IF;

    SELECT wallet.*
      INTO target_wallet
      FROM billing.wallets AS wallet
      JOIN billing.customers AS customer
        ON customer.id = wallet.customer_id
     WHERE customer.user_id = p_user_id
       AND customer.status = 'ACTIVE'
       AND wallet.currency = 'THB'
       AND wallet.status = 'ACTIVE'
     FOR UPDATE OF wallet;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active THB wallet not found';
    END IF;

    debit_entry := billing.apply_wallet_entry(
        target_wallet.id,
        'DEBIT',
        'PURCHASE',
        target_donation.amount_satang,
        'wallet-donation:' || target_donation.id::text,
        'DONATION',
        target_donation.id,
        'Donation to Fujipp',
        p_user_id
    );

    UPDATE support.donations
       SET status = 'SUCCESS',
           wallet_entry_id = debit_entry.id,
           succeeded_at = now()
     WHERE id = target_donation.id
     RETURNING * INTO target_donation;

    RETURN target_donation;
END;
$$;

REVOKE ALL ON FUNCTION support.complete_wallet_donation(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION support.complete_wallet_donation(UUID, UUID)
    TO service_role;

CREATE OR REPLACE FUNCTION billing.complete_slipok_topup(
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
    target_user_id UUID;
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

    IF target_invoice.donation_id IS NOT NULL THEN
        SELECT customer.user_id
          INTO target_user_id
          FROM billing.customers AS customer
         WHERE customer.id = target_invoice.customer_id;

        PERFORM support.complete_wallet_donation(
            target_invoice.donation_id,
            target_user_id
        );
    END IF;

    RETURN target_invoice;
END;
$$;

REVOKE ALL ON FUNCTION billing.complete_slipok_topup(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION billing.complete_slipok_topup(UUID, UUID)
    TO service_role;

REVOKE ALL ON SCHEMA support FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA support TO service_role;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'donation_settings',
        'donations'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE support.%I ENABLE ROW LEVEL SECURITY',
            table_name
        );
        EXECUTE format(
            'REVOKE ALL ON TABLE support.%I FROM PUBLIC, anon, authenticated',
            table_name
        );
        EXECUTE format(
            'GRANT ALL ON TABLE support.%I TO service_role',
            table_name
        );
    END LOOP;
END;
$$;
