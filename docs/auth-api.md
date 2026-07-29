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
- `USERNAME_SET`.

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
