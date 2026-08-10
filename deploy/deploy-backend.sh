#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 <commit-sha> <backend-image> <bot-runner-image> <backend-port> <healthcheck-url>" >&2
  exit 64
fi

commit_sha=$1
backend_repository=$2
bot_runner_repository=$3
backend_port=$4
healthcheck_url=$5

app_dir=/opt/fujipp/apps/fujipp-official
runtime_env=/opt/fujipp/env/fujipp-official.production.env
compose_file="$app_dir/compose.production.yml"
release_env="$app_dir/release.env"
previous_release_env="$app_dir/previous-release.env"

if [[ ! $commit_sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid commit SHA" >&2
  exit 65
fi

if [[ ! $backend_port =~ ^[0-9]{2,5}$ ]]; then
  echo "invalid backend port" >&2
  exit 65
fi

for required_file in "$runtime_env" "$compose_file"; do
  if [[ ! -r $required_file ]]; then
    echo "required file is not readable: $required_file" >&2
    exit 66
  fi
done

for required_key in \
  SUPABASE_URL DB_URL DB_USERNAME DB_PASSWORD STORE_SECRET_KEY_BASE64 \
  RUNNER_API_TOKEN APP_CORS_ALLOWED_ORIGINS; do
  if ! grep -qE "^${required_key}=.+" "$runtime_env"; then
    echo "required runtime setting is missing or empty: $required_key" >&2
    exit 78
  fi
done

umask 077
release_tmp=$(mktemp "$app_dir/release.env.XXXXXX")
trap 'rm -f "$release_tmp"' EXIT

cat >"$release_tmp" <<EOF
BACKEND_IMAGE=${backend_repository}:${commit_sha}
BOT_RUNNER_IMAGE=${bot_runner_repository}:${commit_sha}
BACKEND_PORT=${backend_port}
EOF

had_previous_release=false
if [[ -f $release_env ]]; then
  cp "$release_env" "$previous_release_env"
  had_previous_release=true
fi

mv "$release_tmp" "$release_env"

compose() {
  docker compose \
    --project-name fujipp-official \
    --env-file "$runtime_env" \
    --env-file "$release_env" \
    --file "$compose_file" \
    "$@"
}

rollback() {
  trap - ERR
  echo "deployment failed; attempting rollback" >&2

  if [[ $had_previous_release == true && -f $previous_release_env ]]; then
    cp "$previous_release_env" "$release_env"
    compose pull backend
    compose up -d --no-deps --wait --wait-timeout 120 backend
  else
    compose rm --stop --force backend || true
  fi
}

trap rollback ERR

# Pull both artifacts now, but keep the new runner stopped until legacy bots move.
compose --profile runner pull backend bot-runner
compose up -d --no-deps --wait --wait-timeout 120 backend
curl --fail --silent --show-error --max-time 10 "$healthcheck_url" >/dev/null

trap - ERR
echo "backend deployment ${commit_sha} is healthy at ${healthcheck_url}"
