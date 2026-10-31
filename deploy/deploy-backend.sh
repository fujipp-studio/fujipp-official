#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 5 || $# -gt 6 ]]; then
  echo "usage: $0 <commit-sha> <backend-image> <runner-image> <backend-port> <healthcheck-url> [both|backend|bot-runner]" >&2
  exit 64
fi
commit_sha=$1
backend_repository=$2
runner_repository=$3
backend_port=$4
healthcheck_url=$5
selection=${6:-both}
app_dir=${FUJIPP_DEPLOY_APP_DIR:-/opt/fujipp/apps/fujipp-official}
runtime_env=${FUJIPP_DEPLOY_RUNTIME_ENV:-/opt/fujipp/env/fujipp-official.production.env}
compose_file="$app_dir/compose.production.yml"
candidate_compose="$app_dir/compose.production.candidate.yml"
release_env="$app_dir/release.env"
export DOCKER_CONFIG="$app_dir/.docker"

if [[ ! $commit_sha =~ ^[0-9a-f]{40}$ || ! $backend_port =~ ^[0-9]{2,5}$ ]] \
  || (( 10#$backend_port < 1 || 10#$backend_port > 65535 )); then
  echo "invalid commit SHA or backend port" >&2; exit 65
fi
for repository in "$backend_repository" "$runner_repository"; do
  if [[ ! $repository =~ ^[a-z0-9][a-z0-9._/-]+$ ]]; then
    echo "invalid image repository" >&2; exit 65
  fi
done
case "$selection" in
  both) services=(backend bot-runner);;
  backend) services=(backend);;
  bot-runner) services=(bot-runner);;
  *) echo "invalid service selection" >&2; exit 65;;
esac
if [[ ! -r $candidate_compose ]]; then candidate_compose=$compose_file; fi
for required in "$runtime_env" "$candidate_compose" "$DOCKER_CONFIG/config.json"; do
  if [[ ! -r $required ]]; then echo "required file is not readable: $required" >&2; exit 66; fi
done
for key in SUPABASE_URL DB_URL DB_USERNAME DB_PASSWORD STORE_SECRET_KEY_BASE64 \
  RUNNER_API_TOKEN APP_CORS_ALLOWED_ORIGINS PROMPTPAY_ID PROMPTPAY_ACCOUNT_NAME \
  SLIPOK_BRANCH_ID SLIPOK_API_KEY; do
  if ! grep -qE "^${key}=.+" "$runtime_env"; then echo "required runtime setting missing: $key" >&2; exit 78; fi
done

