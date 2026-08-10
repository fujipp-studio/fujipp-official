
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users (id) ON DELETE CASCADE,

    username VARCHAR(50),
    display_name VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    avatar_public_id VARCHAR(255),
    avatar_source VARCHAR(20) NOT NULL DEFAULT 'PROVIDER',

    profile_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT profiles_username_length_chk CHECK (
        username IS NULL
        OR char_length(username) BETWEEN 3 AND 50
    ),
    CONSTRAINT profiles_username_format_chk CHECK (
        username IS NULL
        OR username ~ '^[a-z0-9_]+$'
    ),
    CONSTRAINT profiles_display_name_length_chk CHECK (
        display_name IS NULL
        OR char_length(btrim(display_name)) BETWEEN 1 AND 50
    ),
    CONSTRAINT profiles_first_name_length_chk CHECK (
        first_name IS NULL
        OR char_length(btrim(first_name)) BETWEEN 1 AND 100
    ),
    CONSTRAINT profiles_last_name_length_chk CHECK (
        last_name IS NULL
        OR char_length(btrim(last_name)) BETWEEN 1 AND 100
    ),
    CONSTRAINT profiles_avatar_url_chk CHECK (
        avatar_url IS NULL
        OR avatar_url ~ '^https://'
    ),
    CONSTRAINT profiles_avatar_public_id_format_chk CHECK (
        avatar_public_id IS NULL
        OR avatar_public_id ~ '^[A-Za-z0-9/_-]+$'
    ),
    CONSTRAINT profiles_avatar_source_chk CHECK (
        avatar_source IN ('PROVIDER', 'CLOUDINARY')
    ),
    CONSTRAINT profiles_avatar_storage_chk CHECK (
        (
            avatar_source = 'PROVIDER'
            AND avatar_public_id IS NULL
        )
        OR (
            avatar_source = 'CLOUDINARY'
            AND avatar_url IS NOT NULL
            AND avatar_public_id IS NOT NULL
        )
    ),
    CONSTRAINT profiles_completion_chk CHECK (
        profile_completed_at IS NULL
        OR username IS NOT NULL
    )
);

CREATE UNIQUE INDEX profiles_username_lower_key
    ON public.profiles (lower(username))
    WHERE username IS NOT NULL;

COMMENT ON TABLE public.profiles IS
    'Application profile data for a Supabase Auth user.';
COMMENT ON COLUMN public.profiles.username IS
    'Unique lowercase username. It can be set once and cannot be changed.';
COMMENT ON COLUMN public.profiles.profile_completed_at IS
    'Set automatically when the user chooses a username for the first time.';
COMMENT ON COLUMN public.profiles.avatar_url IS
    'HTTPS URL used to render the current profile image.';
COMMENT ON COLUMN public.profiles.avatar_public_id IS
    'Cloudinary public ID used to replace or delete a user-uploaded profile image.';
COMMENT ON COLUMN public.profiles.avatar_source IS
    'PROVIDER for an OAuth image or CLOUDINARY for a user-uploaded image.';

CREATE FUNCTION public.prepare_profile_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.display_name := NULLIF(btrim(NEW.display_name), '');
    NEW.first_name := NULLIF(btrim(NEW.first_name), '');
    NEW.last_name := NULLIF(btrim(NEW.last_name), '');
    NEW.avatar_url := NULLIF(btrim(NEW.avatar_url), '');
    NEW.avatar_public_id := NULLIF(btrim(NEW.avatar_public_id), '');

    IF NEW.username IS NOT NULL THEN
        NEW.username := lower(btrim(NEW.username));
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'profile id cannot be changed';
        END IF;

        IF OLD.username IS NOT NULL
           AND NEW.username IS DISTINCT FROM OLD.username THEN
            RAISE EXCEPTION 'username cannot be changed';
        END IF;

        NEW.created_at := OLD.created_at;
        NEW.profile_completed_at := OLD.profile_completed_at;

        IF OLD.username IS NULL AND NEW.username IS NOT NULL THEN
            NEW.profile_completed_at := now();
        END IF;

        NEW.updated_at := now();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_prepare_write
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prepare_profile_write();

REVOKE ALL ON FUNCTION public.prepare_profile_write() FROM PUBLIC;

CREATE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    profile_display_name TEXT;
    profile_first_name TEXT;
    profile_last_name TEXT;
    profile_avatar_url TEXT;
BEGIN
    profile_display_name := NULLIF(btrim(COALESCE(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name'
    )), '');
    profile_first_name := NULLIF(
        btrim(NEW.raw_user_meta_data ->> 'first_name'),
        ''
    );
    profile_last_name := NULLIF(
        btrim(NEW.raw_user_meta_data ->> 'last_name'),
        ''
    );
    profile_avatar_url := NULLIF(btrim(COALESCE(
        NEW.raw_user_meta_data ->> 'avatar_url',
        NEW.raw_user_meta_data ->> 'picture'
    )), '');

    INSERT INTO public.profiles (
        id,
        display_name,
        first_name,
        last_name,
        avatar_url,
        avatar_source
    )
    VALUES (
        NEW.id,
        left(profile_display_name, 50),
        left(profile_first_name, 100),
        left(profile_last_name, 100),
        profile_avatar_url,
        'PROVIDER'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (
    username,
    display_name,
    first_name,
    last_name
) ON TABLE public.profiles TO authenticated;

CREATE POLICY profiles_select_own
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
