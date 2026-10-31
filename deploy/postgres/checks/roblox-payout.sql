DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.robux_payout_jobs'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing roblox-payout database object';
        END IF;
    END LOOP;
END $$;
