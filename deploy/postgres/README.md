# VPS PostgreSQL

This stack prepares a standalone PostgreSQL 17 database for an application
migration. It does not change the Backend DB URL, move production data, or replace
Supabase Auth. Run it separately from the application Compose project so an
application deployment does not remove or recreate the database volume.

## Installation

Copy this directory, excluding secrets and backups, to
`/opt/fujipp/apps/fujipp-postgres` on the VPS and run:

```bash
bash /opt/fujipp/apps/fujipp-postgres/install.sh
```

The installer generates a private admin password only when none exists. Keep the
password file with the persistent volume; changing it after initialization does
not change the database password. The stack publishes no host port and uses its
own internal Docker network. The Backend is not attached to that network yet.
Resource limits are 1 GiB RAM, one CPU and 30 connections. PostgreSQL data is stored
in the `fujipp-postgres_data` Docker volume. Never run `docker compose down -v`
on this stack unless explicitly destroying the database is intended.

The backup target defaults to `fujipp_app`; after cutover, write the active
database name followed by a newline to `backup-database` alongside backup.sh.
Daily custom-format dumps run at 03:17 in the VPS timezone, with files older than
seven days removed after a successful new dump. The deploy user's other cron jobs
are preserved. Inspect `backups/backup.log` for failures. These local backups do
not protect against losing the VPS; configure a separate offsite destination
before this database becomes the production source of truth.

## Restore drill

```bash
/opt/fujipp/apps/fujipp-postgres/backup.sh
/opt/fujipp/apps/fujipp-postgres/verify-restore.sh /absolute/path/to/backup.dump
```

The drill restores into a newly created scratch database in one transaction,
checks accessibility and removes only that scratch database. It never restores
over the application database. A successful drill on an empty database validates
the tooling, not the migration of application data.

## Application migration requirements

Supabase Auth remains the authentication source of truth. The current migrations
reference `auth.users`, use `auth.uid()` in RLS policies, and create profiles and
accounts using an Auth insert trigger. Admin user queries also join `auth.users`.
A plain PostgreSQL server does not provide those Supabase components. Changing
only `DB_URL` would therefore break account provisioning and admin queries.

Before cutover:

1. Implement and review an explicit application identity/provisioning bridge to
   the retained Supabase Auth service. Do not copy passwords or authentication
   credentials to application profile tables.
2. Capture schema changes under `supabase/migrations/` on the task branch, with
   migrations compatible with the source and destination deployment plan.
3. Test export/restore, row counts, financial balances/ledger consistency,
   sequences, constraints, and account creation/login against the destination.
4. Configure offsite backup and verify restoration from that copy.
5. Prepare a write-quiescence window, final consistent export and rollback plan.
   Once writes reach the new database, switching the URL back alone is not a
   safe rollback: those writes must be reconciled.
6. Use a separate least-privilege application login, attach the Backend to the
   database network and switch its configuration only after the migration checks
   pass. Keep the database port unpublished.

The repository owner reviews/merges schema changes before production cutover.
No production data has been migrated by the infrastructure installer.

See [MIGRATION.md](MIGRATION.md) for the tested clone tools, Supabase Auth
compatibility, and the production cutover checklist.
