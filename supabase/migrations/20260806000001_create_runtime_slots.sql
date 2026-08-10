CREATE TYPE private.runtime_subscription_status AS ENUM (
    'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE shop.runtime_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price_satang BIGINT NOT NULL CHECK (price_satang > 0),
    currency CHAR(3) NOT NULL DEFAULT 'THB' CHECK (currency = 'THB'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE private.runtime_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_number INTEGER NOT NULL UNIQUE CHECK (slot_number > 0),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE private.runtime_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    runtime_slot_id UUID NOT NULL REFERENCES private.runtime_slots(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES shop.runtime_plans(id) ON DELETE RESTRICT,
    bot_id UUID REFERENCES bots.bot_instances(id) ON DELETE RESTRICT,
    status private.runtime_subscription_status NOT NULL DEFAULT 'ACTIVE',
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL,
    grace_until TIMESTAMPTZ,
    last_renewal_attempt_at TIMESTAMPTZ,
    last_wallet_entry_id UUID REFERENCES billing.wallet_entries(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT runtime_subscription_period_chk
        CHECK (current_period_end > current_period_start),
    CONSTRAINT runtime_subscription_grace_chk
        CHECK (grace_until IS NULL OR grace_until >= current_period_end)
);

CREATE UNIQUE INDEX runtime_subscriptions_live_slot_uidx
    ON private.runtime_subscriptions(runtime_slot_id)
    WHERE status IN ('ACTIVE', 'GRACE');

CREATE UNIQUE INDEX runtime_subscriptions_live_bot_uidx
    ON private.runtime_subscriptions(bot_id)
    WHERE bot_id IS NOT NULL AND status IN ('ACTIVE', 'GRACE');

CREATE INDEX runtime_subscriptions_owner_idx
    ON private.runtime_subscriptions(owner_user_id, created_at DESC);

CREATE INDEX runtime_subscriptions_due_idx
    ON private.runtime_subscriptions(current_period_end, grace_until)
    WHERE status IN ('ACTIVE', 'GRACE');

INSERT INTO shop.runtime_plans(id, code, name, duration_days, price_satang, sort_order)
VALUES
    ('e1000000-0000-0000-0000-000000000007','RUNTIME_7_DAYS','Runtime 7 Days',7,4900,10),
    ('e1000000-0000-0000-0000-000000000030','RUNTIME_30_DAYS','Runtime 1 Month',30,9900,20),
    ('e1000000-0000-0000-0000-000000000090','RUNTIME_90_DAYS','Runtime 3 Months',90,26900,30);

INSERT INTO shop.feature_products(
    id,code,name,description,category,icon_key,status,is_featured,sort_order
) VALUES (
    'e1000000-0000-0000-0000-000000000001','runtime-hosting','Runtime Hosting',
    'A dedicated Runtime slot for one Discord bot with automatic renewal and a 3-hour grace period.',
    'RUNTIME','server','ACTIVE',true,5
);
INSERT INTO shop.feature_versions(
    id,feature_product_id,version,runtime_key,status,published_at
) VALUES (
    'e1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001',
    '1.0.0','runtime-hosting','PUBLISHED',now()
);
INSERT INTO shop.feature_offers(
    id,feature_product_id,code,name,offer_kind,price_satang,billing_period_days,installation_limit
) VALUES
    ('e1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000001','runtime-7-days','1 Week','SUBSCRIPTION',4900,7,1),
    ('e1000000-0000-0000-0000-000000000030','e1000000-0000-0000-0000-000000000001','runtime-30-days','1 Month','SUBSCRIPTION',9900,30,1),
    ('e1000000-0000-0000-0000-000000000090','e1000000-0000-0000-0000-000000000001','runtime-90-days','3 Months','SUBSCRIPTION',26900,90,1);

INSERT INTO private.runtime_slots(slot_number)
SELECT generate_series(1, 20);

ALTER TABLE shop.runtime_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shop.runtime_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON shop.runtime_plans TO anon, authenticated, service_role;

CREATE POLICY runtime_plans_public_read
    ON shop.runtime_plans FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

REVOKE ALL ON private.runtime_slots, private.runtime_subscriptions
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.runtime_slots, private.runtime_subscriptions TO service_role;

CREATE FUNCTION private.validate_runtime_subscription_bot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    bot_owner UUID;
BEGIN
    IF NEW.bot_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT owner_user_id INTO bot_owner
      FROM bots.bot_instances
     WHERE id = NEW.bot_id AND status <> 'DECOMMISSIONED';
    IF bot_owner IS NULL OR bot_owner <> NEW.owner_user_id THEN
        RAISE EXCEPTION 'runtime subscription bot must belong to its owner';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER runtime_subscriptions_validate_bot
    BEFORE INSERT OR UPDATE OF owner_user_id, bot_id
    ON private.runtime_subscriptions
    FOR EACH ROW EXECUTE FUNCTION private.validate_runtime_subscription_bot();

CREATE FUNCTION private.purchase_runtime_subscription(p_owner_user_id UUID, p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    selected_plan shop.runtime_plans;
    selected_slot private.runtime_slots;
    selected_wallet billing.wallets;
    subscription_id UUID := gen_random_uuid();
    wallet_entry billing.wallet_entries;
BEGIN
    SELECT * INTO selected_plan FROM shop.runtime_plans
     WHERE id = p_plan_id AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'runtime plan was not found'; END IF;

    SELECT slot.* INTO selected_slot
      FROM private.runtime_slots slot
     WHERE slot.is_enabled
       AND NOT EXISTS (
           SELECT 1 FROM private.runtime_subscriptions subscription
            WHERE subscription.runtime_slot_id = slot.id
              AND subscription.status IN ('ACTIVE', 'GRACE')
       )
     ORDER BY slot.slot_number
     FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'no runtime slots are available'; END IF;

    SELECT wallet.* INTO selected_wallet
      FROM billing.customers customer
      JOIN billing.wallets wallet ON wallet.customer_id = customer.id AND wallet.currency = 'THB'
     WHERE customer.user_id = p_owner_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'customer wallet was not found'; END IF;

    wallet_entry := billing.apply_wallet_entry(
        selected_wallet.id, 'DEBIT', 'PURCHASE', selected_plan.price_satang,
        'runtime-purchase:' || subscription_id::text,
        'RUNTIME_SUBSCRIPTION', subscription_id, selected_plan.name, p_owner_user_id
    );

    INSERT INTO private.runtime_subscriptions(
        id, owner_user_id, runtime_slot_id, plan_id, current_period_end, last_wallet_entry_id
    ) VALUES (
        subscription_id, p_owner_user_id, selected_slot.id, selected_plan.id,
        now() + make_interval(days => selected_plan.duration_days), wallet_entry.id
    );
    RETURN subscription_id;
END;
$$;

CREATE FUNCTION private.renew_runtime_subscription(p_subscription_id UUID, p_force BOOLEAN DEFAULT false)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    subscription private.runtime_subscriptions;
    selected_plan shop.runtime_plans;
    selected_wallet billing.wallets;
    wallet_entry billing.wallet_entries;
    renewal_key TEXT;
BEGIN
    SELECT * INTO subscription FROM private.runtime_subscriptions
     WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND OR subscription.status NOT IN ('ACTIVE', 'GRACE') THEN RETURN false; END IF;
    IF NOT p_force AND NOT subscription.auto_renew THEN RETURN false; END IF;
    IF NOT p_force AND subscription.current_period_end > now() THEN RETURN false; END IF;

    SELECT * INTO selected_plan FROM shop.runtime_plans WHERE id = subscription.plan_id;
    SELECT wallet.* INTO selected_wallet
      FROM billing.customers customer
      JOIN billing.wallets wallet ON wallet.customer_id = customer.id AND wallet.currency = 'THB'
     WHERE customer.user_id = subscription.owner_user_id;
    renewal_key := 'runtime-renewal:' || subscription.id::text || ':'
        || extract(epoch FROM subscription.current_period_end)::bigint::text;

    BEGIN
        wallet_entry := billing.apply_wallet_entry(
            selected_wallet.id, 'DEBIT', 'PURCHASE', selected_plan.price_satang,
            renewal_key, 'RUNTIME_SUBSCRIPTION', subscription.id,
            'Auto-renew ' || selected_plan.name, subscription.owner_user_id
        );
        UPDATE private.runtime_subscriptions
           SET status = 'ACTIVE',
               current_period_start = current_period_end,
               current_period_end = current_period_end + make_interval(days => selected_plan.duration_days),
               grace_until = NULL,
               last_renewal_attempt_at = now(),
               last_wallet_entry_id = wallet_entry.id,
               updated_at = now()
         WHERE id = subscription.id;
        RETURN true;
    EXCEPTION WHEN OTHERS THEN
        IF position('insufficient wallet balance' IN SQLERRM) = 0 THEN RAISE; END IF;
        UPDATE private.runtime_subscriptions
           SET status = CASE WHEN now() < current_period_end + interval '3 hours'
                             THEN 'GRACE'::private.runtime_subscription_status
                             ELSE 'EXPIRED'::private.runtime_subscription_status END,
               grace_until = current_period_end + interval '3 hours',
               last_renewal_attempt_at = now(), updated_at = now()
         WHERE id = subscription.id;
        RETURN false;
    END;
END;
$$;

REVOKE ALL ON FUNCTION private.purchase_runtime_subscription(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.renew_runtime_subscription(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.purchase_runtime_subscription(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION private.renew_runtime_subscription(UUID, BOOLEAN) TO service_role;

ALTER TABLE bots.bot_instances ALTER COLUMN desired_state SET DEFAULT 'STOPPED';
UPDATE bots.bot_instances SET desired_state = 'STOPPED'
 WHERE status <> 'DECOMMISSIONED';
