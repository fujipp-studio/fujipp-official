import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parent
OLD_BACKEND = 'ghcr.io/fixture/backend:' + 'a' * 40
OLD_RUNNER = 'ghcr.io/fixture/runner:' + 'b' * 40
NEW = 'c' * 40


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='fujipp-delivery-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for command in ('docker', 'curl'):
            destination = self.bin / command
            shutil.copyfile(ROOT / 'test-fixtures' / (command + '.py'), destination)
            destination.chmod(0o700)
        (self.bin / 'sleep').write_text('#!/bin/sh\nexit 0\n')
        (self.bin / 'sleep').chmod(0o700)
        self.compose = self.root / 'compose.production.yml'
        self.compose.write_text('name: fixture\nservices: {}\n')
        self.candidate = self.root / 'compose.production.candidate.yml'
        shutil.copyfile(self.compose, self.candidate)
        self.release = self.root / 'release.env'
        self.old_release = f'BACKEND_IMAGE={OLD_BACKEND}\nBOT_RUNNER_IMAGE={OLD_RUNNER}\nBACKEND_PORT=3601\n'
        self.release.write_text(self.old_release)
        runtime = self.root / 'runtime.env'
        runtime.write_text(''.join(key + '=fixture\n' for key in [
            'SUPABASE_URL', 'DB_URL', 'DB_USERNAME', 'DB_PASSWORD', 'STORE_SECRET_KEY_BASE64',
            'RUNNER_API_TOKEN', 'APP_CORS_ALLOWED_ORIGINS', 'PROMPTPAY_ID',
            'PROMPTPAY_ACCOUNT_NAME', 'SLIPOK_BRANCH_ID', 'SLIPOK_API_KEY']))
        (self.root / '.docker').mkdir()
        (self.root / '.docker/config.json').write_text('{}')
        self.state_file = self.root / 'state.json'
        self.log = self.root / 'commands.jsonl'
        self.state = {'containers': {
            'backend': {'image': OLD_BACKEND, 'status': 'running', 'health': 'healthy'},
            'bot-runner': {'image': OLD_RUNNER, 'status': 'running', 'health': 'none'},
        }}
        self.env = {**os.environ, 'PATH': str(self.bin) + ':' + os.environ['PATH'],
                    'FUJIPP_DEPLOY_APP_DIR': str(self.root), 'FUJIPP_DEPLOY_RUNTIME_ENV': str(runtime),
                    'DEPLOY_TEST_STATE': str(self.state_file), 'DEPLOY_TEST_LOG': str(self.log)}

    def run_deploy(self, service='both', port='3601'):
        self.state_file.write_text(json.dumps(self.state))
        return subprocess.run(['bash', str(ROOT / 'deploy-backend.sh'), NEW,
                               'ghcr.io/fixture/backend', 'ghcr.io/fixture/runner', port,
                               'http://fixture.invalid/health', service], env=self.env,
                              capture_output=True, text=True, timeout=20)

    def commands(self, command):
        if not self.log.exists():
            return []
        return [row for row in map(json.loads, self.log.read_text().splitlines()) if row['command'] == command]

    def test_runner_only_preserves_backend_identity_and_container(self):
        result = self.run_deploy('bot-runner')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([row['services'] for row in self.commands('up')], [['bot-runner']])
        self.assertIn('BACKEND_IMAGE=' + OLD_BACKEND, self.release.read_text())
        self.assertIn('BOT_RUNNER_IMAGE=ghcr.io/fixture/runner:' + NEW, self.release.read_text())

    def test_backend_only_never_restarts_runner(self):
        result = self.run_deploy('backend')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([row['services'] for row in self.commands('up')], [['backend']])
        self.assertIn('BOT_RUNNER_IMAGE=' + OLD_RUNNER, self.release.read_text())

    def test_paired_deployment_starts_backend_first(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([row['services'] for row in self.commands('up')], [['backend'], ['bot-runner']])

    def test_pull_failure_does_not_mutate_live_release_or_containers(self):
        self.state['fail'] = {'command': 'pull', 'service': 'backend'}
        result = self.run_deploy('backend')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.release.read_text(), self.old_release)
        self.assertEqual(self.commands('up'), [])
        self.assertEqual(self.commands('stop'), [])

    def test_runner_failure_rolls_back_only_runner(self):
        self.state['fail'] = {'command': 'up', 'service': 'bot-runner'}
        result = self.run_deploy('bot-runner')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.release.read_text(), self.old_release)
        self.assertEqual([row['services'] for row in self.commands('up')], [['bot-runner'], ['bot-runner']])
        self.assertIn('--pull', self.commands('up')[-1]['args'])
        self.assertEqual(json.loads(self.state_file.read_text())['containers']['bot-runner']['image'], OLD_RUNNER)

    def test_backend_health_failure_does_not_start_new_runner(self):
        self.state['fail_health'] = True
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual([row['services'] for row in self.commands('up')], [['backend'], ['backend']])
        self.assertEqual(self.release.read_text(), self.old_release)

    def test_failed_pair_restores_compose_and_both_images(self):
        original = self.compose.read_text()
        self.candidate.write_text('name: changed\nservices: {}\n')
        self.state['fail'] = {'command': 'up', 'service': 'bot-runner'}
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.compose.read_text(), original)
        self.assertEqual(self.release.read_text(), self.old_release)
        containers = json.loads(self.state_file.read_text())['containers']
        self.assertEqual(containers['backend']['image'], OLD_BACKEND)
        self.assertEqual(containers['bot-runner']['image'], OLD_RUNNER)

    def test_partial_deployment_rejects_changed_compose_or_port(self):
        self.candidate.write_text('changed config\n')
        self.assertNotEqual(self.run_deploy('bot-runner').returncode, 0)
        shutil.copyfile(self.compose, self.candidate)
        self.assertNotEqual(self.run_deploy('bot-runner', '3602').returncode, 0)
        self.assertEqual(self.commands('up'), [])

    def test_partial_deployment_requires_release_and_running_peer(self):
        self.state['containers']['backend']['status'] = 'stopped'
        self.assertNotEqual(self.run_deploy('bot-runner').returncode, 0)
        self.release.unlink()
        self.assertNotEqual(self.run_deploy('bot-runner').returncode, 0)
        self.assertEqual(self.commands('up'), [])

    def test_first_deployment_failure_removes_only_created_services(self):
        self.release.unlink()
        self.state = {'containers': {}, 'fail': {'command': 'up', 'service': 'bot-runner'}}
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.release.exists())
        self.assertEqual(json.loads(self.state_file.read_text())['containers'], {})

    def test_missing_release_never_adopts_existing_untracked_containers(self):
        self.release.unlink()
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands('up'), [])

    def test_mutable_or_injected_previous_reference_is_rejected(self):
        self.release.write_text(self.old_release.replace('a' * 40, 'main'))
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.commands('pull'), [])

    def test_workflow_ssh_step_preserves_remote_arguments(self):
        workflow = (ROOT.parent / '.github/workflows/backend-cd.yml').read_text()
        block = workflow.split('name: Deploy selected services with scoped rollback', 1)[1].split('\n      - name:', 1)[0]
        script = textwrap.dedent(block.split('        run: |\n', 1)[1])
        app = self.root / 'path with spaces'
        incoming = app / '.incoming'
        incoming.mkdir(parents=True)
        (incoming / 'compose.production.yml').write_text('candidate')
        captured = self.root / 'remote-args.json'
        (incoming / 'deploy-backend.sh').write_text(
            '#!/usr/bin/env python3\nimport json,os,sys\n'
            "open(os.environ['CAPTURED_ARGS'],'w').write(json.dumps(sys.argv[1:]))\n")
        ssh = self.bin / 'ssh'
        ssh.write_text('#!/usr/bin/env python3\nimport subprocess,sys\n'
                       "sys.exit(subprocess.run(['bash','-c',sys.argv[2]]).returncode)\n")
        ssh.chmod(0o700)
        health_url = 'https://fixture.invalid/health?a=1&b=$literal'
        env = {**self.env, 'DEPLOY_PATH': str(app), 'DEPLOY_USER': 'fixture',
               'DEPLOY_HOST': 'fixture.invalid', 'GITHUB_SHA': NEW,
               'BACKEND_IMAGE': 'ghcr.io/fixture/backend', 'BOT_RUNNER_IMAGE': 'ghcr.io/fixture/runner',
               'BACKEND_PORT': '3601', 'HEALTHCHECK_URL': health_url,
               'SERVICES': 'bot-runner', 'CAPTURED_ARGS': str(captured)}
        result = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], env=env,
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(captured.read_text()), [NEW, 'ghcr.io/fixture/backend',
                         'ghcr.io/fixture/runner', '3601', health_url, 'bot-runner'])
        self.assertEqual((app / 'compose.production.candidate.yml').read_text(), 'candidate')


if __name__ == '__main__':
    unittest.main()
