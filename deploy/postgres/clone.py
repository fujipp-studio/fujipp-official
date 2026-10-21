#!/usr/bin/env python3
"""Clone a consistent application snapshot to a new scratch DB; never cut over.

Run only on the VPS. Source credentials remain in process memory/container env.
Dump and identity projection files stay in the private migration directory.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit

SCHEMAS = ('public', 'private', 'billing', 'bots', 'shop', 'portfolio', 'support', 'supabase_migrations')
ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, help='New scratch database name, starting with migration_')
    parser.add_argument('--bootstrap', required=True, type=Path)
    parser.add_argument('--grants', required=True, type=Path)
    parser.add_argument('--reuse-snapshot', type=Path, help='Restore an existing private snapshot without querying Supabase again')
    args = parser.parse_args()
    if not re.fullmatch(r'migration_[a-z0-9_]{1,40}', args.target):
        parser.error('target must be a migration_ scratch database name')
    os.umask(0o077)
    directory = ROOT / 'migrations' / args.target
    directory.mkdir(parents=True, exist_ok=False)
    local = ['docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'exec', '-T', 'database']
    def source_run(*command, **options):
        return subprocess.run(source + list(command), env=environment, check=True, **options)
    def local_run(*command, **options):
        return subprocess.run(local + list(command), check=True, **options)
    # A single read-only transaction exports a snapshot used by pg_dump and all
    # validation queries; concurrent production writes cannot skew comparison.
    if args.reuse_snapshot is None:
        values = dict(line.split('=', 1) for line in Path('/opt/fujipp/env/fujipp-official.production.env').read_text().splitlines()
                      if line and not line.startswith('#') and '=' in line)
        url = urlsplit(values['DB_URL'].removeprefix('jdbc:'))
        environment = os.environ.copy()
        environment.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGDATABASE=url.path.lstrip('/'),
                           PGUSER=values['DB_USERNAME'], PGPASSWORD=values['DB_PASSWORD'], PGSSLMODE='require',
                           PGCONNECT_TIMEOUT='15', PGAPPNAME='fujipp-migration-snapshot')
        source = ['docker', 'run', '--rm', '-i', '--network=host']
        for key in ('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGCONNECT_TIMEOUT', 'PGAPPNAME'):
            source += ['-e', key]
        source += ['postgres:17-alpine']
        session = subprocess.Popen(source + ['psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], env=environment,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
        def query(sql):
            session.stdin.write(sql + '\n')
            session.stdin.flush()
            line = session.stdout.readline()
            if not line:
                raise RuntimeError('Source snapshot session terminated')
            return line.rstrip('\n')
        try:
            assert query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;') == 'BEGIN'
            snapshot = query('SELECT pg_export_snapshot();')
            schema_parameters = [item for schema in SCHEMAS for item in ('--schema', schema)]
            archive = directory / 'application.dump'
            with archive.open('xb') as output:
                source_run('pg_dump', '--format=custom', '--no-owner', '--no-acl', '--snapshot', snapshot,
                           *schema_parameters, stdout=output)
            # Only identity/display fields. No passwords, provider identities,
            # sessions, refresh tokens, phone numbers, or login timestamps.
            identity_sql = """SELECT coalesce(json_agg(json_build_object('id',id,'email',email,
                'raw_user_meta_data',jsonb_build_object(
                    'display_name',raw_user_meta_data->'display_name','full_name',raw_user_meta_data->'full_name',
                    'name',raw_user_meta_data->'name','first_name',raw_user_meta_data->'first_name',
                    'last_name',raw_user_meta_data->'last_name','avatar_url',raw_user_meta_data->'avatar_url',
                    'picture',raw_user_meta_data->'picture'))),'[]') FROM auth.users;"""
            identities = query(identity_sql.replace('\n', ' '))
            (directory / 'identities.json').write_text(identities)
            tables = json.loads(query("SELECT coalesce(json_agg(json_build_array(schemaname,tablename) ORDER BY schemaname,tablename),'[]') FROM pg_tables WHERE schemaname IN (" + ','.join("'"+s+"'" for s in SCHEMAS) + ');'))
            expected = {}
            for schema, table in tables:
                identifier = '"' + schema.replace('"', '""') + '"."' + table.replace('"', '""') + '"'
                # Canonical row serialization sorted by hash validates all column
                # values without logging any actual user data or financial details.
                fingerprint = query('SELECT json_build_array(count(*),md5(coalesce(string_agg(h,\'\' ORDER BY h),\'\'))) FROM (SELECT md5(row_to_json(t)::text) h FROM ' + identifier + ' t) q;')
                expected[schema + '.' + table] = json.loads(fingerprint)
            (directory / 'source-fingerprints.json').write_text(json.dumps(expected, indent=2))
        finally:
            if session.poll() is None:
                session.stdin.write('ROLLBACK;\n\\q\n')
                session.stdin.flush()
                session.wait(timeout=20)
    else:
        for name in ('application.dump', 'identities.json', 'source-fingerprints.json'):
            shutil.copyfile(args.reuse_snapshot / name, directory / name)
        archive = directory / 'application.dump'
        identities = (directory / 'identities.json').read_text()
        expected = json.loads((directory / 'source-fingerprints.json').read_text())
        tables = [key.split('.', 1) for key in expected]
    # No existing database is overwritten. Leave a failed scratch restore for
    # diagnosis, never remove a database in this tool.
    local_run('createdb', '-U', 'postgres', '--template=template0', args.target)
    with args.bootstrap.open('rb') as source_file:
        local_run('psql', '-X', '-U', 'postgres', '-d', args.target, '-v', 'ON_ERROR_STOP=1', stdin=source_file)
    # COPY raw JSON into one staging column using psql variables via stdin.
    # Dollar quoting is generated until absent from the payload.
    marker = '$identity_projection$'
    while marker in identities:
        marker = marker[:-1] + '_$'
    sql = 'INSERT INTO auth.users SELECT * FROM jsonb_populate_recordset(NULL::auth.users,' + marker + identities + marker + '::jsonb);'
    local_run('psql', '-X', '-U', 'postgres', '-d', args.target, '-v', 'ON_ERROR_STOP=1', input=sql.encode())
    with archive.open('rb') as source_file:
        local_run('pg_restore', '-U', 'postgres', '-d', args.target, '--no-owner', '--no-acl',
                  '--exit-on-error', '--single-transaction', stdin=source_file)
    with args.grants.open('rb') as source_file:
        local_run('psql', '-X', '-U', 'postgres', '-d', args.target, '-v', 'ON_ERROR_STOP=1', stdin=source_file)
    mismatches = []
    for schema, table in tables:
        identifier = '"' + schema.replace('"', '""') + '"."' + table.replace('"', '""') + '"'
        sql = 'SELECT json_build_array(count(*),md5(coalesce(string_agg(h,\'\' ORDER BY h),\'\'))) FROM (SELECT md5(row_to_json(t)::text) h FROM ' + identifier + ' t) q;'
        result = local_run('psql', '-X', '-U', 'postgres', '-d', args.target, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql,
                           capture_output=True, text=True)
        if json.loads(result.stdout) != expected[schema + '.' + table]:
            mismatches.append(schema + '.' + table)
    report = {'target': args.target, 'tables_checked': len(tables), 'rows_checked': sum(v[0] for v in expected.values()),
              'archive_bytes': archive.stat().st_size, 'mismatched_tables': mismatches,
              'production_connection_changed': False}
    (directory / 'validation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    if mismatches:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
