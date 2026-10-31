DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.truemoney_voucher_redemptions'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing payment-trigger database object';
        END IF;
    END LOOP;
END $$;
