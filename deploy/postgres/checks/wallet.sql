DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['billing.wallets','billing.wallet_entries','private.member_wallets','private.member_wallet_entries'] LOOP
        IF to_regclass(target) IS NULL OR has_table_privilege('anon',target,'INSERT,UPDATE,DELETE')
           OR has_table_privilege('authenticated',target,'INSERT,UPDATE,DELETE') THEN
            RAISE EXCEPTION 'A wallet table is missing or allows browser writes';
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM information_schema.columns
               WHERE (table_schema,table_name,column_name) IN (
                   ('billing','wallets','balance_satang'),('billing','wallet_entries','amount_satang'),
                   ('private','member_wallets','balance_satang'),('private','member_wallet_entries','amount_satang'))
                 AND data_type='bigint') <> 4 THEN
        RAISE EXCEPTION 'Wallet monetary columns must be BIGINT satang';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='billing.wallet_entries'::regclass
                    AND tgname='wallet_entries_immutable' AND tgenabled<>'D' AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'Wallet ledger protection trigger is unavailable';
    END IF;
END $$;
