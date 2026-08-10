-- Install the price-reader feature on a test bot.
-- Run this against the Supabase database (e.g. via the SQL Editor or psql).
--
-- Prerequisites:
--   1. The price-reader migration (20260803000001) has already been applied.
--   2. A bot exists in bots.bot_instances that you want to test with.
--
-- This script picks the first READY/RUNNING bot it finds. If you have multiple
-- bots, replace the sub-query with the specific bot UUID.

DO $$
DECLARE
    v_bot_id         UUID;
    v_owner_id       UUID;
    v_product_id     UUID := 'f0800000-0000-0000-0000-000000000001'; -- price-reader
    v_version_id     UUID := 'f0800000-0000-0000-0000-000000000002'; -- v1.0.0
    v_license_id     UUID := gen_random_uuid();
    v_config_set_id  UUID := gen_random_uuid();
    v_install_id     UUID := gen_random_uuid();
    v_channel_def_id UUID;
    v_pricemap_def_id UUID;
    v_markup_def_id  UUID;
BEGIN
    -- Test-only promotion: installation triggers correctly reject DRAFT
    -- versions. Production should publish through the admin workflow instead.
    UPDATE shop.feature_versions
       SET status = 'PUBLISHED', published_at = now()
     WHERE id = v_version_id
       AND status = 'DRAFT';

    -- ── 1. Find the test bot ─────────────────────────────────────────────
    SELECT id, owner_user_id
      INTO v_bot_id, v_owner_id
      FROM bots.bot_instances
     WHERE status IN ('READY', 'RUNNING', 'CREATED')
     ORDER BY created_at
     LIMIT 1;

    IF v_bot_id IS NULL THEN
        RAISE EXCEPTION 'No bot found in bot_instances. Create one first.';
    END IF;

    RAISE NOTICE 'Installing price-reader on bot % (owner %)', v_bot_id, v_owner_id;

    -- ── 2. Grant a license ───────────────────────────────────────────────
    INSERT INTO private.feature_licenses (
        id, owner_user_id, feature_product_id, acquired_version_id,
        source, status, installation_limit, granted_by
    ) VALUES (
        v_license_id, v_owner_id, v_product_id, v_version_id,
        'GRANT', 'ACTIVE', 1, v_owner_id
    );

    -- ── 3. Create a config set ───────────────────────────────────────────
    INSERT INTO private.feature_config_sets (
        id, license_id, feature_product_id, feature_version_id
    ) VALUES (
        v_config_set_id, v_license_id, v_product_id, v_version_id
    );

    -- ── 4. Install on the bot ────────────────────────────────────────────
    INSERT INTO private.bot_feature_installations (
        id, license_id, owner_user_id, bot_id,
        feature_product_id, feature_version_id, status
    ) VALUES (
        v_install_id, v_license_id, v_owner_id, v_bot_id,
        v_product_id, v_version_id, 'ACTIVE'
    );

    -- ── 5. Set config values ─────────────────────────────────────────────

    -- Look up config definition IDs.
    SELECT id INTO v_channel_def_id
      FROM shop.feature_config_definitions
     WHERE feature_version_id = v_version_id
       AND config_key = 'PRICE_READER_CHANNEL_ID';

    SELECT id INTO v_pricemap_def_id
      FROM shop.feature_config_definitions
     WHERE feature_version_id = v_version_id
       AND config_key = 'PRICE_READER_PRICE_MAP';

    SELECT id INTO v_markup_def_id
      FROM shop.feature_config_definitions
     WHERE feature_version_id = v_version_id
       AND config_key = 'PRICE_READER_NO_NITRO_MARKUP_SATANG';

    -- Channel ID: 1533829348677783602
    INSERT INTO private.feature_config_values (
        config_set_id, feature_version_id, definition_id, value
    ) VALUES (
        v_config_set_id, v_version_id, v_channel_def_id,
        '"1533829348677783602"'::jsonb
    );

    -- Price map (use the default from the migration).
    INSERT INTO private.feature_config_values (
        config_set_id, feature_version_id, definition_id, value
    ) VALUES (
        v_config_set_id, v_version_id, v_pricemap_def_id,
        '[
          {"discordPrice":209,"shopPrice":45},
          {"discordPrice":250,"shopPrice":55},
          {"discordPrice":295,"shopPrice":65},
          {"discordPrice":339,"shopPrice":75},
          {"discordPrice":359,"shopPrice":80},
          {"discordPrice":380,"shopPrice":95},
          {"discordPrice":425,"shopPrice":120},
          {"discordPrice":440,"shopPrice":120},
          {"discordPrice":459,"shopPrice":130},
          {"discordPrice":475,"shopPrice":150},
          {"discordPrice":490,"shopPrice":150},
          {"discordPrice":510,"shopPrice":160},
          {"discordPrice":539,"shopPrice":170},
          {"discordPrice":560,"shopPrice":180},
          {"discordPrice":589,"shopPrice":240},
          {"discordPrice":660,"shopPrice":240},
          {"discordPrice":689,"shopPrice":280},
          {"discordPrice":739,"shopPrice":290},
          {"discordPrice":860,"shopPrice":390}
        ]'::jsonb
    );

    -- No-Nitro markup: 1000 satang = 10 บาท.
    INSERT INTO private.feature_config_values (
        config_set_id, feature_version_id, definition_id, value
    ) VALUES (
        v_config_set_id, v_version_id, v_markup_def_id,
        '1000'::jsonb
    );

    -- ── 6. Create empty runtime state ────────────────────────────────────
    INSERT INTO private.feature_runtime_states (installation_id, bot_id)
    VALUES (v_install_id, v_bot_id);

    RAISE NOTICE 'Done! price-reader installed (installation_id = %)', v_install_id;
END;
$$;
