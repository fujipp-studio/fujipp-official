DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.member_spending','private.member_spending_monthly','private.member_spending_operations'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing member-spending database object';
        END IF;
    END LOOP;
END $$;
