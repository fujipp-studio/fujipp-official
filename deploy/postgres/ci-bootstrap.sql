-- Disposable CI databases only. Never apply this bootstrap to an existing DB.
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE fujipp_backend NOLOGIN BYPASSRLS;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    projected_token_issued_at timestamptz
);
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text
);
