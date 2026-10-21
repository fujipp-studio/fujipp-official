-- VPS-only compatibility schema. Never apply this file to managed Supabase.
-- Authentication and credentials remain in managed Supabase Auth. This is only
-- the identity projection needed by application foreign keys and admin queries.
DO $$ BEGIN
    IF current_database() NOT LIKE 'migration_%' THEN
        RAISE EXCEPTION 'This bootstrap is restricted to new migration scratch databases';
    END IF;
END $$;
CREATE SCHEMA auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    projected_token_issued_at timestamptz
);
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth.users FROM PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- pg_dump recreates public with its original functions and tables.
-- RESTRICT prevents accidental removal if this database is not empty.
DROP SCHEMA public RESTRICT;
