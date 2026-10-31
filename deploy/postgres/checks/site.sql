DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.website_effect_settings'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing site database object';
        END IF;
    END LOOP;
END $$;
