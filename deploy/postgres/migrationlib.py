"""Transactional PostgreSQL migrations; no network access except the supplied client."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
NAME = re.compile(r'([0-9]{14})_([a-z][a-z0-9_]*)\.sql')
HASH_SQL = "encode(sha256(convert_to(to_json(statements)::text,'UTF8')),'hex')"
HISTORY_SQL = "SELECT coalesce(json_agg(json_build_object('version',version,'name',name,'historySha256'," + HASH_SQL + ") ORDER BY version),'[]') FROM supabase_migrations.schema_migrations"
CHECKSUM_DDL = """
CREATE TABLE IF NOT EXISTS supabase_migrations.ci_checksums (
    version text PRIMARY KEY REFERENCES supabase_migrations.schema_migrations(version),
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    history_sha256 text NOT NULL CHECK (history_sha256 ~ '^[0-9a-f]{64}$'),
    source_commit text NOT NULL CHECK (source_commit ~ '^[0-9a-f]{40}$'),
    recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON supabase_migrations.ci_checksums FROM PUBLIC, anon, authenticated, service_role, fujipp_backend;
"""


class MigrationError(RuntimeError):
    pass


def literal(value):
    # PostgreSQL standard_conforming_strings is enforced by the client.
    return "'" + str(value).replace("'", "''") + "'"


def file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def mask_literals(sql):
    """Keep statement syntax, mask quoted bodies and nested comments for linting.

    PostgreSQL still parses the actual SQL during the disposable rehearsal.
    This is a transaction-control guard, not a general SQL parser/security sandbox.
    """
    output = list(sql)
    i = 0
    while i < len(sql):
        start = i
        if sql.startswith('--', i):
            end = sql.find('\n', i)
            i = len(sql) if end < 0 else end
        elif sql.startswith('/*', i):
            depth = 1
            i += 2
            while i < len(sql) and depth:
                if sql.startswith('/*', i):
                    depth += 1
                    i += 2
                elif sql.startswith('*/', i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise MigrationError('Unterminated SQL comment')
        elif sql[i] in "'\"":
            quote = sql[i]
            escaped = quote == "'" and i > 0 and sql[i-1] in 'eE' and (i < 2 or not (sql[i-2].isalnum() or sql[i-2] == '_'))
            i += 1
            while i < len(sql):
                if sql[i] == '\\' and escaped:
                    i += 2
                elif sql[i] == quote:
                    i += 1
                    if i < len(sql) and sql[i] == quote:
                        i += 1
                    else:
                        break
                else:
                    i += 1
            else:
                raise MigrationError('Unterminated SQL quote')
        elif sql[i] == '$' and (match := re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', sql[i:])):
            tag = match.group()
            end = sql.find(tag, i + len(tag))
            if end < 0:
                raise MigrationError('Unterminated SQL dollar quote')
            i = end + len(tag)
        else:
            if sql[i] == '\\':
                raise MigrationError('psql meta-commands are not allowed in migrations/checks')
            i += 1
            continue
        output[start:i] = ['\n' if char == '\n' else ' ' for char in sql[start:i]]
    return ''.join(output)


def validate_sql(sql):
    if '\0' in sql:
        raise MigrationError('NUL in SQL')
    masked = mask_literals(sql)
    if not masked.strip():
        raise MigrationError('Empty migration/check')
    for statement in masked.split(';'):
        words = re.findall(r'[A-Za-z_]+', statement.upper())
        if not words:
            continue
        if words[0] in {'BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'ABORT', 'SAVEPOINT', 'RELEASE', 'START', 'VACUUM'}:
            raise MigrationError('Transaction control/nontransactional SQL must not bypass the migration runner')
        if words[:2] in [['PREPARE', 'TRANSACTION'], ['CREATE', 'DATABASE'], ['DROP', 'DATABASE'], ['ALTER', 'SYSTEM']]:
            raise MigrationError('Database/transaction administration is not a migration')
        if 'CONCURRENTLY' in words or words[:2] == ['COPY', 'FROM'] or ('COPY' in words and 'STDIN' in words):
            raise MigrationError('Nontransactional indexes/COPY STDIN need a separately reviewed operation')


def catalog(root=ROOT):
    directory = root / 'supabase/migrations'
    baseline = json.loads((root / 'deploy/postgres/legacy-baseline.json').read_text())
    if baseline['version'] != 1:
        raise MigrationError('Unsupported legacy baseline')
    legacy = {item['version']: item for item in baseline['migrations']}
    files = {}
    for path in sorted(directory.glob('*.sql')):
        match = NAME.fullmatch(path.name)
        if not match or path.is_symlink():
            raise MigrationError('Invalid migration filename: ' + path.name)
        version, name = match.groups()
        if version in files:
            raise MigrationError('Duplicate migration version: ' + version)
        sql = path.read_text(encoding='utf-8')
        validate_sql(sql)
        item = {'version': version, 'name': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'path': path.relative_to(root).as_posix(), 'sql': sql}
        files[version] = item
    for version, item in legacy.items():
        if version not in files or any(files[version][key] != item[key] for key in ('name', 'path', 'sha256')):
            raise MigrationError('Immutable legacy migration changed or disappeared: ' + version)
    return files, legacy


def append_only(base, root=ROOT):
    if not base:
        return
    if not re.fullmatch(r'[0-9a-f]{40}', base):
        raise MigrationError('Invalid Git comparison SHA')
    result = subprocess.run(['git', 'ls-tree', '-rz', '--name-only', base, 'supabase/migrations/'],
                            cwd=root, capture_output=True, check=True)
    old = {}
    for name in result.stdout.decode().split('\0'):
        if not name or Path(name).parent.as_posix() != 'supabase/migrations' or not name.endswith('.sql'):
            continue
        path = root / name
        content = subprocess.check_output(['git', 'show', base + ':' + name], cwd=root)
        if not path.is_file() or path.read_bytes() != content:
            raise MigrationError('Existing migrations are append-only: ' + name)
        old[NAME.fullmatch(Path(name).name)[1]] = name
    files, _ = catalog(root)
    if old and any(version <= max(old) for version in files if version not in old):
        raise MigrationError('New migration versions must follow the previous maximum')
    path = 'deploy/postgres/legacy-baseline.json'
    previous = subprocess.run(['git', 'show', base + ':' + path], cwd=root, capture_output=True)
    if previous.returncode == 0 and previous.stdout != (root / path).read_bytes():
        raise MigrationError('The legacy adoption baseline is immutable')


class Database:
    def __init__(self, prefix, name, private_log=None):
        if not re.fullmatch(r'[a-z][a-z0-9_]{0,62}', name):
            raise MigrationError('Invalid database name')
        self.prefix, self.name, self.private_log = prefix, name, private_log

    def command(self, *args, input=None, output=None, stdin=None):
        result = subprocess.run([*self.prefix, *args], input=input, stdout=output or subprocess.PIPE,
                                stderr=subprocess.PIPE, stdin=stdin)
        if result.returncode:
            if self.private_log:
                with self.private_log.open('ab') as log:
                    log.write(result.stderr)
                raise MigrationError('PostgreSQL command failed; inspect the private VPS log')
            raise MigrationError(result.stderr.decode(errors='replace'))
        return result.stdout

    def sql(self, sql):
        return self.command('psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', self.name,
                            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=terse',
                            '-c', "SET standard_conforming_strings=on;", '-f', '-', input=sql.encode()).decode().strip()

    def history(self):
        # No customer rows or SQL bodies leave PostgreSQL.
        history = json.loads(self.sql('BEGIN READ ONLY;\n' + HISTORY_SQL + ';\nROLLBACK;'))
        present = self.sql("SELECT to_regclass('supabase_migrations.ci_checksums') IS NOT NULL;") == 't'
        checksums = json.loads(self.sql("SELECT coalesce(json_agg(json_build_object('version',version,'sha256',sha256,'historySha256',history_sha256) ORDER BY version),'[]') FROM supabase_migrations.ci_checksums;")) if present else []
        return history, {item['version']: item for item in checksums}


def plan(files, legacy, history, checksums, require_legacy=True):
    deployed = {item['version']: item for item in history}
    if len(deployed) != len(history):
        raise MigrationError('Duplicate deployed versions')
    if require_legacy and not legacy.keys() <= deployed.keys():
        raise MigrationError('Production is missing legacy history; refuse to replay historical migrations')
    adopt = []
    if not checksums.keys() <= deployed.keys():
        raise MigrationError('Checksum history has orphaned versions')
    for version, record in deployed.items():
        file = files.get(version)
        if not file or record['name'] != file['name']:
            raise MigrationError('Unknown, removed or renamed applied migration: ' + version)
        expected = checksums.get(version) or legacy.get(version)
        if not expected or any(expected[key] != value for key, value in [('sha256', file['sha256']), ('historySha256', record['historySha256'])]):
            raise MigrationError('Migration checksum/history drift: ' + version)
        if version not in checksums:
            adopt.append(version)
    pending = sorted(version for version in files if version not in deployed)
    if deployed and any(version <= max(deployed) for version in pending):
        raise MigrationError('Out-of-order pending migration; create a new version instead')
    return {'pending': pending, 'adopt': adopt, 'history': history, 'checksums': checksums}


def transaction(files, selected, commit, checks=()):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise MigrationError('Expected an immutable source commit')
    expected = literal(json.dumps(selected['history'], separators=(',', ':')))
    chunks = ["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';",
              "DO $$ BEGIN IF NOT pg_try_advisory_xact_lock(728469, 1) THEN RAISE EXCEPTION 'Another migration is running'; END IF; END $$;",
              'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;',
              "DO $$ BEGIN IF (" + HISTORY_SQL + ")::jsonb IS DISTINCT FROM " + expected + "::jsonb THEN RAISE EXCEPTION 'Migration history changed after planning'; END IF; END $$;",
              CHECKSUM_DDL,
              'LOCK TABLE supabase_migrations.ci_checksums IN SHARE ROW EXCLUSIVE MODE;',
              "DO $$ BEGIN IF (SELECT coalesce(jsonb_object_agg(version,jsonb_build_object('version',version,'sha256',sha256,'historySha256',history_sha256)),'{}') FROM supabase_migrations.ci_checksums) IS DISTINCT FROM "
              + literal(json.dumps(selected['checksums'])) + "::jsonb THEN RAISE EXCEPTION 'Checksum history changed after planning'; END IF; END $$;"]
    for version in selected['adopt'] + selected['pending']:
        file = files[version]
        if version in selected['pending']:
            chunks += ['SET LOCAL search_path=public,extensions;', file['sql'] + '\n;',
                       'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('
                       + ','.join([literal(version), literal(file['name']), 'ARRAY[' + literal(file['sql']) + ']']) + ');']
        chunks.append('INSERT INTO supabase_migrations.ci_checksums(version,sha256,history_sha256,source_commit) SELECT '
                      + ','.join([literal(version), literal(file['sha256']), HASH_SQL, literal(commit)])
                      + ' FROM supabase_migrations.schema_migrations WHERE version=' + literal(version) + ';')
    for sql in checks:
        validate_sql(sql)
        chunks += ['SET LOCAL search_path=public,extensions;', sql + '\n;']
    old_hashes = {item['version']: item['historySha256'] for item in selected['history']}
    expected_files = {version: {'name': item['name'], 'sha256': item['sha256'],
                                'oldHistorySha256': old_hashes.get(version)} for version, item in files.items()}
    chunks.append("DO $$ DECLARE entry record; BEGIN "
                  "IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> " + str(len(files))
                  + " OR (SELECT count(*) FROM supabase_migrations.ci_checksums) <> " + str(len(files))
                  + " THEN RAISE EXCEPTION 'Final migration inventory is inconsistent'; END IF; "
                  "FOR entry IN SELECT * FROM jsonb_each(" + literal(json.dumps(expected_files)) + "::jsonb) LOOP "
                  "IF NOT EXISTS (SELECT FROM supabase_migrations.schema_migrations h "
                  "JOIN supabase_migrations.ci_checksums c USING(version) WHERE version=entry.key "
                  "AND h.name=entry.value->>'name' AND c.sha256=entry.value->>'sha256' "
                  "AND c.history_sha256=encode(sha256(convert_to(to_json(h.statements)::text,'UTF8')),'hex') "
                  "AND (entry.value->>'oldHistorySha256' IS NULL OR c.history_sha256=entry.value->>'oldHistorySha256')) "
                  "THEN RAISE EXCEPTION 'Final migration checksums/history are inconsistent'; END IF; END LOOP; END $$;")
    chunks.append('COMMIT;')
    return '\n'.join(chunks)


def feature_checks(changed, root=ROOT):
    config = json.loads((root / 'deploy/postgres/feature-map.json').read_text())
    if config['version'] != 1:
        raise MigrationError('Unsupported database feature map')
    features = config['features']
    scopes = set()
    import fnmatch
    for path in changed:
        matches = {name for name, feature in features.items()
                   if any(fnmatch.fnmatchcase(Path(path).name, rule) for rule in feature['migrations'])}
        if not matches:
            scopes.update(features)
        else:
            scopes.update(matches)
    if not changed:
        scopes.update(features)
    queue = list(scopes)
    for scope in queue:
        for name, feature in features.items():
            if scope in feature['dependsOn'] and name not in scopes:
                scopes.add(name)
                queue.append(name)
    paths = set(config['baselineChecks'])
    for name in scopes:
        paths.update(features[name]['checks'])
    for feature in features.values():
        if any(name not in features for name in feature['dependsOn']):
            raise MigrationError('Unknown feature dependency')
        if any(not (root / path).is_file() for path in feature['guides']):
            raise MigrationError('Missing database feature guide')
        if any(not re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', name) for name in feature['objects']):
            raise MigrationError('Invalid owned database object')
    checked = []
    for path in sorted(paths):
        if not path.startswith('deploy/postgres/checks/') or not path.endswith('.sql') or (root / path).is_symlink():
            raise MigrationError('Invalid database check path')
        sql = (root / path).read_text()
        validate_sql(sql)
        checked.append(sql)
    objects = sorted({name for scope in scopes for name in features[scope]['objects']})
    if objects:
        checked.append("DO $$ DECLARE target text; BEGIN FOREACH target IN ARRAY ARRAY["
                       + ','.join(literal(name) for name in objects)
                       + "] LOOP IF to_regclass(target) IS NULL THEN RAISE EXCEPTION 'Declared feature object is missing'; END IF; END LOOP; END $$;")
    return {'features': sorted(scopes), 'paths': sorted(paths), 'sql': checked}
