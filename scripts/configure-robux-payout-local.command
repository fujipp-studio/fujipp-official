#!/bin/zsh
set -euo pipefail

# Pass secrets as environment variables so the Roblox cookie is never written
# to this repository or shell script. Alternatively, copy the cookie to the
# macOS clipboard and let this script read it without pasting into Terminal.
: "${TEST_EMAIL:?Set TEST_EMAIL}"
: "${TEST_PASSWORD:?Set TEST_PASSWORD}"
: "${GROUP_ID:?Set GROUP_ID}"
GROUP_KEY="${GROUP_KEY:-main}"
GROUP_NAME="${GROUP_NAME:-กลุ่มหลัก}"
ROBUX_RUNTIME_VERSION="${ROBUX_RUNTIME_VERSION:-1.0.0}"
ROBLOX_TOTP_SECRET="${ROBLOX_TOTP_SECRET:-}"
NOTIFICATION_CHANNEL_ID="${NOTIFICATION_CHANNEL_ID:-}"

if [[ -z "${DISCORD_BOT_TOKEN:-}" ]]; then
  if ! command -v pbpaste >/dev/null 2>&1; then
    print -u2 'Set DISCORD_BOT_TOKEN because pbpaste is unavailable.'
    exit 1
  fi

  print 'Copy the Discord test bot token to the clipboard, then press Enter.'
  read -r
  DISCORD_BOT_TOKEN=$(pbpaste)
fi

if [[ -z "$DISCORD_BOT_TOKEN" ]]; then
  print -u2 'The Discord bot token is empty.'
  exit 1
fi

if [[ -z "${ROBLOX_COOKIE:-}" ]]; then
  if ! command -v pbpaste >/dev/null 2>&1; then
    print -u2 'Set ROBLOX_COOKIE because pbpaste is unavailable.'
    exit 1
  fi

  print 'Copy the complete .ROBLOSECURITY value to the clipboard, then press Enter.'
  read -r
  ROBLOX_COOKIE=$(pbpaste)
fi

if [[ -z "$ROBLOX_COOKIE" ]]; then
  print -u2 'The Roblox cookie is empty.'
  exit 1
fi

SUPABASE_URL='http://127.0.0.1:54321'
BACKEND_URL='http://127.0.0.1:8080'
LICENSE_ID='e0700000-0000-0000-0000-000000000003'
BOT_ID='e0100000-0000-0000-0000-000000000002'
PLACEHOLDER_OWNER_ID='e0100000-0000-0000-0000-000000000001'
DB_CONTAINER='supabase_db_fujipp-official'
FEATURE_VERSION_ID='e0700000-0000-0000-0000-000000000002'

if [[ "$ROBUX_RUNTIME_VERSION" != '1.0.0' ]]; then
  print -u2 'ROBUX_RUNTIME_VERSION must be 1.0.0.'
  exit 1
fi

# Read the current local anon key instead of keeping a project secret here.
ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')

AUTH_RESPONSE=$(curl -sS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg email "$TEST_EMAIL" --arg password "$TEST_PASSWORD" \
    --arg captchaToken 'XXXX.DUMMY.TOKEN.XXXX' \
    '{
      email:$email,
      password:$password,
      gotrue_meta_security:{captcha_token:$captchaToken}
    }')")