umask 077
candidate=$(mktemp "$app_dir/release.env.XXXXXX")
previous=$(mktemp "$app_dir/rollback.env.XXXXXX")
previous_compose=$(mktemp "$app_dir/rollback.compose.XXXXXX")
cleanup() { rm -f "$candidate" "$previous" "$previous_compose"; }
trap cleanup EXIT
had_release=false
had_compose=false
if [[ -f $compose_file ]]; then cp "$compose_file" "$previous_compose"; had_compose=true; fi
if [[ -f $release_env ]]; then
  # Never source a release file. Reuse only validated immutable references.
  old_backend=$(sed -n 's/^BACKEND_IMAGE=//p' "$release_env")
  old_runner=$(sed -n 's/^BOT_RUNNER_IMAGE=//p' "$release_env")
  old_port=$(sed -n 's/^BACKEND_PORT=//p' "$release_env")
  for image in "$old_backend" "$old_runner"; do
    if [[ ! $image =~ ^[a-z0-9][a-z0-9._/-]+(:[0-9a-f]{40}|@sha256:[0-9a-f]{64})$ ]]; then
      echo "previous release contains an invalid or mutable image reference" >&2; exit 65
    fi
  done
  if [[ ! $old_port =~ ^[0-9]{2,5}$ ]] || (( 10#$old_port < 1 || 10#$old_port > 65535 )); then
    echo "previous release has an invalid backend port" >&2; exit 65
  fi
  printf 'BACKEND_IMAGE=%s\nBOT_RUNNER_IMAGE=%s\nBACKEND_PORT=%s\n' "$old_backend" "$old_runner" "$old_port" >"$previous"
  had_release=true
  if [[ $had_compose != true ]]; then echo "previous release has no Compose definition" >&2; exit 65; fi
fi
if [[ $selection != both ]]; then
  if [[ $had_release != true ]]; then echo "partial deployment requires an existing release; run the full workflow" >&2; exit 65; fi
  if ! cmp -s "$compose_file" "$candidate_compose"; then echo "Compose changed; both services must be deployed" >&2; exit 65; fi
  if [[ $selection == bot-runner && $backend_port != "$old_port" ]]; then echo "backend port changed; deploy the backend too" >&2; exit 65; fi
fi

backend_image="$backend_repository:$commit_sha"
runner_image="$runner_repository:$commit_sha"
if [[ $selection == bot-runner ]]; then backend_image=$old_backend; fi
if [[ $selection == backend ]]; then runner_image=$old_runner; fi
printf 'BACKEND_IMAGE=%s\nBOT_RUNNER_IMAGE=%s\nBACKEND_PORT=%s\n' "$backend_image" "$runner_image" "$backend_port" >"$candidate"

compose_with() {
  local environment=$1 definition=$2
  shift 2
  docker compose --project-name fujipp-official --env-file "$runtime_env" \
    --env-file "$environment" --file "$definition" "$@"
}
compose() { compose_with "$release_env" "$compose_file" "$@"; }
container_state() {
  local id
  id=$(compose --profile runner ps --all --quiet "$1") || return 1
  [[ -n $id ]] || return 1
  docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id"
}
if [[ $had_release != true ]]; then
  existing=$(compose_with "$candidate" "$candidate_compose" --profile runner ps --all --quiet backend bot-runner)
  if [[ -n $existing ]]; then echo "existing containers have no release state; inspect before deploying" >&2; exit 65; fi
elif [[ $selection != both ]]; then
  unselected=backend
  if [[ $selection == backend ]]; then unselected=bot-runner; fi
  if ! state=$(container_state "$unselected"); then echo "unselected service is missing; use a full deployment" >&2; exit 65; fi
  if [[ $state != running\ * ]]; then echo "unselected service is not running; use a full deployment" >&2; exit 65; fi
fi

# Pull failures leave the active release and both running containers untouched.
compose_with "$candidate" "$candidate_compose" --profile runner pull "${services[@]}"
backend_attempted=false
runner_attempted=false

rollback() {
  if [[ $had_release == true ]]; then
    cp "$previous" "$release_env" || return 1
    cp "$previous_compose" "$compose_file" || return 1
    # Stop only an attempted new runner before restoring the old backend/API.
    if [[ $runner_attempted == true ]]; then compose --profile runner stop bot-runner || return 1; fi
    if [[ $backend_attempted == true ]]; then
      compose up -d --no-deps --pull never --wait --wait-timeout 120 backend || return 1
    fi
    if [[ $runner_attempted == true ]]; then
      compose --profile runner up -d --no-deps --pull never --wait --wait-timeout 120 bot-runner || return 1
    fi
    # A failed port/config change may also change the public probe URL. Verify
    # the restored definition's own health instead of probing the new endpoint.
    local restored
    restored=$(container_state backend) || return 1
    [[ $restored == 'running healthy' || $restored == 'running none' ]] || return 1
  else
    compose --profile runner rm --stop --force "${services[@]}" || return 1
    rm -f "$release_env"
    if [[ $had_compose == true ]]; then cp "$previous_compose" "$compose_file"; else rm -f "$compose_file"; fi
  fi
}
on_error() {
  local status=$?
  trap - ERR
  echo "deployment failed; restoring the previous release" >&2
  if ! rollback; then echo "ROLLBACK FAILED: inspect service state and release files on the VPS" >&2; fi
  exit "$status"
}
trap on_error ERR
if [[ $had_release == true ]]; then
  cp "$previous" "$app_dir/previous-release.env"
  cp "$previous_compose" "$app_dir/previous-compose.production.yml"
fi
if [[ $candidate_compose != "$compose_file" ]]; then mv "$candidate_compose" "$compose_file"; fi
mv "$candidate" "$release_env"

# A new runner never starts before the selected backend passes its health check.
if [[ $selection != bot-runner ]]; then
  backend_attempted=true
  compose up -d --no-deps --wait --wait-timeout 120 backend
fi
curl --fail --silent --show-error --max-time 10 "$healthcheck_url" >/dev/null
if [[ $selection != backend ]]; then
  runner_attempted=true
  compose --profile runner up -d --no-deps --wait --wait-timeout 120 bot-runner
fi
# Inspect without `up`: unselected services are never created or restarted.
for service in backend bot-runner; do
  healthy=false
  for ((attempt=0; attempt<60; attempt++)); do
    if ! state=$(container_state "$service"); then echo "$service container disappeared" >&2; false; fi
    if [[ $state == 'running healthy' || $state == 'running none' ]]; then healthy=true; break; fi
    sleep 2
  done
  if [[ $healthy != true ]]; then echo "$service did not become healthy" >&2; false; fi
done
trap - ERR
echo "deployment $commit_sha succeeded; changed services: $selection"
