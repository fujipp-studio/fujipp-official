# Bot Runtime

## Architecture

One Node.js process owns multiple Discord clients. Feature modules are bundled
once in the Runner image and shared by every eligible bot; only configuration,
secrets, presentation values, and Discord client state are per bot.

The production stack uses Docker Compose rather than PM2. Docker owns restart
policy and process isolation, so running PM2 inside the Runner container would
duplicate supervision without improving availability.

## Runtime flow

1. A user creates a bot with `POST /api/v1/bots`.
2. The user stores its Discord token with the protected credential endpoint.
3. The user installs purchased features and configures them.
4. The Runner polls `GET /internal/v1/runtime/bootstrap` every 30 seconds and
   reuses the response ETag. Unchanged snapshots return `304 Not Modified`.
5. The Backend keeps the assembled snapshot in memory for 60 seconds by
   default, avoiding repeated Supabase reads while the runtime is unchanged.
6. The Runner starts, stops, or reloads only bots whose runtime fingerprint
   changed. Embed and Components V2 design changes update active features inside
   the existing worker and Discord client. Message Sets also supports live
   configuration changes.
7. Runtime status is reported to `POST /internal/v1/runtime/status`.

Feature modules can persist a small non-secret operational state with
`PUT /internal/v1/runtime/state`. The state is limited to a 16 KiB JSON object,
belongs to one active installation, and is returned as `runtimeState` during
bootstrap. This is intended for Discord resource IDs that must survive a
Runner or container restart; credentials must continue to use encrypted
feature secrets.

The browser cannot call the Internal Runtime API and can never retrieve a
plaintext Discord token or feature secret. Internal endpoints require
`X-Runner-Token`, should only be reachable over the private Docker network, and
must use a long random token shared by Backend and Runner.

## Live message designs

Saving only a feature's Embed or Components V2 presentations reaches the running
bot on the next runtime poll, normally within 30 seconds. Switching between the
two formats, replacing fields or images, and resetting a design to its default
all use the existing worker and Discord connection. Active feature listeners,
voice connections, pending sessions, and scheduled work remain in place.
Every active feature receives a stable, read-only presentation view; the next
message it renders reads the latest saved definitions, including newly added
slots and removal of old slots. The reload itself does not rewrite already
posted messages. Features that already refresh saved panels keep doing so using
the latest designs; other posted messages retain their designs until explicitly
updated or resent through the feature's supported commands.

Configuration revisions and presentations do not by themselves require a
restart. Changes to a feature's operational configuration or secrets still
restart the bot unless that module implements full hot reload, as Message Sets
does. Changing configuration and a design in the same save still follows that
configuration's restart rules. Installing, uninstalling, or changing a feature
version, changing Discord credentials or guild, explicitly restarting, and
recovering an invalidated Discord session retain the normal restart behavior.
A feature that failed activation must activate successfully before it can use
live designs; another unchanged failed feature does not block updates to
healthy features.

The supervisor sends presentation updates over IPC and acknowledges them only
after the worker applies the update. Unacknowledged or failed updates retry on
later polls, including unchanged bootstrap responses. Deploy the updated Runner
image for both supervisor and workers; this change requires no Backend,
Frontend, or database migration.

## Store a Discord token

```http
PUT /api/v1/bots/{botId}/credentials/discord-token
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "token": "discord-bot-token"
}
```

Response: `204 No Content`. The token is encrypted with the same versioned
AES-256-GCM key used by feature secrets. It is only decrypted while producing a
Runner bootstrap response.

## Feature package contract

Feature code lives under `bot-runner/src/features`. Each module exports one
`FeatureModule` containing:

- a stable `runtimeKey` matching `shop.feature_versions.runtime_key`;
- an exact semantic `version` matching `shop.feature_versions.version`;
- only the Discord intents it needs;
- an `activate` method returning a cleanup function.

Register a module once in `bot-runner/src/feature-registry.ts`. Do not copy a
feature directory per user, bot, license, or installation.

