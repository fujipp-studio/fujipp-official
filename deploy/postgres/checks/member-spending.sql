DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['private.member_spending','private.member_spending_monthly','private.member_spending_operations','private.member_spending_backup_quotas'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing member-spending database object';
        END IF;
    END LOOP;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='private.member_spending_backup_quotas'::regclass AND relrowsecurity) THEN
        RAISE EXCEPTION 'Member spending backup quotas require RLS';
    END IF;
    IF has_table_privilege('authenticated','private.member_spending_backup_quotas','SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('anon','private.member_spending_backup_quotas','SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'Member spending backup quotas must remain private';
    END IF;
END $$;
