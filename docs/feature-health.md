# Feature health and startup recovery

The Packages settings page for an owned bot, and the corresponding admin page,
show installed feature health. Issues include a sanitized message, code, category,
last failure time, recovery count and next scheduled attempt. Healthy features can
be shown with **Show all**. **Configure** opens the existing license editor.

Configuration saves validate the effective saved values plus submitted changes:
required fields/secrets, Discord ID syntax, catalog schema constraints and existing
feature-specific rules. Existing encrypted secrets are retained without decrypting
or returning them. Presentation-only saves do not restart failed features. Corrected
operational configuration requeues only `ERROR / FEATURE_ACTIVATION_FAILED`
installations belonging to that license; it never replays a customer request.

## Manual startup retry

Owners use `GET /api/v1/bots/{botId}/feature-health` and
`POST /api/v1/bots/{botId}/installations/{installationId}/retry` (204).
Administrators use the same paths with `/api/v1/admin/bots/`. Both enforce bot and
installation ownership relationships. Admin paths additionally require ADMIN.
Retry requires an active unexpired license, a running desired state and a live
Runtime subscription. A conditional database update prevents duplicate retries.
Removed/disabled installations and operation failures cannot be retried here.

The confirmation checks saved configuration and reads Discord metadata using the
bot's encrypted credential. It checks configured channel/role existence and guild
membership, channel permission overwrites (everyone, combined roles, then member),
thread parent permissions and the known permissions needed by Price Reader,
Review Credit, Ticket, Shop Status and Voice Keeper. Review role assignment checks
Manage Roles and hierarchy. Other features receive channel visibility and role
existence checks; this is not an execution rehearsal or a guarantee that every
custom operation will succeed. Gateway intents, deleted messages, private thread
membership, user-specific permissions and third-party credentials can still fail
at runtime. Discord reads time out and failures leave the installation unchanged.
No Discord message, payment, payout or role assignment is sent by the check.
Permission semantics follow [Discord's permission documentation](https://docs.discord.com/developers/topics/permissions).

## Automatic recovery policy

Runner status reports accept optional `errorCategory`: `CONFIGURATION`,
`PERMISSION`, `TRANSIENT` or `INTERNAL`. Older runners remain supported through
Backend classification. Diagnostic messages are redacted before persistence and
again before display. API keys, bot tokens, connection strings and stack traces
must not appear in feature diagnostics.

Only transient **startup** failures (`FEATURE_ACTIVATION_FAILED`) on Price Reader,
Bot Presence, Review Credit and Voice Keeper are automatically requeued. The
Backend worker polls every 15 seconds and waits 30, 120 and 300 seconds for at most
three attempts. Successful activation clears the counter. Configuration and
permission errors wait for correction; internal errors need investigation. A
manual validated retry or operational config save resets the attempt counter.
Requeue only occurs for live Runtime subscriptions on bots desired RUNNING with
active licenses. Stopped, removed and expired installations stay untouched.

Financial features and all operation failures are excluded from automatic startup
recovery. Existing wallet/payout idempotency, ledgers and recovery processes remain
responsible for their own transactions. Never resubmit a transaction based solely
on a startup health message; inspect its recorded outcome.

## Delivery and checks

Apply `20261103000001_feature_error_recovery.sql` through the normal ordered VPS
PostgreSQL migration gate before releasing Backend and Runner together. It adds
nullable diagnostic fields and bounded counter metadata, and keeps the catalog
minimum for Presence rotation at 20 seconds. It does not rewrite customer settings,
upgrade feature versions or enqueue historical errors automatically. Existing
errors receive category hints when read and can be corrected/retried explicitly.

Backend tests cover configuration, ownership, HTTP authorization and permission
precedence. `FEATURE_HEALTH_INTEGRATION_TESTS=true` enables real PostgreSQL retry
SQL tests, using `STORE_TEST_DB_URL` on a disposable migrated database with
postgres/postgres credentials; fixture rows roll back. Database CI checks the
migration contract. Runner diagnostics and feature isolation tests and frontend
unit/browser tests cover the connected behavior. Frontend package health has an
explicit 250 KiB gzip JavaScript bundle profile with unchanged limits.
