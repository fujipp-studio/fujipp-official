CREATE TABLE private.website_effect_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    effect TEXT NOT NULL DEFAULT 'NONE'
        CHECK (effect IN ('NONE', 'HALLOWEEN', 'CHRISTMAS', 'VALENTINE')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO private.website_effect_settings (id, effect) VALUES (1, 'NONE');

ALTER TABLE private.website_effect_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.website_effect_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE private.website_effect_settings TO service_role;

COMMENT ON TABLE private.website_effect_settings IS
    'Site-wide decorative seasonal effects. Public reads and admin writes go through the backend.';