The registry resolves an exact `runtimeKey@version` pair. A version absent from
the Runner image is rejected with `FEATURE_VERSION_NOT_BUNDLED`; the Runner
must never silently execute newer Feature code for an older installation.

The included `welcome-message` module is the minimal working example. A module
must unregister event listeners and release timers/resources in its cleanup
function.

## Voice Keeper

The bundled `voice-keeper` module keeps one connection open to a Discord voice
or stage channel. Its globally registered slash command is usable only in the
configured guild and is restricted to administrators:

- `/<COMMAND_NAME> join channel` connects to a channel selected through
  Discord's channel picker and remembers its ID;
- `/<COMMAND_NAME> leave` disconnects and clears the remembered channel.

On startup the feature restores the remembered connection automatically.
`COMMAND_NAME` defaults to `voice`; `SELF_MUTE` and `SELF_DEAF` both default to
`true`. The bot requires View Channel and Connect permissions in the selected
channel. Keeping `SELF_DEAF` enabled avoids receiving voice packets and is the
lowest-overhead mode for a presence-only connection.

## Bot Presence

The bundled `bot-presence@1.0.0` module changes only the bot's own presence and
therefore requires no privileged `GuildPresences` intent. Configuration fields
are `PRESENCE_STATUS`, `PRESENCE_ACTIVITY_TYPE`, `PRESENCE_TEXTS`, and
`PRESENCE_ROTATE_SECONDS`. One activity text is static; multiple texts rotate
in order. Rotation is limited to 20 seconds or slower to stay comfortably below
Discord presence update limits, and the timer is released when the Feature is
stopped.

## Review Credit

The bundled `review-credit@1.0.0` module counts non-bot messages in one review
channel and persists the count and latest reply ID in installation runtime
state. It can add reactions, select a random reply, grant an optional reviewer
role, and update a `{count}` channel-name template. Renames are batched to at
most once every five minutes. The global `/<REVIEW_COMMAND_NAME>` command has
`recount` and `refresh` subcommands; both are enforced as administrator-only by
the Runner.

`review-credit@1.1.0` also counts webhook messages in real time and during
`recount`; ordinary bot messages remain excluded so the Feature cannot count
its own automated replies. Administrators can replace the persisted count with
`/<REVIEW_COMMAND_NAME> set-count count:<number>`. The channel name is updated
immediately after a manual change. `REVIEW_COUNT_WEBHOOKS` defaults to `true`
and can disable webhook counting when required.

## Message Sets

Version `message-sets@1.1.0` uses `/<command> send set:<SET name>` and
`/<command> update message_id:<message ID> set:<SET name>`. Update edits a message
in the current channel authored by this bot, excluding webhooks. It replaces the
content, embeds, components, and attachments using the selected SET's latest
design. Bot Permissions supports `<command>/send` and `<command>/update`
separately. Components V2 messages require a Components V2 SET for updates.
Responses remain private. The new catalog version starts as DRAFT; existing
1.0.0 installations keep their original command format until upgraded.

The bundled `message-sets@1.0.0` feature sends named messages designed with the
website's existing Embed and Components V2 editors. `MESSAGE_SETS_COMMAND_NAME`
defaults to `ec` and accepts 1–32 lowercase letters, digits, underscores, or
hyphens. Use `/<command> set:<SET name>` to send a message in the current channel.
The SET is posted as an ordinary bot message without a public command attribution
header. Only the command caller receives the private success or failure response.
Administrators can post by default; Bot Permissions can allow additional roles
or users.

`MESSAGE_SETS` stores up to 20 unique names and stable `set_1` through `set_20`
presentation slots. The website, Backend, and Runner validate the limit and
uniqueness. SET names support spaces and Thai text, with at most 100 characters.
Autocomplete reads the current SET list; stale or deleted names receive a
private error instead of posting a message. Message variables are `set_name`,
`user`, `user_name`, `channel`, and `guild_name`; mentions do not notify users.

