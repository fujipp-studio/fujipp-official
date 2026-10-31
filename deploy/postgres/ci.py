#!/usr/bin/env python3
"""Rehearse the actual migration runner on a disposable PostgreSQL 17 container."""
import argparse
from pathlib import Path
import subprocess
import time
import uuid

from migrationlib import Database, ROOT, append_only, catalog, feature_checks, plan, transaction


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='')
    args = parser.parse_args()
    append_only(args.base)
    files, legacy = catalog()
    name = 'fujipp-db-ci-' + uuid.uuid4().hex[:12]
    container = subprocess.check_output(['docker', 'run', '-d', '--name', name, '--network', 'none',
        '--memory', '1g', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data:rw,size=1073741824',
        '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'], text=True).strip()
    try:
        prefix = ['docker', 'exec', '-i', name]
        for _ in range(120):
            if subprocess.run([*prefix, 'pg_isready', '-U', 'postgres'], stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL).returncode == 0:
                break
            time.sleep(0.25)
        else:
            raise RuntimeError('Disposable PostgreSQL did not become ready')
        admin = Database(prefix, 'postgres')
        admin.command('createdb', '-U', 'postgres', '-T', 'template0', 'migration_ci_checks')
        db = Database(prefix, 'migration_ci_checks')
        db.sql((ROOT / 'deploy/postgres/ci-bootstrap.sql').read_text())
        # Build the previous version first so new migrations must supply their
        # own application grants. The VPS-only historical grants run only here.
        old = set(legacy)
        if args.base:
            output = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', args.base, 'supabase/migrations/'], cwd=ROOT, text=True)
            from migrationlib import NAME
            old = {match[1] for path in output.splitlines() if Path(path).parent.as_posix() == 'supabase/migrations'
                   and (match := NAME.fullmatch(Path(path).name))}
        previous = {version: item for version, item in files.items() if version in old}
        selected = plan(previous, {}, [], {}, require_legacy=False)
        db.sql(transaction(previous, selected, '0' * 40))
        db.sql((ROOT / 'supabase/migrations/vps/002_application_role.sql').read_text())
        history, checksums = db.history()
        selected = plan(files, legacy, history, checksums)
        checks = feature_checks([files[version]['path'] for version in selected['pending']])
        db.sql(transaction(files, selected, '0' * 40, checks['sql']))
        db.sql((ROOT / 'deploy/postgres/verify-projection.sql').read_text())
        # A second pass must be a no-op. Exact hashes also protect the SQL bodies.
        second = plan(files, legacy, *db.history())
        assert not second['pending'] and not second['adopt'], second
        print(f"Database CI passed: {len(files)} migrations, {len(checks['paths'])} check files; repeat run has no pending SQL")
        print('Feature checks:', ', '.join(checks['features']))
        # Real PostgreSQL failure/concurrency coverage shares this disposable
        # cluster but creates its own databases; never connects to the VPS.
        subprocess.run(['python3', str(ROOT / 'deploy/postgres/integration.py'), name], check=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', container], check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
