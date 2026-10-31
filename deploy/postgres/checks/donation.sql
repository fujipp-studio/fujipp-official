DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['support.donations'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing donation database object';
        END IF;
    END LOOP;
END $$;
