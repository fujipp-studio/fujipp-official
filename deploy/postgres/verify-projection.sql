\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE fujipp_backend;
INSERT INTO auth.users(id,email,raw_user_meta_data,projected_token_issued_at)
VALUES('00000000-0000-0000-0000-000000009999','migration-check@example.invalid',
       '{"display_name":"Migration check","role":"ADMIN","status":"ACTIVE"}', '2026-10-21T00:00:00Z');
DO $$ BEGIN
    IF (SELECT role::text FROM private.user_accounts WHERE user_id='00000000-0000-0000-0000-000000009999') IS DISTINCT FROM 'USER' THEN
        RAISE EXCEPTION 'New identity did not provision a USER account';
    END IF;
    IF (SELECT display_name FROM public.profiles WHERE id='00000000-0000-0000-0000-000000009999') IS DISTINCT FROM 'Migration check' THEN
        RAISE EXCEPTION 'Profile display fields were not provisioned';
    END IF;
END $$;
UPDATE private.user_accounts SET status='SUSPENDED',status_reason='Migration rehearsal' WHERE user_id='00000000-0000-0000-0000-000000009999';
INSERT INTO auth.users(id,email,raw_user_meta_data,projected_token_issued_at)
VALUES('00000000-0000-0000-0000-000000009999','new@example.invalid',
       '{"role":"ADMIN","status":"ACTIVE"}','2026-10-21T01:00:00Z')
ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,projected_token_issued_at=EXCLUDED.projected_token_issued_at
WHERE auth.users.projected_token_issued_at IS NULL OR auth.users.projected_token_issued_at < EXCLUDED.projected_token_issued_at;
DO $$ BEGIN
    IF (SELECT status::text FROM private.user_accounts WHERE user_id='00000000-0000-0000-0000-000000009999') IS DISTINCT FROM 'SUSPENDED' THEN
        RAISE EXCEPTION 'Identity update reactivated a suspended account';
    END IF;
    IF (SELECT role::text FROM private.user_accounts WHERE user_id='00000000-0000-0000-0000-000000009999') IS DISTINCT FROM 'USER' THEN
        RAISE EXCEPTION 'Identity update escalated permissions';
    END IF;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data,projected_token_issued_at)
VALUES('00000000-0000-0000-0000-000000009999','stale@example.invalid','{}','2026-10-21T00:30:00Z')
ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,projected_token_issued_at=EXCLUDED.projected_token_issued_at
WHERE auth.users.projected_token_issued_at IS NULL OR auth.users.projected_token_issued_at < EXCLUDED.projected_token_issued_at;
DO $$ BEGIN
    IF (SELECT email FROM auth.users WHERE id='00000000-0000-0000-0000-000000009999') IS DISTINCT FROM 'new@example.invalid' THEN
        RAISE EXCEPTION 'An older JWT overwrote the newer identity projection';
    END IF;
END $$;
ROLLBACK;
