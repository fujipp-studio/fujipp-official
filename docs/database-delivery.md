# VPS Database CI/CD

Database changes remain under `supabase/migrations/`; the directory name does
not select Supabase as the production target. Production uses PostgreSQL 17 on
the VPS. Supabase Auth remains the identity issuer.

The delivery tools never replay an applied migration. Read
`deploy/postgres/feature-map.json` for migration patterns, owned database objects,
dependencies, checks and feature guides before editing a database feature.

## Release flow

1. Create a task branch from `main`. Add a new `YYYYMMDDHHMMSS_name.sql` file;
   never edit/delete/rename an existing migration. Versions must be greater than
   the previous maximum. Fix a released migration with a later corrective file.
2. Update the feature map and catalog checks when introducing a feature/object.
   Wallet checks also select dependent purchase/payment features; unknown names
   select all checks. Identity, financial column types, ledger protection and RLS
   remain baseline checks. Every pending SQL file still executes in version order.
3. PR CI starts an isolated PostgreSQL 17 container with no network or persistent
   volume. It replays the base branch, grants the historical VPS role permissions,
   applies incoming migrations and runs the selected checks. New migrations must
   supply their own Backend grants. Provisioning checks insert only synthetic
   data inside a transaction that rolls back. No production credentials are used.
   Readiness probes use TCP inside the isolated container, so the official image's
   socket-only bootstrap server cannot release the gate before initialization ends.
4. After selected application checks pass, Backend calls the reusable
   `.github/workflows/database-cd.yml` before its aggregate `verify` gate and
   image publishing/deployment. Frontend calls the same workflow after its checks
   and before FTPS deployment. A database failure blocks the application release.
   Migration-only pushes trigger Backend's entry workflow and compatibility
   checks for both application services, without rebuilding/publishing application
   images or restarting application containers. Source changes in the same push
   still select their own application releases.
5. The production job packages only root migration SQL, delivery code, checks and
   referenced guides. Its commit and file hashes are verified after SSH upload.
   VPS bootstrap SQL under `supabase/migrations/vps/` is never automatically applied.
   No environment files, passwords, backups or customer rows enter the bundle.
6. The VPS tool derives the target from the active Backend's private `DB_URL` and
   requires it to match `backup-database`. It uses the existing local database
   container; it does not expose a port, replace Compose, recreate PostgreSQL,
   switch the database URL or replace Supabase Auth.
7. If migrations or legacy metadata are pending, take a private custom-format
   backup, validate its archive, restore it into a unique scratch database and
   rehearse the exact SQL/checks against the restored data. Remove only that
   scratch database. Production application processes and balances are untouched
   during rehearsal.
8. Apply migration SQL, history rows, source hashes and catalog checks in one
   transaction. Any SQL/check failure rolls back the entire pending batch. A
   host lock covers backup/rehearsal/apply; a PostgreSQL advisory lock and locked
   history tables reject concurrent or stale plans. Lock timeout is five seconds;
   individual SQL statements are limited to 120 seconds.

An already current database only runs read-only catalog checks. It does not take
another backup, replay SQL or restart services. Both application workflows can
call the gate for the same commit; the VPS lock serializes them and the second
call observes the completed history. A stale application release whose bundle
does not contain newer deployed migrations fails rather than deploying over it.

Use backward-compatible expand/contract changes. Database changes can finish
before a later image/FTPS deployment fails, and older application processes keep
running during schema updates. A normal application rollback does **not** roll
back committed database changes. Never automatically restore the pre-migration
backup: that would overwrite later writes, including financial/admin adjustments.
Recovery after a committed change needs a corrective migration or a separately
planned maintenance restore with reconciliation.

## Existing VPS history

On 2026-11-01 a read-only check found 70 applied versions in
`migration_cutover_20261022`, through `20261030000001`. The committed
`legacy-baseline.json` pairs each repository file hash with the observed hash of
its recorded history statements. It freezes that existing state; it is not a
schema/data backup or proof of every historical SQL operation.

The first deployment records checksum metadata for these allowlisted versions
after backup and rehearsal. It never executes their SQL again. Missing legacy
history, changed source files/history, unknown manually applied versions and
backdated migrations fail closed for investigation. Subsequent new versions have
their SQL and checksum/history records written atomically. The ledger is
`supabase_migrations.schema_migrations` with a private `ci_checksums` table;
application/browser roles cannot change the checksum table.

The original `vps/001_auth_projection.sql` and `vps/002_application_role.sql`
remain explicit cutover/rehearsal tools. They are not recurring migrations.
Supabase Auth stays the credential store; PostgreSQL keeps the identity projection.

## Setup and operation

The reusable workflow uses the existing `production` environment and its
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. Optional
`DATABASE_DEPLOY_PATH` defaults to `/opt/fujipp/apps/fujipp-postgres`. The active
Backend env path remains `/opt/fujipp/env/fujipp-official.production.env`.
No database password is sent to GitHub; the deploy user executes PostgreSQL tools
inside the existing private container. Preserve production environment protection.

For a manual check, select **Database CI/CD → Run workflow** and leave `apply`
disabled. Enabling it applies pending migrations only on `main`, after all checks.
PRs and other branches cannot reach the production job. Routine merge releases
call this workflow through Backend/Frontend automatically.

Private backups, PostgreSQL errors and receipts remain under
`<database-dir>/migrations/ci-<commit>-<run>/`, with private file permissions.
The receipt includes the source commit, pending versions, backup hash and outcome.
An interrupted SSH/job may leave `pending`; the next run checks actual committed
history rather than trusting that receipt. Nothing restores an old database by
reading a receipt. Keep successful/failed backup receipts for recovery and manage
their storage deliberately; the existing daily backup retention does not delete
these release backups. Offsite copies and encryption keys remain the operator's
backup responsibility; CI never uploads customer backups as Actions artifacts.

`delivery.py` defaults to a read-only plan. `--apply` requires a verified source
bundle and immutable commit. SQL files must not contain their own transaction
commands, psql meta-commands, `COPY FROM STDIN`, or nontransactional operations such
as concurrent index creation. Such operations need a separate reviewed procedure.
Checks run in the migration transaction and must be catalog-only: never insert
fixtures or scan/modify customer financial rows in a production check.

## Local validation

From the repository root:

```sh
python3 -m unittest discover -s deploy/postgres -p 'test_*.py' -v
python3 deploy/postgres/ci.py --base "$(git rev-parse origin/main)"
python3 -m unittest discover -s deploy -p 'test_*.py' -v
```

The Docker rehearsal exercises real PostgreSQL backups/restores, batch rollback,
failed contract checks, history/hash drift, advisory locks, metadata-only adoption,
repeated deployments and failed rehearsal without target changes. Containers and
their scratch databases are disposable; no production connection is made.

The transaction and locking behavior follows the PostgreSQL 17
[psql](https://www.postgresql.org/docs/17/app-psql.html) and
[locking](https://www.postgresql.org/docs/17/explicit-locking.html) documentation.
Backup/rehearsal uses [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).
