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
   changed. Message Sets configuration and design changes update the existing
   worker and Discord client without restarting them.
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
uninstalling the feature, changing other features, credentials, or explicitly
restarting a bot still follows the usual bot restart flow.

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
`channel`, and `guild_name`, written as `{{variable}}`. Mentions do not notify
members. `SHOP_ANNOUNCEMENT_CHANNEL_ID` is optional; an empty value posts in the
command channel. The command response and any errors are private.

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
configured guild. Empty rules send announcements only. Before making changes,
the Runner resolves every affected channel and role, checks permissions, and
renders the announcement. Commands cannot run concurrently. A permission or
state-save failure attempts to restore the affected permission bits; rollback
failure explicitly asks the caller to inspect all affected channels. If sending
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
```

`RUNTIME_BOOTSTRAP_CACHE_TTL` bounds how long changes made outside the runtime
state endpoint may take to reach a Runner. Runtime state writes invalidate the
cached snapshot immediately. Keep the TTL short enough for operational control;
Redis is unnecessary while a single Backend instance owns the cache.

Generate production secrets independently:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Use the Base64 value for `STORE_SECRET_KEY_BASE64` and the hexadecimal value
for `RUNNER_API_TOKEN`.

## Production deployment

Copy `deploy/.env.example` to `deploy/.env`, set every required value, then run:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
```

The default limits reserve at most 2 GiB for Backend, 1.5 GiB for Runner, and
128 MiB for Caddy. PostgreSQL is assumed to be Supabase or another external
service; it is deliberately not duplicated on the 8 GiB VPS.

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
