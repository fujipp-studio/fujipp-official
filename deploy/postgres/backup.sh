#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$app_dir/backups"
exec 9>"$app_dir/backups/.backup.lock"
flock -n 9 || exit 0
database=fujipp_app
if [[ -f $app_dir/backup-database ]]; then
  IFS= read -r database <"$app_dir/backup-database"
fi
if [[ ! $database =~ ^(fujipp_app|migration_[a-z0-9_]{1,40})$ ]]; then
  echo "Invalid backup database name" >&2
  exit 65
fi
archive="$app_dir/backups/${database}-$(date -u +%Y%m%dT%H%M%SZ).dump"
temporary=$(mktemp "$app_dir/backups/.dump.XXXXXX")
trap 'rm -f "$temporary"' EXIT
docker compose -f "$app_dir/compose.yml" exec -T database \
  pg_dump --username=postgres --dbname="$database" --format=custom >"$temporary"
# Check that the archive directory can be read before replacing the temporary file.
docker compose -f "$app_dir/compose.yml" exec -T database \
  pg_restore --list <"$temporary" >/dev/null
mv "$temporary" "$archive"
find "$app_dir/backups" -maxdepth 1 -type f \( -name 'fujipp_app-*.dump' -o -name 'migration_*.dump' \) -mtime +7 -delete
printf 'Backup completed: %s\n' "$(basename "$archive")"
