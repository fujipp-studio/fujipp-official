-- VPS-only. Apply after restoring the application snapshot in a scratch DB.
DO $$ BEGIN
    IF current_database() NOT LIKE 'migration_%' THEN
        RAISE EXCEPTION 'Apply VPS migration to a scratch database before cutover';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fujipp_backend') THEN
        CREATE ROLE fujipp_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
    END IF;
END $$;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS projected_token_issued_at timestamptz;
DO $$ BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO fujipp_backend', current_database());
END $$;
GRANT USAGE ON SCHEMA public, private, billing, bots, shop, portfolio, support, auth, extensions TO fujipp_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, private, billing, bots, shop, portfolio, support TO fujipp_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, private, billing, bots, shop, portfolio, support TO fujipp_backend;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, private, billing, bots, shop, portfolio, support, auth, extensions TO fujipp_backend;
GRANT SELECT, INSERT ON auth.users TO fujipp_backend;
GRANT UPDATE(email, projected_token_issued_at) ON auth.users TO fujipp_backend;
-- No password is stored in migrations. Enable LOGIN with a generated secret only
-- when configuring the application; anon/authenticated/service_role stay NOLOGIN.
-- Triggers attached to auth.users are outside the application-schema dump.
-- Reattach only the application profile provisioner, never Supabase Auth internals.
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='auth.users'::regclass
                   AND tgname='on_auth_user_created' AND NOT tgisinternal) THEN
        CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    END IF;
END $$;
