# Authentication API Contract

## Ownership

- Supabase Auth owns email/password authentication, OAuth, sessions, refresh
  tokens, and provider configuration.
- The frontend obtains a Supabase access token and sends it to the Backend as a
  bearer token.
- The Backend validates the token signature and issuer, then loads the
  application role and account status from PostgreSQL.
- The Backend never receives provider client secrets, user passwords, or
  refresh tokens.

## Authenticated request

```http
Authorization: Bearer <supabase-access-token>
```

Every protected endpoint applies these checks:

1. The JWT is valid and was issued by the configured Supabase project.
2. The JWT `sub` is a UUID with a matching profile and application account.
3. The account status is `ACTIVE`.
4. The database role is added as `ROLE_USER`, `ROLE_TESTER`, `ROLE_EDITOR`, or
   `ROLE_ADMIN`.

Accounts with `SUSPENDED`, `BANNED`, or `DEACTIVATED` status receive
`403 Forbidden`.

Authenticated API requests are rate limited per user. Local defaults are 120
read requests and 30 write requests per minute. Exceeding a limit returns
`429 Too Many Requests` with `Retry-After`, `X-RateLimit-Limit`, and
`X-RateLimit-Remaining` headers.

## Endpoints

### Get the current authenticated user

```http
GET /api/v1/auth/me
```

```json
{
  "id": "7e1d4fb6-0bb5-4b7b-91d9-31cdbd3d1144",
  "email": "user@example.com",
  "role": "USER",
  "status": "ACTIVE",
  "username": "fujipp",
  "displayName": "Fujipp",
  "firstName": null,
  "lastName": null,
  "avatarUrl": "https://example.com/avatar.png",
  "profileCompletedAt": "2026-07-29T01:00:00+07:00"
}
```

### Get the current profile

```http
GET /api/v1/auth/me/profile
```

### Replace editable profile fields

```http
PUT /api/v1/auth/me/profile
Content-Type: application/json
```

```json
{
  "displayName": "Fujipp",
  "firstName": "Fuji",
  "lastName": "PP"
}
```

Sending `null` clears an optional field. Maximum lengths are 50 characters for
`displayName` and 100 characters for `firstName` and `lastName`.

### Set the username

```http
PUT /api/v1/auth/me/username
Content-Type: application/json
```

```json
{
  "username": "fujipp"
}
```

A username:

- can only be set once;
- must contain 3 to 50 lowercase letters, digits, or underscores;
- must be unique, case-insensitively;
- must not be in the reserved username list.

## Error format

Errors use `application/problem+json`.

```json
{
  "type": "about:blank",
  "title": "Username is unavailable",
  "status": 409,
  "detail": "Choose a different username",
  "reason": "TAKEN"
}
```

Username conflict reasons are `TAKEN` and `RESERVED`. Attempting to replace an
existing username returns `409` with the title `Username already set`.

Validation errors return:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more request fields are invalid",
  "errors": {
    "username": "must match \"^[a-z0-9_]+$\""
  }
}
```

## Frontend authentication flow

The frontend uses Supabase Auth for:

- email/password sign-up and sign-in;
- Google OAuth;
- Discord OAuth;
- GitHub OAuth;
- session refresh and sign-out.

After a successful session is available, the frontend calls
`GET /api/v1/auth/me`. A `401` means the session must be refreshed or the user
must sign in again. A `403` means the session is valid but the application
account cannot access the system.

## Administrator impersonation

An active `ADMIN` can open **Admin → Users → Act as user**, review the selected
account and confirm. The frontend opens My Bot using the target's identity and
permissions. A persistent banner names the target, shows the expiry time, and
provides **Return to admin**. All active non-admin roles may be selected; self and
other administrator accounts are rejected by the Backend.

```http
POST /api/v1/admin/impersonations
Authorization: Bearer <administrator-supabase-access-token>
Content-Type: application/json

