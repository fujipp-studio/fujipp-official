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
4. The Runner polls `GET /internal/v1/runtime/bootstrap` every 30 seconds.
5. The Runner starts, stops, or reloads only bots whose runtime fingerprint
   changed.
6. Runtime status is reported to `POST /internal/v1/runtime/status`.

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
or stage channel. Its guild-only slash command is restricted to administrators:

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
```

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
