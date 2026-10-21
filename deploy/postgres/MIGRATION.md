# Supabase application data to VPS

The rehearsal copies application schemas only. Supabase Auth remains the issuer
and password/session/provider store. The VPS has a minimal identity projection
(`id`, cached email and display metadata) for foreign keys and admin queries.
A verified JWT provisions a missing application profile through the existing
profile trigger. Application roles and account status continue to come from
`private.user_accounts`; metadata cannot grant privileges or reactivate users.
Identity projection is disabled by default and must only be enabled on the VPS.
Cached emails update when a newer verified JWT is used. An Auth user who has
never accessed the new Backend will not appear in local admin search until first
access. Auth deletion is not propagated automatically into financial records.

## Rehearsal

Use the task-branch candidate Backend jar. On the VPS, alongside compose.yml:

```bash
python3 clone.py \
  --target migration_rehearsal_YYYYMMDD \
  --bootstrap 001_auth_projection.sql \
  --grants 002_application_role.sql
docker compose exec -T database psql -U postgres -d migration_rehearsal_YYYYMMDD \
  -v ON_ERROR_STOP=1 < verify-projection.sql
python3 rehearse-backend.py \
  --target migration_rehearsal_YYYYMMDD --jar /absolute/path/candidate.jar
```

The clone holds one repeatable-read source snapshot for pg_dump and validation.
All application row counts and canonical row fingerprints must match; financial
rows are checked without printing balances or user data. Foreign-key validation
happens during transactional restore. Auth credentials, sessions and identities
are not exported. Failed restores remain in their scratch database for diagnosis.
A new target is mandatory; the tool never overwrites an existing database.

`--reuse-snapshot /private/path/to/snapshot` replays an existing backup without
connecting to Supabase. Copy application.dump, identities.json and
source-fingerprints.json together. Restore metadata and scripts must be kept with
the backup. Retain STORE_SECRET_KEY_BASE64 and its key version separately with
private permissions; existing encrypted feature secrets require that exact key.

```bash
python3 verify-snapshot.py --target migration_rehearsal_YYYYMMDD \
  --fingerprints migrations/migration_rehearsal_YYYYMMDD/source-fingerprints.json
```

Do not run a Discord Runner against the rehearsal database: that would duplicate
live bots. Rehearsal Backend jobs can change scratch runtime subscriptions, so
fingerprints must be compared before running the Backend. The rehearsal removes
its container and temporary runtime env file when finished.

## Cutover checklist

The repository owner reviews/merges the task branch; wait for Backend CI/CD to
finish deploying the new code with identity projection still disabled and the
old database URL. The separate database network must already exist.

1. Confirm the current production image is the reviewed release. Preserve the
   current runtime env file privately, including source DB access and encryption
   keys. Keep Supabase Auth URL, JWT issuer and public frontend auth config.
2. Pause production Backend and Runner writes during a maintenance window. Do not
   leave the old Backend writable while taking the final snapshot. Check for any
   other writers to the application schemas before proceeding.
3. Run clone.py into a new `migration_cutover_...` database. Verify every table
   fingerprint and foreign key. Repeat the provisioning/role checks inside a
   transaction that is rolled back. Verify sequences and encrypted bot secrets.
4. Copy the final snapshot and recovery metadata to the owner's computer using
   the existing SSH connection. Compare the dump SHA-256 on both machines. The
   rehearsal snapshot alone is not the final cutover backup.
5. Use the generated `secrets/backend_password` for the fujipp_backend login.
   Configure the Backend DB URL as
   `jdbc:postgresql://database:5432/migration_cutover_...`, username
   `fujipp_backend`, and `AUTH_IDENTITY_PROJECTION_ENABLED=true`. Do not use the
   PostgreSQL superuser as the application login. Keep STORE_SECRET_KEY_BASE64.
6. Write the active migration database name followed by a newline to
   `backup-database` alongside backup.sh before starting writes. Run and restore-check a backup of that database. The
   default empty fujipp_app database must not remain the backup target after
   cutover. Use the reviewed image for Backend and the unchanged Runner.
7. Verify Backend health, public APIs, real user login/account status, wallet
   reads, and runtime bootstrap. Start exactly one production Runner, then verify
   bot status. Keep the old Supabase data intact during the rollback window.
8. Once the new database accepts writes, rollback is not just changing DB_URL:
   pause writes and reconcile all new financial/application records first.
   Before any new writes, reverting the preserved env and restarting the old
   release is the fallback. Never automatically revert after accepting writes.

Daily dumps on the VPS do not automatically reach the owner's computer. Copy
fresh backups offsite regularly while the machine is available, and repeat a
restore drill. No unattended connection to the owner's computer is configured.