Components V2 Action Rows must have 1–5 children (up to five buttons or a single
select). The website and Backend reject missing, empty, or oversized rows before
saving, including rows inside Containers and designs edited as JSON. The Runner
checks saved designs again before sending and returns a private error identifying
the invalid row. Repair previously saved invalid rows by deleting empty rows or
moving extra buttons into another row; no buttons are silently removed.

Individual SET send and private confirmation failures retain the installation's
`ACTIVE` status while recording `last_error_code` and `last_error_message`.
Autocomplete and other SETs remain available. The caller receives the failure
response before the Runner waits for the diagnostic API. The Backend also loads
legacy Message Sets installations left in `ERROR` by `MESSAGE_SET_SEND_FAILED` or
`MESSAGE_SET_ACK_FAILED` and permits their runtime state to be saved during
recovery. Disabled installations and other feature errors remain excluded.
Deploy the updated Frontend, Backend, and Runner for these guards and recovery;
this fix requires no database migration.

Saving SET additions, deletions, names, formats, or message designs normally
reaches the Runner on its next 30-second poll. The supervisor sends an IPC update
to the running bot worker. The worker updates the SET snapshot and acknowledges
success. Failed updates are retried on later polls, including unchanged bootstrap
responses. Renaming the command registers its replacement and removes the old
command owned by the feature; Discord may take time to display the renamed global
command. A name already owned by another feature is rejected without replacing
that feature’s command. Existing posted messages keep their original design.

The first deployment requires the migration, Backend, and updated Runner image.
The migration creates a draft catalog entry; publish its version and activate
the product through the admin tools before granting/installing it. Installing or
uninstalling the feature, changing operational configuration of features without
full hot reload, changing credentials, or explicitly restarting a bot still
follows the usual bot restart flow. Design-only changes use live updates across
active features.

## Member Spending Card recovery

Member Spending registers its interaction listener before connecting to an
external database. Commands acknowledge Discord before database work, share a
pending connection attempt, and retry initialization on the next command if it
fails. A database failure is returned through the acknowledged interaction.

Older `member-spending@1.0.0` installations left in `ERROR` with
`FEATURE_ACTIVATION_FAILED` are included in bootstrap for the updated Runner to
reactivate. This recovers cases such as a temporary Neon DNS failure during the
old eager initialization. Recovery still requires an active, unexpired license,
an existing configuration, and an installation that has not been removed or
disabled. Other errors and other module versions remain excluded.

Deploy the Backend recovery filter together with the Runner's lazy database
initialization. Existing affected installations recover without a database
migration or reinstallation. The package settings page displays the selected
bot installation's status; an active license alone does not indicate that its
Feature is running.

## Member Spending Card monthly tracking

`SPENDING_MONTHLY_ENABLED` is an opt-in switch (default false). Every
`/spending add` credits the lifetime balance; while enabled, it also credits the
current monthly cycle atomically. While disabled, no new monthly balance is
recorded, and existing monthly history and lifetime totals remain intact.
Enabling later resumes the current cycle without backfilling purchases made
while disabled. Retrying an earlier operation never backfills or duplicates it.
Undated balances saved before this update remain in lifetime totals only.
Both Fujipp storage and customer PostgreSQL support the same behavior.

`SPENDING_MONTHLY_START_DAY` selects day 1–31 (default 1). Cycles start at 00:00
in `Asia/Bangkok`; when a month has fewer days than selected, its last day is
used. For example, day 25 makes the October cycle run from October 25 through
November 24. Day 31 starts on February 28, or February 29 in a leap year, then
starts the next cycle on March 31. The stored `YYYY-MM` label names the month in
which a cycle starts. Changing the day affects future additions and does not
redistribute previous balances. The Backend reads these controls from the saved
Member Spending configuration; the customer database adapter receives the same
settings from its active feature configuration.

