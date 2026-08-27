ALTER TABLE private.runtime_subscriptions
    ADD COLUMN renewal_price_satang BIGINT,
    ADD CONSTRAINT runtime_subscriptions_renewal_price_chk
        CHECK (renewal_price_satang IS NULL OR renewal_price_satang > 0);

CREATE OR REPLACE FUNCTION private.renew_runtime_subscription(
    p_subscription_id UUID,
    p_force BOOLEAN DEFAULT false
) RETURNS BOOLEAN
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
    renewal_price BIGINT;
BEGIN
    SELECT * INTO subscription FROM private.runtime_subscriptions
     WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND OR subscription.status NOT IN ('ACTIVE', 'GRACE') THEN RETURN false; END IF;
    IF NOT p_force AND NOT subscription.auto_renew THEN RETURN false; END IF;
    IF NOT p_force AND subscription.current_period_end > now() THEN RETURN false; END IF;

    SELECT * INTO selected_plan FROM shop.runtime_plans WHERE id = subscription.plan_id;
    renewal_price := COALESCE(subscription.renewal_price_satang, selected_plan.price_satang);
    SELECT wallet.* INTO selected_wallet
      FROM billing.customers customer
      JOIN billing.wallets wallet ON wallet.customer_id = customer.id AND wallet.currency = 'THB'
     WHERE customer.user_id = subscription.owner_user_id;
    renewal_key := 'runtime-renewal:' || subscription.id::text || ':'
        || extract(epoch FROM subscription.current_period_end)::bigint::text;

    BEGIN
        wallet_entry := billing.apply_wallet_entry(
            selected_wallet.id, 'DEBIT', 'PURCHASE', renewal_price,
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

REVOKE ALL ON FUNCTION private.renew_runtime_subscription(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.renew_runtime_subscription(UUID, BOOLEAN) TO service_role;