{"userId":"<target-user-uuid>"}
```

The response is `200` with `{token, expiresAt, user}` and `Cache-Control: no-store`.
`user` uses the current-user contract above. The cryptographically random token is
an opaque capability, not a Supabase login/session or a target access token.
Subsequent authenticated Backend requests carry both the administrator bearer
credential and `X-Impersonation-Token: <token>`. The Backend rechecks both accounts
and the administrator's database role on every request, then uses only the target
subject, email and current database role. Administrator roles/scopes/metadata are
removed. The real administrator identity is projected before this substitution;
synthetic target tokens never enter the identity projection. Existing ownership
checks and rate limits apply to the target, including writes. An invalid or expired
capability returns `403` with `reason: IMPERSONATION_ENDED`; requests never fall
back to administrator privileges or retry a write under another identity.

```http
DELETE /api/v1/admin/impersonations
Authorization: Bearer <administrator-supabase-access-token>
X-Impersonation-Token: <token>
```

Stopping is idempotent and returns `204`. This exact DELETE route validates the
real administrator so it remains usable while acting as a user. All other routes,
including admin endpoints and nested impersonation attempts, use the effective
target permissions. Starting a new session replaces that administrator's previous
capability; another administrator cannot use it, and an old tab cannot revoke its
replacement.

Sessions expire after 15 minutes. The current deployment has one Backend process;
capabilities are stored only as hashes in its bounded in-memory registry. A Backend
restart invalidates them. This implementation must move to a shared session store
before scaling Backend replicas. The frontend keeps its capability in memory only:
full-page reload returns to the real administrator, while the abandoned capability
expires on the server. SPA navigation and Supabase token refresh preserve the
active mode. Entry/exit abort pending requests, reject stale session snapshots,
clear account query caches and remount routed views so private data cannot cross
identities. Password changes and password-reset emails are unavailable in this
mode because Supabase still authenticates the administrator.

`IMPERSONATION_STARTED`, `IMPERSONATION_STOPPED`, `IMPERSONATION_REQUEST` and
`IMPERSONATION_RESULT` events record the real actor and target in the existing
append-only security audit log. Each request must persist an authorization event
before reaching a controller; audit failure blocks the operation. A separate result
event records the HTTP status where available; request/result pairs share an
`operationId` in their details. The request log includes method and
path, never request bodies, query strings, passwords or capabilities. Started events
include the expiry time; expiration/restart requires no background cleanup job.

Coverage lives in `ImpersonationServiceTests`, `ImpersonationControllerTests`,
`frontend/src/__tests__/Impersonation.spec.ts` and
`frontend/e2e/impersonation.smoke.spec.ts`. Shared authentication changes retain full
Backend/Runner compatibility checks and full frontend coverage via the CI maps.

## Configuration

Local Backend configuration points to:

```properties
spring.security.oauth2.resourceserver.jwt.issuer-uri=http://127.0.0.1:54321/auth/v1
spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://127.0.0.1:54321/auth/v1/.well-known/jwks.json
```

Production requires:

```text
SUPABASE_URL
DB_URL
DB_USERNAME
DB_PASSWORD
APP_CORS_ALLOWED_ORIGINS
APP_RATE_LIMIT_READ_PER_MINUTE
APP_RATE_LIMIT_WRITE_PER_MINUTE
```

The default expected JWT audience is `authenticated` and the default signing
algorithm is `ES256`. They can be overridden with `SUPABASE_JWT_AUDIENCE` and
`SUPABASE_JWT_ALGORITHMS` when migrating an older Supabase project.

`APP_CORS_ALLOWED_ORIGINS` is a comma-separated allowlist of frontend origins.
The local default allows only `http://localhost:5173` and
`http://127.0.0.1:5173`. Production must set the deployed frontend origin.

Google, Discord, and GitHub client credentials belong in the Supabase project
configuration, not in the Backend environment.

## Security audit log

Trusted Backend operations append security events to
`private.security_audit_log`. The current events are:

- `ACCOUNT_ACCESS_DENIED`;
- `RATE_LIMIT_EXCEEDED`;
- `USERNAME_SET`;
- `IMPERSONATION_STARTED`, `IMPERSONATION_STOPPED`, `IMPERSONATION_REQUEST`,
  `IMPERSONATION_RESULT`.

The table is append-only and unavailable to `anon` and `authenticated` database
roles. Audit records must never contain passwords, access tokens, refresh
tokens, provider secrets, or other authentication credentials.

## Email confirmation

For convenient local development, `supabase/config.toml` currently has:

```toml
[auth.email]
enable_confirmations = true
```

An email/password signup requires the user to open the confirmation email before
signing in. Local confirmation messages appear in Mailpit at
`http://127.0.0.1:54324`. OAuth provider emails are verified according to the
provider flow and do not use this email/password confirmation message.

Local email/password sign-up and sign-in are protected by Cloudflare Turnstile.
The committed local configuration uses Cloudflare's official always-pass test
keys. Production must use a real Turnstile site key in the frontend and the
matching secret in Supabase Bot and Abuse Protection settings.

## Tests

Run unit and web tests without Supabase:

```bash
cd backend
./mvnw test
```

The Supabase integration test is opt-in. Start Docker and Supabase, obtain the
local anon key from `supabase status -o env`, then run:

```bash
cd backend
SUPABASE_INTEGRATION_TESTS=true \
SUPABASE_ANON_KEY="<local-anon-key>" \
./mvnw test -Dtest=SupabaseAuthIntegrationTests
```

The integration test uses the official local CAPTCHA test token, creates and
confirms a temporary email user, verifies the database triggers and Backend JWT
flow, and deletes the user when finished.
