#!/usr/bin/env python3
"""Real PostgreSQL regressions in the disposable CI cluster only."""
import hashlib
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from types import SimpleNamespace
import unittest
import uuid

from migrationlib import Database, MigrationError, plan, transaction
from bundle import build
from delivery import execute
from ci import wait_for_postgres

CONTAINER = sys.argv.pop(1) if len(sys.argv) > 1 else ''


class ReadinessTests(unittest.TestCase):
    def test_socket_only_bootstrap_must_not_release_the_ci_readiness_gate(self):
        name = 'fujipp-db-ci-startup-' + uuid.uuid4().hex[:12]
        # Generate the fixture inside the disposable container so host file-share
        # permissions cannot affect the entrypoint's non-root initialization.
        hold = ("printf '%s\\n' 'touch /tmp/fujipp-initializing' "
                "'while [ ! -f /tmp/fujipp-continue ]; do sleep 0.1; done' "
                ">/docker-entrypoint-initdb.d/99-hold.sh; exec /usr/local/bin/docker-entrypoint.sh postgres")
        subprocess.run(['docker', 'run', '-d', '--name', name, '--network', 'none', '--memory', '1g',
            '--tmpfs', '/var/lib/postgresql/data:rw,size=1073741824',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine', 'sh', '-c', hold],
            check=True, stdout=subprocess.DEVNULL)
        prefix = ['docker', 'exec', '-i', name]
        try:
            deadline = time.monotonic() + 30
            while subprocess.run([*prefix, 'test', '-f', '/tmp/fujipp-initializing'],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
                if time.monotonic() > deadline:
                    self.fail('Temporary bootstrap server did not start')
                time.sleep(0.1)
            # This was the original false-positive readiness signal.
            self.assertEqual(subprocess.run([*prefix, 'pg_isready', '-U', 'postgres'],
                                            stdout=subprocess.DEVNULL).returncode, 0)
            with ThreadPoolExecutor(max_workers=1) as executor:
                ready = executor.submit(wait_for_postgres, prefix)
                try:
                    with self.assertRaises(TimeoutError):
                        ready.result(timeout=0.5)
                finally:
                    subprocess.run([*prefix, 'touch', '/tmp/fujipp-continue'], check=True)
                    ready.result(timeout=30)
            # The final instance must support the next real CI operation.
            Database(prefix, 'postgres').command('createdb', '-U', 'postgres', 'readiness_probe')
        finally:
            subprocess.run(['docker', 'rm', '-f', name], check=True, stdout=subprocess.DEVNULL)


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.name = 'migration_ci_' + uuid.uuid4().hex[:16]
        prefix = ['docker', 'exec', '-i', CONTAINER]
        self.db = Database(prefix, self.name)
        self.db.command('createdb', '-U', 'postgres', '-T', 'migration_ci_checks', self.name)

    def tearDown(self):
        self.db.command('dropdb', '-U', 'postgres', '--if-exists', self.name)

    def fixture(self, sql, version='20990101000001'):
        history, checksums = self.db.history()
        file = {'version': version, 'name': 'ci_probe', 'sql': sql, 'sha256': hashlib.sha256(sql.encode()).hexdigest()}
        files = {record['version']: {'version': record['version'], 'name': record['name'],
                                    'sha256': checksums[record['version']]['sha256']} for record in history}
        files[version] = file
        return files, plan(files, {}, history, checksums, require_legacy=False)

    def test_sql_history_and_checksums_commit_together_and_repeat_is_empty(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint); ALTER TABLE public.ci_probe ENABLE ROW LEVEL SECURITY;')
        self.db.sql(transaction(files, selected, '1' * 40))
        history, hashes = self.db.history()
        self.assertEqual(hashes['20990101000001']['sha256'], files['20990101000001']['sha256'])
        self.assertFalse(plan(files, {}, history, hashes, require_legacy=False)['pending'])

    def test_failed_batch_rolls_back_ddl_history_and_hashes(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint);')
        sql = 'SELECT 1/0;'
        files['20990101000002'] = {'name': 'second', 'sql': sql, 'sha256': hashlib.sha256(sql.encode()).hexdigest()}
        selected = plan(files, {}, *self.db.history(), require_legacy=False)
        before = self.db.history()
        with self.assertRaises(MigrationError):
            self.db.sql(transaction(files, selected, '1' * 40))
        self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_probe') IS NULL"), 't')
        self.assertEqual(self.db.history(), before)

    def test_failed_contract_check_also_rolls_back_the_migration(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint);')
        with self.assertRaises(MigrationError):
            self.db.sql(transaction(files, selected, '1' * 40, ['DO $$ BEGIN RAISE EXCEPTION \'check failed\'; END $$;']))
        self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_probe') IS NULL"), 't')

    def test_migration_cannot_change_previously_applied_history(self):
        files, selected = self.fixture("CREATE TABLE public.ci_probe(id bigint); UPDATE supabase_migrations.schema_migrations SET name='changed' WHERE version=(SELECT min(version) FROM supabase_migrations.schema_migrations);")
        before = self.db.history()
        with self.assertRaisesRegex(MigrationError, 'inconsistent'):
            self.db.sql(transaction(files, selected, '1' * 40))
        self.assertEqual(self.db.history(), before)
        self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_probe') IS NULL"), 't')

    def test_history_changed_since_planning_stops_before_migration(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint);')
        self.db.sql("UPDATE supabase_migrations.schema_migrations SET name='changed' WHERE version=(SELECT min(version) FROM supabase_migrations.schema_migrations);")
        with self.assertRaisesRegex(MigrationError, 'changed after planning'):
            self.db.sql(transaction(files, selected, '1' * 40))
        self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_probe') IS NULL"), 't')

    def test_checksum_changed_since_planning_stops_before_migration(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint);')
        self.db.sql("UPDATE supabase_migrations.ci_checksums SET sha256=repeat('a',64) WHERE version=(SELECT min(version) FROM supabase_migrations.ci_checksums);")
        with self.assertRaisesRegex(MigrationError, 'changed after planning'):
            self.db.sql(transaction(files, selected, '1' * 40))
        self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_probe') IS NULL"), 't')

    def test_legacy_adoption_records_only_metadata(self):
        history, checksums = self.db.history()
        version = history[0]['version']
        self.db.sql("DELETE FROM supabase_migrations.ci_checksums WHERE version='" + version + "';")
        legacy = {version: {**history[0], 'sha256': checksums[version]['sha256']}}
        files = {record['version']: {'name': record['name'], 'sha256': checksums[record['version']]['sha256'],
                                    'sql': 'SELECT 1/0; -- must never replay an adopted file'} for record in history}
        selected = plan(files, legacy, *self.db.history())
        self.assertEqual(selected['adopt'], [version])
        self.assertFalse(selected['pending'])
        self.db.sql(transaction(files, selected, '1' * 40))
        self.assertIn(version, self.db.history()[1])

    def test_advisory_lock_blocks_an_independent_migration_session(self):
        files, selected = self.fixture('CREATE TABLE public.ci_probe(id bigint);')
        args = [*self.db.prefix, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', self.name]
        holder = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            holder.stdin.write("BEGIN; SELECT pg_advisory_xact_lock(728469,1); SELECT 'locked';\n")
            holder.stdin.flush()
            while holder.stdout.readline().strip() != 'locked':
                if holder.poll() is not None:
                    self.fail('Lock session exited')
            with self.assertRaisesRegex(MigrationError, 'Another migration'):
                self.db.sql(transaction(files, selected, '1' * 40))
        finally:
            holder.stdin.write('ROLLBACK;\n\\q\n')
            holder.stdin.flush()
            holder.communicate(timeout=10)

    def wallet_fixture(self):
        owner, bot = str(uuid.uuid4()), str(uuid.uuid4())
        self.db.sql(f"INSERT INTO auth.users(id,email) VALUES ('{owner}','wallet-test@example.invalid');"
                    f"INSERT INTO bots.bot_instances(id,owner_user_id,name) VALUES ('{bot}','{owner}','Synthetic wallet');")
        return bot

    def wallet_receipt(self, bot, *, legacy=False, status='SUCCEEDED', fee=500, mode='FIXED', payment=False):
        receipt = str(uuid.uuid4())
        digest = hashlib.sha256(receipt.encode()).hexdigest()
        policy = '' if legacy else ',wallet_flow_version,wallet_fee_mode,wallet_fee_value'
        values = '' if legacy else f",2,'{mode}',{fee}"
        outcome = ",200000,'synthetic-"+receipt+"',now()" if status == 'SUCCEEDED' else ',NULL,NULL,NULL'
        payment_cols = ',payment_message_id,expected_amount_satang' if payment else ''
        payment_values = ",'999999999999999999',200000" if payment else ''
        self.db.sql(f"INSERT INTO private.truemoney_voucher_redemptions"
                    f"(id,bot_id,member_discord_id,recipient_phone,voucher_hash,request_fingerprint,idempotency_key,status,amount_satang,upstream_reference,completed_at{policy}{payment_cols})"
                    f"VALUES ('{receipt}','{bot}','111111111111111111','0812345678','{digest}','{digest}','synthetic:{receipt}','{status}'{outcome}{values}{payment_values});")
        return receipt

    def settle_wallet(self, receipt, bot, member='111111111111111111'):
        return self.db.sql(f"SELECT created FROM private.settle_truemoney_wallet('{receipt}','{bot}','{member}');")

    def test_wallet_verified_receipt_concurrent_replays_credit_only_once(self):
        bot = self.wallet_fixture()
        receipt = self.wallet_receipt(bot)
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: self.settle_wallet(receipt,bot), range(8)))
        self.assertEqual(results.count('t'),1)
        self.assertEqual(self.db.sql(f"SELECT balance_satang FROM private.member_wallets WHERE bot_id='{bot}'"),'199500')
        self.assertEqual(self.db.sql(f"SELECT count(*) FROM private.member_wallet_entries WHERE bot_id='{bot}'"),'1')
        self.assertEqual(self.db.sql(f"SELECT metadata->>'grossSatang'||':'||(metadata->>'feeSatang') FROM private.member_wallet_entries WHERE bot_id='{bot}'"),'200000:500')
        with self.assertRaises(MigrationError):
            self.db.sql(f"UPDATE private.truemoney_voucher_redemptions SET wallet_fee_value=1 WHERE id='{receipt}'")
        with self.assertRaises(MigrationError):
            self.db.sql(f"UPDATE private.member_wallet_entries SET amount_satang=1 WHERE bot_id='{bot}'")
        with self.assertRaises(MigrationError):
            self.db.sql(f"DELETE FROM private.member_wallet_entries WHERE bot_id='{bot}'")
        self.assertEqual(self.settle_wallet(receipt,bot),'f')

    def test_wallet_ledger_link_failure_rolls_back_the_balance_and_recovers_from_receipt(self):
        bot = self.wallet_fixture()
        receipt = self.wallet_receipt(bot,fee=3,mode='PERCENT')
        self.db.sql("CREATE FUNCTION private.ci_block_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic interruption'; END $$;"
                    "CREATE TRIGGER ci_block_settlement BEFORE UPDATE ON private.truemoney_voucher_redemptions FOR EACH ROW EXECUTE FUNCTION private.ci_block_settlement();")
        with self.assertRaises(MigrationError):
            self.settle_wallet(receipt,bot)
        self.assertEqual(self.db.sql(f"SELECT count(*) FROM private.member_wallet_entries WHERE bot_id='{bot}'"),'0')
        self.assertEqual(self.db.sql(f"SELECT count(*) FROM private.member_wallets WHERE bot_id='{bot}'"),'0')
        self.db.sql('DROP TRIGGER ci_block_settlement ON private.truemoney_voucher_redemptions;')
        self.assertEqual(self.settle_wallet(receipt,bot),'t')
        self.assertEqual(self.db.sql(f"SELECT balance_satang FROM private.member_wallets WHERE bot_id='{bot}'"),'194000')

    def test_wallet_never_credits_legacy_unknown_foreign_or_invoice_receipts(self):
        bot = self.wallet_fixture()
        other = self.wallet_fixture()
        legacy = self.wallet_receipt(bot,legacy=True)
        unknown = self.wallet_receipt(bot,status='REDEEMING')
        payment = self.wallet_receipt(bot,legacy=True,payment=True)
        current = self.wallet_receipt(bot)
        for receipt,target,member in [(legacy,bot,'111111111111111111'),(unknown,bot,'111111111111111111'),
                (payment,bot,'111111111111111111'),(current,other,'111111111111111111'),(current,bot,'222222222222222222')]:
            with self.assertRaises(MigrationError):
                self.settle_wallet(receipt,target,member)
        self.assertEqual(self.db.sql('SELECT count(*) FROM private.member_wallet_entries'),'0')
        self.assertEqual(self.db.sql("SELECT has_function_privilege('fujipp_backend','private.settle_truemoney_wallet(uuid,uuid,text)','EXECUTE')"),'t')
        self.assertEqual(self.db.sql("SELECT has_function_privilege('authenticated','private.settle_truemoney_wallet(uuid,uuid,text)','EXECUTE')"),'f')

    def test_money_shipping_queries_isolate_bots_and_keep_pending_receipts_separate(self):
        from migrationlib import ROOT
        bot, other = self.wallet_fixture(), self.wallet_fixture()
        credited = self.wallet_receipt(bot)
        self.settle_wallet(credited,bot)
        self.settle_wallet(self.wallet_receipt(other),other)
        pending = self.wallet_receipt(bot)
        legacy = self.wallet_receipt(bot,legacy=True)
        self.db.sql(f"SELECT * FROM private.credit_member_wallet('{bot}','111111111111111111',1000,'SLIPOK','synthetic-slip','synthetic-slip-key','{{}}');")
        def query(name, args, suffix=''):
            sql = (ROOT / 'backend/src/main/resources/sql/bot-money' / (name+'.sql')).read_text()
            for value in args:
                sql = sql.replace('?',value,1)
            return self.db.sql(sql.rstrip().rstrip(';')+suffix)
        quoted = "'"+bot+"'"
        result = query('overview',[quoted]*4)
        self.assertEqual(result,'1|200500|199500|1000|1')
        result = query('customers',[quoted,"''",'NULL','NULL','26'])
        self.assertTrue(result.startswith('111111111111111111|200500|200500|'))
        result = query('history',[quoted,quoted,'NULL','NULL',"'TRUEMONEY'","'TRUEMONEY'",'false'])
        self.assertEqual(len(result.splitlines()),3)
        self.assertIn('CREDITED|200000|500|199500',result)
        self.assertIn('RECEIVED_PENDING_CREDIT',result)
        self.assertIn('LEGACY_RECORD',result)
        self.assertNotIn('SLIPOK',result)
        result = query('history',[quoted,quoted,'NULL','NULL','NULL','NULL','true'])
        self.assertEqual(len(result.splitlines()),1)
        self.assertTrue(result.startswith(pending+'|'))
        self.assertNotIn(legacy,result)

        self.db.sql(f"SELECT * FROM private.credit_member_wallet('{bot}','111111111111111111',500,'TRUEMONEY','unlinked-historical-ref','unlinked-historical-key','{{}}');")
        result = query('history',[quoted,quoted,'NULL','NULL',"'TRUEMONEY'","'TRUEMONEY'",'false'])
        self.assertIn('|CREDITED|||500|unlinked-historical-ref||t|',result)
        result = query('history',[quoted,quoted,'NULL','NULL',"'SLIPOK'","'SLIPOK'",'false'])
        self.assertIn('|CREDITED|1000|0|1000|synthetic-slip',result)

    def delivery_fixture(self, directory, sql):
        root = Path(directory)
        archive = root / 'base.tgz'
        build(archive, '1' * 40)
        with tarfile.open(archive) as bundle:
            bundle.extractall(root / 'source')
        source = root / 'source'
        (source / 'supabase/migrations/20990101000001_ci_delivery_probe.sql').write_text(sql)
        build(root / 'candidate.tgz', '1' * 40, source)
        with tarfile.open(root / 'candidate.tgz') as bundle:
            bundle.extractall(root / 'candidate')
        database_dir = root / 'database'
        database_dir.mkdir()
        (database_dir / 'backup-database').write_text(self.name)
        runtime = root / 'runtime.env'
        runtime.write_text('DB_URL=jdbc:postgresql://database:5432/' + self.name + '\nDB_USERNAME=fujipp_backend\n')
        return SimpleNamespace(database_dir=database_dir, runtime_env=runtime, apply=True, commit='1' * 40), root / 'candidate'

    def test_full_delivery_backs_up_restores_applies_and_skips_second_backup(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            args, source = self.delivery_fixture(directory, 'CREATE TABLE public.ci_delivery_probe(id bigint); ALTER TABLE public.ci_delivery_probe ENABLE ROW LEVEL SECURITY;')
            execute(args, source, self.db.prefix)
            self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_delivery_probe') IS NOT NULL;"), 't')
            receipts = list(args.database_dir.glob('migrations/*/receipt.json'))
            self.assertEqual(len(receipts), 1)
            self.assertEqual(json.loads(receipts[0].read_text())['status'], 'succeeded')
            self.assertGreater((receipts[0].parent / 'before.dump').stat().st_size, 0)
            execute(args, source, self.db.prefix)
            self.assertEqual(list(args.database_dir.glob('migrations/*/receipt.json')), receipts)

    def test_failed_rehearsal_never_applies_sql_to_the_target(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            args, source = self.delivery_fixture(directory, 'CREATE TABLE public.ci_delivery_probe(id bigint); SELECT 1/0;')
            before = self.db.history()
            with self.assertRaises(MigrationError):
                execute(args, source, self.db.prefix)
            self.assertEqual(self.db.history(), before)
            self.assertEqual(self.db.sql("SELECT to_regclass('public.ci_delivery_probe') IS NULL;"), 't')
            receipt = next(args.database_dir.glob('migrations/*/receipt.json'))
            self.assertEqual(json.loads(receipt.read_text())['status'], 'failed')


if __name__ == '__main__':
    if not CONTAINER.startswith('fujipp-db-ci-'):
        raise RuntimeError('Only an explicitly disposable CI container is allowed')
    unittest.main(verbosity=2)
