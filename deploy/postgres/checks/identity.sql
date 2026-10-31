DO $$ BEGIN
    IF to_regclass('auth.users') IS NULL OR to_regclass('public.profiles') IS NULL
       OR to_regclass('private.user_accounts') IS NULL THEN
        RAISE EXCEPTION 'Identity/profile/account projection is incomplete';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='auth.users'::regclass
                    AND tgname='on_auth_user_created' AND NOT tgisinternal AND tgenabled<>'D') THEN
        RAISE EXCEPTION 'Identity provisioning trigger is unavailable';
    END IF;
END $$;