ACCESS_TOKEN=$(print -r -- "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [[ -z "$ACCESS_TOKEN" ]]; then
  print -u2 "Supabase login failed: $(print -r -- "$AUTH_RESPONSE" | jq -c '.')"
  exit 1
fi

# Local A/B switch: keep the same feature-version ID so the existing encrypted
# configuration, presentation slots, installation, and wallet data remain intact.
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v feature_version_id="$FEATURE_VERSION_ID" -v runtime_version="$ROBUX_RUNTIME_VERSION" <<'SQL'
UPDATE shop.feature_versions
   SET version = :'runtime_version',
       updated_at = now()
 WHERE id = :'feature_version_id'::uuid;
SQL
print "Using roblox-robux-payout@$ROBUX_RUNTIME_VERSION for the local test license."

# The seeded test bot originally belongs to a non-login placeholder user.
# For local testing only, attach that fixture data to the authenticated user.
LOCAL_USER_ID=$(print -r -- "$ACCESS_TOKEN" | jq -Rr \
  'split(".")[1] | @base64d | fromjson | .sub // empty')

if [[ ! "$LOCAL_USER_ID" =~ '^[0-9a-fA-F-]{36}$' ]]; then
  print -u2 'Unable to identify the authenticated local user.'
  exit 1
fi

VISIBLE_LICENSE=$(curl -fsS "$BACKEND_URL/api/v1/feature-licenses" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | \
  jq -r --arg licenseId "$LICENSE_ID" '.[] | select(.id == $licenseId) | .id')

if [[ -z "$VISIBLE_LICENSE" ]]; then
  print 'Attaching the seeded test bot and Feature licenses to the local account...'
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 \
    -U postgres -d postgres \
    -v old_owner="$PLACEHOLDER_OWNER_ID" -v new_owner="$LOCAL_USER_ID" <<'SQL'
BEGIN;
SET LOCAL session_replication_role = replica;
UPDATE private.bot_credentials
   SET owner_user_id = :'new_owner'::uuid
 WHERE owner_user_id = :'old_owner'::uuid;
UPDATE private.bot_feature_installations
   SET owner_user_id = :'new_owner'::uuid
 WHERE owner_user_id = :'old_owner'::uuid;
UPDATE private.feature_licenses
   SET owner_user_id = :'new_owner'::uuid
 WHERE owner_user_id = :'old_owner'::uuid;
UPDATE bots.bot_instances
   SET owner_user_id = :'new_owner'::uuid
 WHERE owner_user_id = :'old_owner'::uuid;
SET LOCAL session_replication_role = origin;
COMMIT;
SQL
fi

print 'Saving encrypted Discord test bot token...'
curl -fsS "$BACKEND_URL/api/v1/bots/$BOT_ID/credentials/discord-token" \
  -X PUT \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg token "$DISCORD_BOT_TOKEN" '{token:$token}')"

CREDENTIALS=$(jq -cn \
  --arg key "$GROUP_KEY" \
  --arg cookie "$ROBLOX_COOKIE" \
  --arg totp "$ROBLOX_TOTP_SECRET" \
  '{($key):({cookie:$cookie}+if $totp=="" then {} else {totpSecret:$totp} end)}')

CONFIG_PAYLOAD=$(jq -n \
  --arg key "$GROUP_KEY" \
  --arg name "$GROUP_NAME" \
  --argjson groupId "$GROUP_ID" \
  --arg notification "$NOTIFICATION_CHANNEL_ID" \
  --arg credentials "$CREDENTIALS" \
  '{
    values:({
      PANEL_COMMAND_NAME:"robux-panel",
      ROBUX_ENABLED:true,
      ROBUX_RATE:3.5,
      ROBUX_PACKAGES:[
        {robux:1},
        {robux:10},
        {robux:15},
        {robux:20},
        {robux:200},
        {robux:300},
        {robux:350},
        {robux:400},
        {robux:500},
        {robux:600},
        {robux:800},
        {robux:1000},
        {robux:1200},
        {robux:1400},
        {robux:1600},
        {robux:2000},
        {robux:3000},
        {robux:4000},
        {robux:5000}
      ],
      ROBUX_PAYOUT_COOLDOWN_SECONDS:5,
      ROBLOX_GROUPS:[{key:$key,name:$name,groupId:$groupId}]
    } + if $notification=="" then {} else {ROBUX_NOTIFICATION_CHANNEL_ID:$notification} end),
    secrets:{ROBLOX_CREDENTIALS:$credentials},
    presentations:{}
  }')

print 'Saving encrypted Feature configuration...'
curl -fsS "$BACKEND_URL/api/v1/feature-licenses/$LICENSE_ID/configuration" \
  -X PUT \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "$CONFIG_PAYLOAD" | jq '{licenseId,revision,configuredFields:[.fields[]|select(.configured)|.key]}'

print 'Installing Feature on Voice Keeper Test Bot...'
INSTALL_RESPONSE=$(curl -sS "$BACKEND_URL/api/v1/feature-licenses/$LICENSE_ID/installations" \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg botId "$BOT_ID" '{botId:$botId}')")

if print -r -- "$INSTALL_RESPONSE" | jq -e '.status == "ACTIVE"' >/dev/null 2>&1; then
  print -r -- "$INSTALL_RESPONSE" | jq '{id,botId,status}'
else
  print 'Feature is already installed; keeping the existing installation.'
fi

print 'Done. Restart or wait for the Bot Runner polling cycle, then use /robux-panel in Discord.'
