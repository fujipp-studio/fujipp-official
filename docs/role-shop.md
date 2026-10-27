# Role Shop

`role-shop@1.0.0` sells permanent Discord roles using the same per-bot member
Wallet as `wallet-topup` and `roblox-robux-payout`. Install Wallet Top-up on the
same bot before enabling Role Shop. The catalog product and version start as
Draft so the administrator can review and publish them through the store.

## Configuration

- `ROLE_SHOP_COMMAND_NAME`: administrator panel command, default `role-shop-panel`.
- `ROLE_SHOP_PRODUCTS`: up to 25 unique `{key,name,roleId,priceSatang}` products.
  The website accepts prices in THB and stores integer satang. Product keys stay
  stable when display names change.
- `ROLE_SHOP_NOTIFICATION_CHANNEL_ID`: optional channel for successful receipts.

The bot needs Manage Roles, and its highest role must be above every role for
sale. Managed roles and the everyone role cannot be sold.

Post the panel with `/role-shop-panel`, choose a role, and confirm its price.
The panel also offers the existing Wallet top-up and balance buttons. Members
who already own the role cannot buy it again. A completed permanent purchase
also blocks another debit for the same role if an administrator later removes
that role; manually resolve such access changes rather than charging again.

Presentation slots `panel`, `confirmation`, `succeeded`, and `failed` support
Embed and Components V2 layouts through the standard designer. Runtime adds
product selection, confirmation and Wallet buttons. Available values include
`member_mention`, `product_name`, `role_mention`, `price`, `balance`, `currency`,
`product_lines`, `transaction_id`, `transaction_time`, and `failure_reason`.

## Settlement and recovery

The backend checks the active installations and current configured price and
role before charging. A row lock on `private.member_wallets` serializes purchases
with top-ups, adjustments and Roblox Payout. The debit and purchase are committed
atomically. Stable confirmation keys make retries idempotent; concurrent requests
for the same role cannot create another debit.

The runner claims the purchase before granting a single role through Discord's
idempotent role operation. Successful grants complete the purchase. Definitive
Discord failures create one compensating `ADJUSTMENT` entry, so refunds do not
inflate top-up totals. Timeouts and uncertain responses retain the purchase for
recovery instead of refunding a role that may already have been granted.

Recovery runs on startup and every 30 seconds. Processing claims become eligible
for recovery after two minutes; a new claim token prevents an old worker from
settling the current claim. Recovery fetches the member's current roles and
completes already delivered purchases without another debit or role grant.

Internal runner-token routes are under `/internal/v1/role-shop/purchases`:
`POST /`, `POST /{id}/claim`, `POST /{id}/complete`, `POST /{id}/refund`, and
`GET /recoverable`. Follow-up routes take `botId` as a query parameter; settlement
requires the current claim token.

## Verification

Runner tests: `node --import tsx --test test/role-shop.test.ts test/wallet-presentation.test.ts`.
Frontend browser checks: `bun run test:smoke role-shop.smoke.spec.ts`.

`RoleShopPostgresTests` runs only when `ROLE_SHOP_TEST_DB_URL` is supplied. Use a
new, empty local database whose name starts with `role_shop_test_`, username
`postgres` and disposable password `role-shop-test`. The suite provisions its
fixtures, runs the shipping migration, and tests concurrent debits, duplicate
requests, stale claims and idempotent refunds. Never point it at application data.

## VPS rollout (2026-10-27)

Migration `20261027000001_create_role_shop.sql` was applied to the production
VPS PostgreSQL database `migration_cutover_20261022` using the existing SSH
connection. Its version, name and source SQL were recorded in
`supabase_migrations.schema_migrations` in the same transaction.

A verified custom-format backup was retained before applying the migration, and
the migration was rehearsed against a separate copy of the production schema.
Verification confirmed that existing Wallet counts and accounting totals were
unchanged, RLS was enabled, direct client access was denied, and `fujipp_backend`
could read and write the new purchase table. Backend and PostgreSQL healthchecks
remained healthy, and Runner remained running. The temporary rehearsal database
was removed.

The SQL, atomic apply wrapper, backup and verification logs are retained in the
private VPS directory
`/opt/fujipp/apps/fujipp-postgres/migrations/role-shop-20261027/`.
The product and version remain Draft. Application deployment follows the
repository owner's pull request and reviewed-main CI/CD workflow.
