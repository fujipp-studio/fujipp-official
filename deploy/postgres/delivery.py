#!/usr/bin/env python3
"""Plan by default; apply only a verified bundle to the active local VPS database."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
import uuid

from migrationlib import Database, MigrationError, ROOT, catalog, feature_checks, file_hash, plan, transaction


def active_database(directory, runtime):
    values = dict(line.split('=', 1) for line in runtime.read_text().splitlines()
                  if line and not line.startswith('#') and '=' in line)
    url = urlsplit(values['DB_URL'].removeprefix('jdbc:'))
    name = url.path.lstrip('/')
    if (url.hostname != 'database' or (url.port or 5432) != 5432 or url.username or url.password
            or values['DB_USERNAME'] != 'fujipp_backend'
            or not re.fullmatch(r'(?:fujipp_app|migration_[a-z0-9_]{1,40})', name)):
        raise MigrationError('Active Backend does not target the expected private VPS PostgreSQL stack')
    backup = (directory / 'backup-database').read_text().strip() if (directory / 'backup-database').exists() else 'fujipp_app'
    if name != backup:
        raise MigrationError('Backend database and scheduled backup target disagree')
    return name


def verify_bundle(root, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise MigrationError('Expected the reviewed source commit')
    manifest = json.loads((root / 'database-bundle.json').read_text())
    if manifest['version'] != 1 or manifest['commit'] != commit:
        raise MigrationError('Bundle/source revision mismatch')
    for name, sha in manifest['files'].items():
        path = root / name
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
            raise MigrationError('Invalid bundle file')
        if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
            raise MigrationError('Bundle file checksum mismatch: ' + name)
    actual = {path.relative_to(root).as_posix() for path in root.rglob('*') if path.is_file()
              and path.name != 'database-bundle.json' and '__pycache__' not in path.parts}
    if actual != set(manifest['files']):
        raise MigrationError('Unexpected or missing bundle files')


def summary(selected, files, checks):
    return {'pending': [files[version]['path'] for version in selected['pending']],
            'alreadyApplied': len(selected['history']), 'legacyMetadataToRecord': len(selected['adopt']),
            'features': checks['features'], 'checks': checks['paths']}


def execute(args, root=ROOT, prefix=None):
    directory = args.database_dir.resolve()
    name = active_database(directory, args.runtime_env)
    prefix = prefix or ['docker', 'compose', '-f', str(directory / 'compose.yml'), 'exec', '-T', 'database']
    db = Database(prefix, name)
    files, legacy = catalog(root)
    if args.apply:
        verify_bundle(root, args.commit)
    selected = plan(files, legacy, *db.history())
    checks = feature_checks([files[version]['path'] for version in selected['pending']], root)
    print(json.dumps(summary(selected, files, checks), indent=2), flush=True)
    if not args.apply:
        return
    # The lock covers backup, rehearsal and apply, not only the final SQL.
    # Independent Frontend/Backend workflows share this same lock on the VPS.
    with (directory / '.ci-migrations.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)  # SSH/job timeout bounds the wait.
        selected = plan(files, legacy, *db.history())
        checks = feature_checks([files[version]['path'] for version in selected['pending']], root)
        if not selected['pending'] and not selected['adopt']:
            db.sql('BEGIN READ ONLY;\n' + '\n'.join(checks['sql']) + '\nROLLBACK;')
            print('Database is current; no backup, rehearsal or migration SQL was needed.')
            return
        run = directory / 'migrations' / ('ci-' + args.commit[:12] + '-' + uuid.uuid4().hex[:8])
        run.mkdir(parents=True, mode=0o700)
        db.private_log = run / 'postgres.log'
        receipt = {**summary(selected, files, checks), 'commit': args.commit, 'database': name, 'status': 'pending'}
        def record():
            (run / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        record()
        scratch = 'migration_ci_' + uuid.uuid4().hex[:20]
        created = False
        try:
            archive = run / 'before.dump'
            with archive.open('xb') as output:
                db.command('pg_dump', '-U', 'postgres', '-d', name, '--format=custom', output=output)
            with archive.open('rb') as source:
                db.command('pg_restore', '--list', stdin=source)
            receipt['backupSha256'] = file_hash(archive)
            record()
            db.command('createdb', '-U', 'postgres', '-T', 'template0', scratch)
            created = True
            # Stream the backup rather than loading customer data into Python.
            import subprocess
            with archive.open('rb') as source, db.private_log.open('ab') as errors:
                restored = subprocess.run([*prefix, 'pg_restore', '-U', 'postgres', '-d', scratch,
                    '--no-owner', '--single-transaction', '--exit-on-error'], stdin=source,
                    stdout=subprocess.DEVNULL, stderr=errors)
            if restored.returncode:
                raise MigrationError('Private scratch restore failed; production was not migrated')
            rehearsal = Database(prefix, scratch, db.private_log)
            scratch_plan = plan(files, legacy, *rehearsal.history())
            if scratch_plan != selected:
                raise MigrationError('History changed while taking the backup; replan the release')
            rehearsal.sql(transaction(files, scratch_plan, args.commit, checks['sql']))
            db.command('dropdb', '-U', 'postgres', '--if-exists', scratch)
            created = False
            # Migration SQL, history, hashes and catalog checks commit together.
            # The SQL rechecks history under the database migration lock.
            db.sql(transaction(files, selected, args.commit, checks['sql']))
            final = plan(files, legacy, *db.history())
            if final['pending'] or final['adopt']:
                raise MigrationError('Post-migration history verification failed')
            receipt['status'] = 'succeeded'
            record()
            print('Database migration succeeded; backup and private receipt: ' + str(run))
        except BaseException:
            receipt['status'] = 'failed'
            record()
            raise
        finally:
            if created:
                db.command('dropdb', '-U', 'postgres', '--if-exists', scratch)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--commit', default='')
    parser.add_argument('--database-dir', type=Path, default=Path('/opt/fujipp/apps/fujipp-postgres'))
    parser.add_argument('--runtime-env', type=Path, default=Path('/opt/fujipp/env/fujipp-official.production.env'))
    args = parser.parse_args()
    os.umask(0o077)
    try:
        execute(args)
    except (MigrationError, KeyError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
