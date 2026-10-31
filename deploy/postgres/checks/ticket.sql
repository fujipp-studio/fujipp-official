DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.ticket_channels','private.ticket_counters'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing ticket database object';
        END IF;
    END LOOP;
END $$;
