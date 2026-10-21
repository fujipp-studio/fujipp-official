#!/usr/bin/env bash
set -Eeuo pipefail
app_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ $# -ne 1 || ! -r $1 ]]; then
  echo "usage: $0 <readable-backup.dump>" >&2
  exit 64
fi
scratch="restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
compose() { docker compose -f "$app_dir/compose.yml" exec -T database "$@"; }
compose createdb --username=postgres --template=template0 "$scratch"
cleanup() { compose dropdb --username=postgres --if-exists "$scratch"; }
trap cleanup EXIT
compose pg_restore --username=postgres --dbname="$scratch" --exit-on-error --single-transaction <"$1"
compose psql --username=postgres --dbname="$scratch" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command="SELECT count(*) AS restored_user_tables FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');"
echo 'Restore verification passed; scratch database will be removed.'
