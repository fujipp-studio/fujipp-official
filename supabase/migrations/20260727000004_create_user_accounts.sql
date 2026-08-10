
CREATE SCHEMA private;

CREATE TYPE private.app_role AS ENUM (
    'USER',
    'TESTER',
    'EDITOR',
    'ADMIN'
);

CREATE TYPE private.account_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'BANNED',
    'DEACTIVATED'
);

CREATE TABLE private.user_accounts (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users (id) ON DELETE CASCADE,
    role private.app_role NOT NULL DEFAULT 'USER',
    status private.account_status NOT NULL DEFAULT 'ACTIVE',
    status_reason TEXT,
    status_changed_at TIMESTAMPTZ,
    status_changed_by UUID
        REFERENCES auth.users (id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_accounts_deactivation_chk CHECK (
        (status = 'DEACTIVATED' AND deleted_at IS NOT NULL)
        OR (status <> 'DEACTIVATED' AND deleted_at IS NULL)
    ),
    CONSTRAINT user_accounts_status_reason_chk CHECK (
        status_reason IS NULL
        OR char_length(btrim(status_reason)) BETWEEN 1 AND 1000
    )
);

CREATE INDEX user_accounts_role_idx
    ON private.user_accounts (role);
CREATE INDEX user_accounts_status_idx
    ON private.user_accounts (status);
CREATE INDEX user_accounts_status_changed_by_idx
    ON private.user_accounts (status_changed_by)
    WHERE status_changed_by IS NOT NULL;

CREATE TABLE private.reserved_usernames (
    username VARCHAR(50) PRIMARY KEY,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reserved_usernames_lowercase_chk CHECK (
        username = lower(username)
    ),
    CONSTRAINT reserved_usernames_format_chk CHECK (
        username ~ '^[a-z0-9_]+$'
    )
);

INSERT INTO private.reserved_usernames (username, reason)
VALUES
    ('admin', 'Reserved for administration'),
    ('administrator', 'Reserved for administration'),
    ('api', 'Reserved application route'),
    ('auth', 'Reserved authentication route'),
    ('billing', 'Reserved billing route'),
    ('dashboard', 'Reserved application route'),
    ('help', 'Reserved support route'),
    ('login', 'Reserved authentication route'),
    ('logout', 'Reserved authentication route'),
    ('me', 'Reserved current-user route'),
    ('profile', 'Reserved profile route'),
    ('register', 'Reserved authentication route'),
    ('root', 'Reserved system account'),
    ('settings', 'Reserved application route'),
    ('signup', 'Reserved authentication route'),
    ('support', 'Reserved support route'),
    ('system', 'Reserved system account'),
    ('users', 'Reserved application route');

CREATE FUNCTION private.prepare_user_account_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.status_reason := NULLIF(btrim(NEW.status_reason), '');

    IF TG_OP = 'UPDATE' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'account user id cannot be changed';
        END IF;

        NEW.created_at := OLD.created_at;
        NEW.updated_at := now();

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.status_changed_at := now();

            IF NEW.status = 'DEACTIVATED' THEN
                NEW.deleted_at := COALESCE(OLD.deleted_at, now());
            ELSE
                NEW.deleted_at := NULL;
            END IF;
        ELSE
            NEW.status_changed_at := OLD.status_changed_at;
            NEW.deleted_at := OLD.deleted_at;
        END IF;
    ELSIF NEW.status = 'DEACTIVATED' THEN
        NEW.status_changed_at := COALESCE(NEW.status_changed_at, now());
        NEW.deleted_at := COALESCE(NEW.deleted_at, now());
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER user_accounts_prepare_write
    BEFORE INSERT OR UPDATE ON private.user_accounts
    FOR EACH ROW
    EXECUTE FUNCTION private.prepare_user_account_write();

REVOKE ALL ON FUNCTION private.prepare_user_account_write() FROM PUBLIC;

CREATE FUNCTION private.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO private.user_accounts (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_account
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.handle_new_profile();

REVOKE ALL ON FUNCTION private.handle_new_profile() FROM PUBLIC;

INSERT INTO private.user_accounts (user_id)
SELECT profile.id
  FROM public.profiles AS profile
ON CONFLICT (user_id) DO NOTHING;

CREATE FUNCTION private.reject_reserved_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.username IS NOT NULL
       AND EXISTS (
            SELECT 1
              FROM private.reserved_usernames AS reserved
             WHERE reserved.username = NEW.username
       ) THEN
        RAISE EXCEPTION 'username is reserved';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_reject_reserved_username
    BEFORE INSERT OR UPDATE OF username ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.reject_reserved_username();

REVOKE ALL ON FUNCTION private.reject_reserved_username() FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.profiles AS profile
          JOIN private.reserved_usernames AS reserved
            ON reserved.username = profile.username
    ) THEN
        RAISE EXCEPTION
            'an existing profile uses a reserved username';
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA private TO service_role;

ALTER TABLE private.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.reserved_usernames ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.user_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE private.reserved_usernames FROM anon, authenticated;

GRANT ALL ON TABLE private.user_accounts TO service_role;
GRANT ALL ON TABLE private.reserved_usernames TO service_role;
