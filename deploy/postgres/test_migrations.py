import copy
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import subprocess

from bundle import build
from delivery import active_database, verify_bundle
from migrationlib import MigrationError, ROOT, append_only, catalog, feature_checks, mask_literals, plan, validate_sql


class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files, cls.legacy = catalog()
        cls.history = [{key: item[key] for key in ('version', 'name', 'historySha256')} for item in cls.legacy.values()]

    def test_current_production_history_requires_no_old_sql(self):
        result = plan(self.files, self.legacy, self.history, {})
        self.assertEqual(result['pending'], [])
        self.assertEqual(len(result['adopt']), 70)

    def test_legacy_source_or_history_drift_fails(self):
        version = min(self.files)
        for mode in ('file', 'history', 'name', 'deleted'):
            files, history = copy.deepcopy(self.files), copy.deepcopy(self.history)
            if mode == 'file': files[version]['sha256'] = '0' * 64
            if mode == 'history': history[0]['historySha256'] = '0' * 64
            if mode == 'name': history[0]['name'] = 'renamed'
            if mode == 'deleted': del files[version]
            with self.subTest(mode=mode), self.assertRaises(MigrationError):
                plan(files, self.legacy, history, {})

    def test_unknown_manual_history_is_not_silently_adopted(self):
        files = {**self.files, '20990101000001': {'name': 'manual', 'sha256': 'a' * 64}}
        history = [*self.history, {'version': '20990101000001', 'name': 'manual', 'historySha256': 'b' * 64}]
        with self.assertRaises(MigrationError):
            plan(files, self.legacy, history, {})

    def test_missing_baseline_history_never_replays_old_financial_sql(self):
        with self.assertRaises(MigrationError):
            plan(self.files, self.legacy, self.history[1:], {})

    def test_newer_migrations_are_pending_in_order(self):
        files = {**self.files, '20990101000001': {'name': 'first'}, '20990101000002': {'name': 'second'}}
        self.assertEqual(plan(files, self.legacy, self.history, {})['pending'], ['20990101000001', '20990101000002'])
        files['20260726000001'] = {'name': 'backdated'}
        with self.assertRaises(MigrationError):
            plan(files, self.legacy, self.history, {})

    def test_sql_guard_ignores_function_bodies_literals_and_nested_comments(self):
        sql = "/* BEGIN /* COMMIT */ END */ DO $body$ BEGIN RAISE NOTICE 'COMMIT;'; END $body$; SELECT 'rollback;';"
        validate_sql(sql)
        self.assertNotIn('COMMIT', mask_literals(sql))
        validate_sql("SELECT E'\\\'COMMIT;';")

    def test_sql_cannot_commit_early_or_run_client_meta_commands(self):
        for sql in ['COMMIT;', 'END;', 'BEGIN;', 'ROLLBACK;', 'START TRANSACTION;',
                    'PREPARE TRANSACTION \'x\';', 'CREATE INDEX CONCURRENTLY x ON public.x(id);',
                    'VACUUM;', 'COPY public.x FROM STDIN;', '\\! echo escaped', 'SELECT 1;\\q',
                    'SELECT $unfinished$ COMMIT;', '/* unclosed', "SELECT 'unclosed"]:
            with self.subTest(sql=sql), self.assertRaises(MigrationError):
                validate_sql(sql)

    def test_wallet_expands_dependents_but_ticket_stays_local(self):
        wallet = feature_checks(['supabase/migrations/20990101000001_wallet_probe.sql'])
        self.assertIn('role-shop', wallet['features'])
        self.assertIn('roblox-payout', wallet['features'])
        self.assertNotIn('ticket', wallet['features'])
        ticket = feature_checks(['supabase/migrations/20990101000001_ticket_probe.sql'])
        self.assertEqual(ticket['features'], ['ticket'])
        self.assertIn('deploy/postgres/checks/wallet.sql', ticket['paths'])

    def test_unknown_migration_uses_all_contract_checks(self):
        self.assertEqual(feature_checks(['20990101000001_unknown.sql'])['paths'], feature_checks([])['paths'])

    def test_bundle_excludes_credentials_backups_and_vps_bootstrap(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'database.tgz'
            digest = build(archive, '1' * 40)
            self.assertEqual(digest, hashlib.sha256(archive.read_bytes()).hexdigest())
            with tarfile.open(archive) as bundle:
                names = bundle.getnames()
                self.assertFalse(any('secrets/' in name or 'backups/' in name or '/vps/' in name or name.endswith('.env') for name in names))
                bundle.extractall(Path(directory) / 'source')
            root = Path(directory) / 'source'
            verify_bundle(root, '1' * 40)
            (root / next(iter(self.files.values()))['path']).write_text('SELECT 1;')
            with self.assertRaises(MigrationError): verify_bundle(root, '1' * 40)

    def test_bundle_rejects_wrong_revision_and_untracked_payload(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'database.tgz'
            build(archive, '1' * 40)
            with tarfile.open(archive) as bundle: bundle.extractall(directory + '/source')
            root = Path(directory) / 'source'
            with self.assertRaises(MigrationError): verify_bundle(root, '2' * 40)
            (root / 'extra.sql').write_text('SELECT 1;')
            with self.assertRaises(MigrationError): verify_bundle(root, '1' * 40)

    def test_active_database_comes_from_backend_and_must_match_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = root / 'runtime.env'
            env.write_text('DB_URL=jdbc:postgresql://database:5432/migration_cutover_fixture\nDB_USERNAME=fujipp_backend\n')
            with self.assertRaises(MigrationError): active_database(root, env)
            (root / 'backup-database').write_text('migration_cutover_fixture\n')
            self.assertEqual(active_database(root, env), 'migration_cutover_fixture')
            env.write_text('DB_URL=jdbc:postgresql://remote.example:5432/migration_cutover_fixture\nDB_USERNAME=fujipp_backend\n')
            with self.assertRaises(MigrationError): active_database(root, env)

    def test_git_comparison_rejects_edits_deletions_and_backdated_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            migrations = root / 'supabase/migrations'
            migrations.mkdir(parents=True)
            original = migrations / '20990101000001_first.sql'
            original.write_text('SELECT 1;')
            config = root / 'deploy/postgres'
            config.mkdir(parents=True)
            (config / 'legacy-baseline.json').write_text('{"version":1,"migrations":[]}')
            def git(*args):
                return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=CI Fixture',
                    '-c', 'user.email=ci@example.invalid', *args], cwd=root, stderr=subprocess.DEVNULL, text=True).strip()
            git('init', '--quiet')
            git('add', '.')
            git('commit', '--quiet', '--no-gpg-sign', '-m', 'fixture')
            base = git('rev-parse', 'HEAD')
            append_only(base, root)
            original.write_text('SELECT 2;')
            with self.assertRaises(MigrationError): append_only(base, root)
            original.unlink()
            with self.assertRaises(MigrationError): append_only(base, root)
            original.write_text('SELECT 1;')
            earlier = migrations / '20980101000001_backdated.sql'
            earlier.write_text('SELECT 1;')
            with self.assertRaises(MigrationError): append_only(base, root)
            earlier.unlink()
            (migrations / '20990101000002_next.sql').write_text('SELECT 2;')
            append_only(base, root)


if __name__ == '__main__':
    unittest.main()
