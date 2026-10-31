import importlib.util
import json
import os
from pathlib import Path
import unittest
import subprocess
import textwrap
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ci_plan', Path(__file__).with_name('ci-plan.py'))
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)


class SelectionTests(unittest.TestCase):
    def test_runner_feature_does_not_build_backend(self):
        result = plan.selection(['bot-runner/src/features/ticket/v1.0.0.ts'])
        self.assertFalse(result['backend'])
        self.assertTrue(result['runner'])
        self.assertEqual(result['services'], 'bot-runner')
        self.assertEqual(len(result['matrix']['include']), 1)

    def test_backend_implementation_checks_clients_without_redeploying_runner(self):
        result = plan.selection(['backend/src/main/java/com/fujipp/backend/voucher/TrueMoneyVoucherAdapter.java'])
        self.assertEqual(result['services'], 'backend')
        self.assertTrue(result['runner'])
        self.assertFalse(result['deploy_runner'])
        self.assertEqual([item['name'] for item in result['matrix']['include']], ['backend'])

    def test_shared_contracts_select_both(self):
        for path in ['bot-runner/src/types.ts', 'bot-runner/src/api-client.ts',
                     'backend/src/main/java/com/fujipp/backend/wallet/WalletResponses.java',
                     'backend/src/main/java/com/fujipp/backend/runtime/RuntimeRepository.java',
                     'deploy/compose.production.yml', 'deploy/deploy-backend.sh',
                     '.github/workflows/backend-cd.yml', 'supabase/migrations/example.sql']:
            with self.subTest(path=path):
                result = plan.selection([path])
                self.assertTrue(result['backend'] and result['runner'])
                self.assertEqual(result['services'], 'both')

    def test_tests_validate_without_publishing(self):
        for path, key in [('backend/src/test/java/ExampleTests.java', 'backend'),
                          ('bot-runner/test/example.test.ts', 'runner')]:
            result = plan.selection([path])
            self.assertTrue(result[key])
            self.assertEqual(result['services'], 'none')
            self.assertEqual(result['matrix']['include'], [])
        self.assertEqual(plan.selection(['deploy/test_ci_plan.py'])['services'], 'none')

    def test_docs_and_unrelated_frontend_changes_do_not_deploy(self):
        result = plan.selection(['backend/README.md', 'frontend/src/App.vue', 'docs/bot-runtime.md'])
        self.assertFalse(result['backend'] or result['runner'])
        self.assertEqual(result['services'], 'none')

    def test_missing_baseline_manual_and_unknown_service_paths_expand_safely(self):
        self.assertEqual(plan.selection([], force=True)['services'], 'both')
        self.assertEqual(plan.selection(['bot-runner/new-build-config.json'])['services'], 'bot-runner')
        self.assertIsNone(plan.changed_files('', 'a' * 40))
        self.assertIsNone(plan.changed_files('bad-ref', 'a' * 40))

    def test_cumulative_diff_includes_changes_from_a_failed_previous_push(self):
        result = plan.selection(['backend/src/main/java/example/Service.java', 'bot-runner/src/features/ticket/config.ts'])
        self.assertEqual(result['services'], 'both')

    def test_baseline_ignores_successful_test_only_runs(self):
        responses = [
            {'workflow_runs': [{'id': 10, 'head_sha': 'a' * 40}, {'id': 9, 'head_sha': 'b' * 40}]},
            {'jobs': [{'name': 'deploy', 'conclusion': 'skipped'}]},
            {'jobs': [{'name': 'deploy', 'conclusion': 'success'}]},
        ]
        from io import BytesIO
        with patch.object(plan.urllib.request, 'urlopen', side_effect=[BytesIO(json.dumps(r).encode()) for r in responses]):
            self.assertEqual(plan.deployed_base('fixture', 'fixture/project'), 'b' * 40)

    def test_baseline_api_failure_falls_back_to_full_coverage(self):
        with patch.object(plan.urllib.request, 'urlopen', side_effect=OSError('offline')):
            self.assertIsNone(plan.deployed_base('fixture', 'fixture/project'))

    def test_real_workflow_gate_rejects_failed_or_missing_checks(self):
        workflow = (plan.ROOT / '.github/workflows/backend-cd.yml').read_text()
        block = workflow.split('name: Require all selected checks to succeed', 1)[1].split('\n  publish:', 1)[0]
        script = textwrap.dedent(block.split('        run: |\n', 1)[1])
        env = {**os.environ, 'PLAN': 'success', 'DELIVERY': 'success',
               'BACKEND_SELECTED': 'false', 'RUNNER_SELECTED': 'true',
               'BACKEND': 'skipped', 'RUNNER': 'success'}
        def status(overrides):
            return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], env={**env, **overrides}).returncode
        self.assertEqual(status({}), 0)
        self.assertEqual(status({'RUNNER_SELECTED': 'false', 'RUNNER': 'skipped'}), 0)
        for overrides in [{'PLAN': 'failure'}, {'DELIVERY': 'failure'},
                          {'RUNNER': 'failure'}, {'BACKEND': 'success'},
                          {'RUNNER_SELECTED': ''}, {'BACKEND_SELECTED': 'true'}]:
            with self.subTest(overrides=overrides):
                self.assertNotEqual(status(overrides), 0)


if __name__ == '__main__':
    unittest.main()
