-- Remove only rows created by backend-perf-fixture.sql.
BEGIN;
-- Wallet ledger triggers intentionally reject deletes. This bypass is scoped to
-- this transaction and is why this script must never be run in production.
SET LOCAL session_replication_role = replica;

DELETE FROM private.bot_feature_installations
 WHERE bot_id IN (
     SELECT id FROM bots.bot_instances WHERE name LIKE 'codex-perf-bot-%'
 );

DELETE FROM private.feature_licenses
 WHERE id IN (
     SELECT md5('codex-perf-license-' || bot || '-' || feature)::uuid
       FROM generate_series(1, 100) AS bot
      CROSS JOIN generate_series(1, 10) AS feature
 );

UPDATE private.feature_config_sets
   SET validated_for_bot_id = NULL, validated_at = NULL
 WHERE validated_for_bot_id IN (
     SELECT id FROM bots.bot_instances WHERE name LIKE 'codex-perf-bot-%'
 );

DELETE FROM bots.bot_instances WHERE name LIKE 'codex-perf-bot-%';
DELETE FROM shop.feature_versions
 WHERE runtime_key LIKE 'codex-perf-feature-%';
DELETE FROM shop.feature_products WHERE code LIKE 'codex-perf-feature-%';

DELETE FROM billing.wallet_entries
 WHERE idempotency_key LIKE 'codex-perf-wallet-entry-%';

DELETE FROM billing.wallets
 WHERE customer_id IN (
     SELECT id FROM billing.customers
      WHERE user_id IN (
          SELECT id FROM auth.users
           WHERE email LIKE 'codex-perf-%@performance.invalid'
      )
 );

DELETE FROM billing.customers
 WHERE user_id IN (
     SELECT id FROM auth.users
      WHERE email LIKE 'codex-perf-%@performance.invalid'
 );

DELETE FROM auth.users
 WHERE email LIKE 'codex-perf-%@performance.invalid';

ANALYZE auth.users;
ANALYZE public.profiles;
ANALYZE private.user_accounts;
ANALYZE bots.bot_instances;
ANALYZE billing.wallet_entries;
COMMIT;