- `/spending check` shows the member's lifetime and current-month balances.
- `/spending list period:this_month` shows this month's ranking.
- `/spending list month:2026-10` shows the selected month's ranking.
- `/spending total period:this_month` sums this month's spending across members.
- `/spending rank period:this_month` refreshes monthly Top 1 / Top 2–5 roles.

Omitting the period keeps the existing lifetime behavior. Monthly command
options are available only while tracking is enabled; stale monthly requests
receive an explanation that tracking is disabled. `month:YYYY-MM` overrides
`period` and is also available on `check`, `total`, and `rank`.
Viewing a historical ranking never changes current-month roles.
`/spending update` sets the lifetime amount/count and, while monthly tracking is
enabled, applies each difference to the current cycle in the same transaction.
For example, changing a lifetime balance from 1,000 to 1,200 THB adds 200 THB
to this cycle; reducing it reverses the difference. Count corrections follow
the same rule, and blank fields stay unchanged. Previous cycles are preserved.
If either current-cycle amount or count would become negative, the entire
correction is rejected without changing balances or recording an operation.
With monthly tracking disabled, corrections affect lifetime totals only.
Retries never apply the difference twice, including across cycle boundaries
or changes to the tracking switch. `/spending delete` removes the member's
balances across all months and records a compensating operation.

