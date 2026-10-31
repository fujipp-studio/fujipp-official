DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.role_shop_purchases'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing role-shop database object';
        END IF;
    END LOOP;
END $$;
