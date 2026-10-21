#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for command in docker openssl flock crontab; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 69; }
done
mkdir -p "$app_dir/secrets" "$app_dir/backups"
chmod 700 "$app_dir/secrets" "$app_dir/backups"
if [[ ! -s $app_dir/secrets/postgres_password ]]; then
  openssl rand -hex 32 >"$app_dir/secrets/postgres_password"
fi
chmod 600 "$app_dir/secrets/postgres_password"
chmod 700 "$app_dir/backup.sh" "$app_dir/verify-restore.sh"
docker compose -f "$app_dir/compose.yml" config --quiet
docker compose -f "$app_dir/compose.yml" up -d --wait --wait-timeout 120
# Preserve unrelated jobs. Logs and dumps stay private to the deploy user.
existing=$(crontab -l 2>/dev/null || true)
job="17 3 * * * $app_dir/backup.sh >>$app_dir/backups/backup.log 2>&1 # fujipp-postgres-backup"
{ printf '%s\n' "$existing" | sed '/# fujipp-postgres-backup$/d'; printf '%s\n' "$job"; } | crontab -
"$app_dir/backup.sh"
echo 'PostgreSQL is ready. Production application connections have not been changed.'
