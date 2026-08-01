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
- only the Discord intents it needs;
- an `activate` method returning a cleanup function.

Register a module once in `bot-runner/src/feature-registry.ts`. Do not copy a
feature directory per user, bot, license, or installation.

The included `welcome-message` module is the minimal working example. A module
must unregister event listeners and release timers/resources in its cleanup
function.

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