Cards support `{{this_month}}` (THB), `{{this_month_count}}`, and `{{month}}`
(the current cycle's `YYYY-MM`) in both Embed and Components V2. While tracking
is disabled, the monthly amount/count are zero and `{{month}}` is blank.
Existing `{{total}}` and `{{count}}` remain lifetime values. The separate `monthly_leaderboard` presentation supports
`{{leaderboard_lines}}`, `{{member_count}}`, and `{{month}}`.

Monthly tracking does not require roles. `SPENDING_MONTHLY_ROLES_ENABLED`
defaults to false. When enabled, configure either optional
`SPENDING_MONTHLY_TOP1_ROLE_ID` or `SPENDING_MONTHLY_TOP5_ROLE_ID`, using roles
separate from lifetime ranks, first-purchase rewards, and spending levels.
`SPENDING_MONTHLY_ROLES_RESET` defaults to true: roles follow the current
ranking and are removed when a member leaves it, the next cycle starts, or
monthly tracking is disabled. Set it to false to retain previously earned roles,
including while monthly tracking is disabled. Synchronization runs on startup,
after adds/updates/deletes, when viewing the current ranking, and every minute while
the bot is online. Offline bots reconcile after reconnecting. Discord role
hierarchy and Manage Roles permission must allow the configured changes.

After a spending write, the card and saved-balance confirmation are sent before
ranking role synchronization. The private confirmation shows that roles are
pending, then reports completion or a partial-success warning without asking
for the balance to be entered again. Adds, corrections, and deletions refresh
lifetime ranking roles as well as monthly roles; corrections also reconcile the
member's purchase and tier roles. Lifetime and monthly ranks share one paginated
REST member scan per write. Role work is serialized per guild, with ranking
reads inside the queue, so overlapping writes and scheduled refreshes cannot
apply an older ranking after a newer one. A failed role change does not prevent
other roles or members from being processed. Missing roles, insufficient Manage
Roles permission, and unmanageable role hierarchy are reported instead of being
silently skipped. Monthly roles retry during the next scheduled refresh;
`/spending rank` and `/spending rank period:this_month` can refresh the respective
ranking roles without repeating a balance write.

Deploy migrations `20261026000001_member_spending_monthly.sql` and
`20261026000002_member_spending_monthly_options.sql` to the active VPS database
before the Backend, Frontend, and Runner update. Deploy the Backend and Runner
together: writes require an operation key, supplied from the Discord interaction ID. Retrying
the same operation cannot credit either balance twice. The operation ledger
is append-only; corrections record deltas. Customer databases provision their
monthly tables automatically using the saved connection owner. The private
platform tables are accessed only through the Backend.

To run the PostgreSQL store contract against a disposable test database, set
`SPENDING_TEST_DB_URL` and run
`node --import tsx --test test/member-spending-store.integration.test.ts` from
`bot-runner/`. The test provisions the customer schema and removes its own
randomly scoped fixtures afterward.

Backend PostgreSQL integration tests use `SPENDING_PLATFORM_TEST_DB_URL`
(JDBC URL), `SPENDING_PLATFORM_TEST_DB_USER`, and
`SPENDING_PLATFORM_TEST_DB_PASSWORD`. Provide a new, empty disposable database
whose name starts with `spending_correction_test_`; the test refuses application
databases. Run `./mvnw --batch-mode test` from `backend/` and remove the disposable
database afterward. These tests cover concurrent corrections, ledger rollback,
retry recognition, disabled tracking, and preservation of previous cycles.

## Ticket

For private ticket channels, topic dropdowns, optional forms and automatic
closing, see [Ticket](ticket.md). Ticket is bundled as `ticket@1.0.0`.

## Shop Status

The bundled `shop-status@1.0.0` feature registers `/shop open` and `/shop close`.
`SHOP_COMMAND_NAME`, `SHOP_OPEN_COMMAND`, and `SHOP_CLOSE_COMMAND` customize all
three names (1–32 lowercase letters, digits, `_`, or `-`); subcommand names must
be different. Administrators have access by default. Bot Permissions can grant
access to the configured root command or each configured subcommand separately.
A command owned by another feature is never replaced. Renaming removes the
previous command recorded in this installation's runtime state.

Each action has its own `SHOP_OPEN_MESSAGE_TYPE` / `SHOP_CLOSE_MESSAGE_TYPE`:
`TEXT` uses the corresponding `SHOP_OPEN_TEXT` / `SHOP_CLOSE_TEXT` (up to 2000
characters); `DESIGNED` uses `shop_open` / `shop_close` in the existing Embed or
Components V2 designer. Supported variables are `status`, `user`, `user_name`,
`channel`, and `guild_name`, written as `{{variable}}`. Mentions are suppressed by
default. `SHOP_ANNOUNCEMENT_CHANNEL_ID` is optional; an empty value posts in the
command channel. The command response and any errors are private.

`SHOP_OPEN_ALLOW_EVERYONE_MENTIONS` and `SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS`
independently opt in to `@here` / `@everyone` pings. Both default to `false`,
including existing installations. Write the mention in plain announcement text,
message content accompanying an Embed, or a Components V2 Text Display block;
enabling the setting does not insert a mention automatically. Embed titles and
descriptions cannot trigger pings. User pings remain suppressed, as do private
command replies and announcements from other features.

`SHOP_OPEN_ALLOW_ROLE_MENTIONS` and `SHOP_CLOSE_ALLOW_ROLE_MENTIONS` separately
allow Role pings, defaulting to `false`. Write `<@&ROLE_ID>` in announcement text
or a Components V2 Text Display. Only roles mentioned in that action's rendered
text are allowed, with duplicates removed and at most 100 roles per announcement.
Embed titles, descriptions, button labels and URLs do not authorize Role pings.
The Role must exist in the configured server and be mentionable, or the bot must
have Mention Everyone in the destination channel. Missing or unmentionable Roles
are reported before applying the shop status, channel name, or permission changes.
Role pings can be enabled while `@here` / `@everyone` remain disabled, and vice versa.
Neither switch inserts tags automatically.

When everyone pings are enabled, the bot needs Mention Everyone in the
announcement channel. Missing permission is reported before changing the shop status, channel name, or channel
permissions. See [Discord's allowed mention rules](https://docs.discord.com/developers/resources/message#allowed-mentions-object)
and [Text Display mentions](https://docs.discord.com/developers/components/reference#text-display).
For a fresh notification on each command, use `NEW` or `REPLACE` delivery instead
of relying on edits to an existing announcement. Members' own Discord notification
settings still apply.

`SHOP_OPEN_CHANNEL_NAME` and `SHOP_CLOSE_CHANNEL_NAME` optionally rename the
announcement channel for each action, for example `🟢・สถานะ・ร้านเปิด` and
`🔴・สถานะ・ร้านปิด`. Empty values keep the current name; setting only one does
not automatically restore the old name for the other action. Names accept up to
100 characters, including Thai and emoji, without tabs or line breaks. The same
destination as the announcement is used, including the command channel fallback.
The bot requires Manage Channels, or Manage Threads for a thread. The Runner
fetches the current channel and skips a rename when the name already matches.
Discord can normalize text channel names and rate-limit channel edits; see
[Discord's channel modification rules](https://docs.discord.com/developers/resources/channel#modify-channel).

`SHOP_OPEN_DELIVERY_MODE` and `SHOP_CLOSE_DELIVERY_MODE` independently choose
`NEW` (default, always send), `UPDATE` (edit the latest announcement), or
`REPLACE` (delete it before sending again). Both actions share the latest
announcement reference for this installation, persisted across restarts. A missing
message or a different destination starts a new announcement. Fetch/edit/delete
permission failures are reported without silently sending duplicates. The bot
needs Read Message History to retrieve the previous announcement.

When editing, obsolete content, embeds, components, and attachments are cleared.
Discord cannot remove a message's Components V2 flag, so updating from Components
V2 to text/Embed replaces the message instead. See [Discord's edit-message rules](https://docs.discord.com/developers/resources/message#edit-message).
A failed reference save is reported after posting and may cause a new message
following a restart. Entering either designer keeps the local settings draft;
only confirming Save all submits configuration changes to the runtime.

`SHOP_PERMISSION_RULES` optionally contains up to 25 unique channel/role pairs:

```json
[
  {
    "channelId": "111111111111111111",
    "roleId": "222222222222222222",
    "open": { "ViewChannel": "ALLOW", "SendMessages": "ALLOW" },
    "close": { "SendMessages": "DENY" }
  }
]
```

The role ID can be the server ID for `@everyone`. Allowed permission keys are
`ViewChannel`, `SendMessages`, and `Connect` (voice/stage channels only). Values
are `ALLOW`, `DENY`, `INHERIT` (clear that permission's channel overwrite), and
`KEEP` (leave unchanged, also the default for omitted keys). Opening applies
its configured settings; it does not restore a historical snapshot. Discord's
other role/member overwrites and Administrator bypass continue to apply.
`Connect` denies new voice connections; it does not disconnect existing members.

The bot needs Manage Roles in each affected channel and the appropriate
announcement permissions. Rules target individual non-thread channels in the
configured guild. Empty rules still allow announcements and optional channel
renames. Before making changes, the Runner resolves every affected channel and role, checks permissions, and
renders the announcement. Commands cannot run concurrently. A permission,
rename, or state-save failure attempts to restore the affected permission bits and
any attempted channel rename; rollback failure explicitly asks the caller to
inspect all affected channels. If sending
the announcement fails after the status is saved, the private response explains
that permissions changed but the announcement failed. A restart does not replay
old permission changes or announcements. Configuration changes use the normal
bot restart flow on the next runtime poll.

Deploy the migration, Backend, Frontend, and Runner together. The migration
creates a draft product/version; publish the version and activate the product
through the existing admin tools before offering or installing the feature.

## Local build

```bash
cd bot-runner
npm install
npm test
npm run build
```

Required Runner environment:

```text
BACKEND_API_URL=http://backend:8080
RUNNER_API_TOKEN=<same-long-random-token-as-backend>
RUNTIME_POLL_INTERVAL_MS=30000
RUNTIME_BOOTSTRAP_CACHE_TTL=60s
RUNTIME_FEATURE_DATA_CACHE_TTL=5m
```

The two cache TTL settings belong to the Backend environment, not the Runner.
`RUNTIME_BOOTSTRAP_CACHE_TTL` keeps the snapshot refresh interval at 60 seconds.
Runtime eligibility, feature expiry, configuration revisions, and saved runtime
state are checked again on refresh. State writes invalidate the snapshot
immediately. Expiry reconciliation invalidates caches only when expiry or a
successful renewal actually changes a subscription.

`RUNTIME_FEATURE_DATA_CACHE_TTL` limits reuse of large feature configuration,
encrypted secrets, and presentation definitions to five minutes. A changed
configuration revision reloads that feature's data; explicit application changes
invalidate both caches. State-only writes reuse unchanged feature data. Changes
to definitions made outside the application may take up to the feature-data TTL
plus a snapshot refresh to appear. Removed features are dropped from the cache.
Do not increase the snapshot TTL to save bandwidth: keep expiry/state checks
frequent and tune the feature-data TTL instead.

The existing `runtime.bootstrap.cache`, `runtime.bootstrap.load`, and
`runtime.bootstrap.payload.bytes` metrics plus
`runtime.bootstrap.config.reloads` (number of feature configurations reloaded per
snapshot) can be read through the authenticated metrics endpoint. Compare these
with Supabase's Database/Shared Pooler Egress before and after deployment; payload
size at the Backend is not a measurement of Supabase wire traffic.

My Bots and Bot Settings poll visible pages every 15 seconds. Hidden tabs stop
polling, returning to the tab refreshes immediately, and user actions still
refresh their results immediately. Redis is unnecessary for a single Backend
instance.

Generate production secrets independently:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Use the Base64 value for `STORE_SECRET_KEY_BASE64` and the hexadecimal value
for `RUNNER_API_TOKEN`.

## Production deployment

GitHub Actions selects Backend/Runner changes, compiles once, publishes the tested
artifacts and performs scoped health-checked rollout/rollback. See
[Backend and Runner delivery](backend-delivery.md) for the service map, readiness
checks, first-rollout behavior and local rehearsals.

Copy `deploy/.env.example` to `deploy/.env`, set every required value, then run:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
```

The default limits reserve at most 2 GiB for Backend, 1.5 GiB for Runner, and
128 MiB for Caddy. Production database placement is configured through DB_URL. A separate 1 GiB
PostgreSQL stack and migration rehearsal are documented in
[deploy/postgres](../deploy/postgres/README.md). Installing that stack does not
switch production away from Supabase.

Do not expose `/internal/v1/runtime/**` through a public ingress in a later
multi-host deployment. Replace the shared token with workload identity or
mutual TLS before allowing Runtime traffic across an untrusted network.
# Runtime security and process isolation

The runtime container starts one supervisor process and one Node child process
per Discord bot. Only the supervisor receives `RUNNER_API_TOKEN`. Bot workers
receive the configuration for their own bot over local IPC and call backend
operations through an allow-listed RPC bridge that verifies the worker bot ID.

Each worker has an independent V8 heap limit configured with
`BOT_WORKER_MAX_OLD_SPACE_MB` (256 MB by default). A crashed worker is reported
as `CRASHED` and restarted with exponential backoff. Five crashes within five
minutes open the crash-loop circuit and leave that bot stopped until its desired
configuration changes or the runner restarts. On Linux, workers increase their
OOM score so the kernel prefers terminating a worker instead of the supervisor.

Runner credentials support zero-downtime rotation. Put the new value in
`RUNNER_API_TOKEN`, temporarily put the old value in
`RUNNER_API_PREVIOUS_TOKEN`, deploy the backend, roll all runners, then remove
the previous token and deploy the backend again. Internal routes remain blocked
at Caddy and are reachable only on the private Compose network.

Customer PostgreSQL connections are resolved before use, reject private and
special-use networks, and pin sockets to the validated public IP addresses.
Production hosts should additionally enforce outbound firewall rules because
application validation is not a replacement for infrastructure egress control.
