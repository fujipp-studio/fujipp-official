-- Idempotent performance fixtures for a non-production database only.
-- Every generated row is identifiable by the `codex-perf-` prefix or by a
-- deterministic UUID derived from that prefix.

INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT md5('codex-perf-user-' || n)::uuid,
       'authenticated', 'authenticated',
       'codex-perf-' || n || '@performance.invalid', '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('display_name', 'Performance User ' || n),
       now() - make_interval(secs => n), now()
  FROM generate_series(1, 10000) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO bots.bot_instances (
    id, owner_user_id, name, status, desired_state, created_at, updated_at
)
SELECT md5('codex-perf-bot-' || n)::uuid,
       md5('codex-perf-user-' || n)::uuid,
       'codex-perf-bot-' || n,
       'READY', 'STOPPED',
       now() - make_interval(secs => n), now()
  FROM generate_series(1, 100) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO shop.feature_products (
    id, code, name, description, category, status, sort_order
)
SELECT md5('codex-perf-feature-' || n)::uuid,
       'codex-perf-feature-' || n,
       'Performance Feature ' || n,
       'Performance fixture', 'PERFORMANCE', 'ACTIVE', n
  FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO shop.feature_versions (
    id, feature_product_id, version, runtime_key, status, published_at
)
SELECT md5('codex-perf-version-' || n)::uuid,
       md5('codex-perf-feature-' || n)::uuid,
       '1.0.0', 'codex-perf-feature-' || n, 'PUBLISHED', now()
  FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.feature_licenses (
    id, owner_user_id, feature_product_id, acquired_version_id,
    source, status, installation_limit, granted_by
)
SELECT md5('codex-perf-license-' || bot || '-' || feature)::uuid,
       md5('codex-perf-user-' || bot)::uuid,
       md5('codex-perf-feature-' || feature)::uuid,
       md5('codex-perf-version-' || feature)::uuid,
       'GRANT', 'ACTIVE', 1, md5('codex-perf-user-1')::uuid
  FROM generate_series(1, 100) AS bot
 CROSS JOIN generate_series(1, 10) AS feature
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.feature_config_sets (
    id, license_id, feature_product_id, feature_version_id
)
SELECT md5('codex-perf-config-' || bot || '-' || feature)::uuid,
       md5('codex-perf-license-' || bot || '-' || feature)::uuid,
       md5('codex-perf-feature-' || feature)::uuid,
       md5('codex-perf-version-' || feature)::uuid
  FROM generate_series(1, 100) AS bot
 CROSS JOIN generate_series(1, 10) AS feature
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.bot_feature_installations (
    id, license_id, owner_user_id, bot_id,
    feature_product_id, feature_version_id, status
)
SELECT md5('codex-perf-install-' || bot || '-' || feature)::uuid,
       md5('codex-perf-license-' || bot || '-' || feature)::uuid,
       md5('codex-perf-user-' || bot)::uuid,
       md5('codex-perf-bot-' || bot)::uuid,
       md5('codex-perf-feature-' || feature)::uuid,
       md5('codex-perf-version-' || feature)::uuid,
       'ACTIVE'
  FROM generate_series(1, 100) AS bot
 CROSS JOIN generate_series(1, 10) AS feature
ON CONFLICT (id) DO NOTHING;

UPDATE billing.wallets AS wallet
   SET balance_satang = 50000
  FROM billing.customers AS customer
 WHERE customer.id = wallet.customer_id
   AND customer.user_id = md5('codex-perf-user-1')::uuid;

INSERT INTO billing.wallet_entries (
    id, wallet_id, direction, entry_type, amount_satang,
    balance_before_satang, balance_after_satang,
    idempotency_key, description, created_at
)
SELECT md5('codex-perf-wallet-entry-' || n)::uuid,
       wallet.id,
       'CREDIT', 'BONUS', 1, n - 1, n,
       'codex-perf-wallet-entry-' || n,
       'Performance fixture',
       now() - make_interval(secs => 50001 - n)
  FROM generate_series(1, 50000) AS n
 CROSS JOIN billing.customers AS customer
 CROSS JOIN billing.wallets AS wallet
 WHERE customer.user_id = md5('codex-perf-user-1')::uuid
   AND wallet.customer_id = customer.id
ON CONFLICT (id) DO NOTHING;

ANALYZE auth.users;
ANALYZE public.profiles;
ANALYZE private.user_accounts;
ANALYZE bots.bot_instances;
ANALYZE private.bot_feature_installations;
ANALYZE billing.wallet_entries;
