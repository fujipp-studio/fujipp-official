DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['portfolio.projects'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing portfolio database object';
        END IF;
    END LOOP;
END $$;
