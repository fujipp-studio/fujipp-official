import importlib.util
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


features = load('ci-feature-tests')
runner = load('ci-run-tests')


class FeatureTests(unittest.TestCase):
    def plan(self, *paths, force=False):
        return features.select_tests(list(paths), {service: any(path.startswith(service + '/') for path in paths)
                                                  for service in features.SERVICES}, force)

    def test_ticket_uses_feature_and_registry_checks_without_backend(self):
        plan = self.plan('bot-runner/src/features/ticket/mentions.ts')
        self.assertEqual(plan['tests']['backend'], [])
        self.assertIn('bot-runner/test/ticket-mentions.test.ts', plan['tests']['bot-runner'])
        self.assertIn('bot-runner/test/feature-registry.test.ts', plan['tests']['bot-runner'])
        self.assertNotIn('bot-runner/test/wallet-presentation.test.ts', plan['tests']['bot-runner'])
        self.assertIn('bot-runner/src/feature-registry.ts', plan['boundaries'])

    def test_backend_donation_stays_scoped_without_runner_checks(self):
        plan = self.plan('backend/src/main/java/com/fujipp/backend/donation/DonationService.java')
        self.assertEqual(plan['tests']['bot-runner'], [])
        self.assertEqual(plan['features']['backend'], ['donation'])
        self.assertEqual(plan['tests']['backend'], [
            'backend/src/test/java/com/fujipp/backend/BackendApplicationTests.java',
            'backend/src/test/java/com/fujipp/backend/donation/DonationControllerTests.java',
            'backend/src/test/java/com/fujipp/backend/donation/DonationServiceTests.java',
        ])

    def test_server_voucher_logic_checks_wallet_and_payment_clients(self):
        plan = self.plan('backend/src/main/java/com/fujipp/backend/voucher/TrueMoneyVoucherAdapter.java')
        # Robux depends on wallet behavior but has no dedicated Backend suite.
        # Missing coverage in a dependent feature also requires the full suite.
        self.assertEqual(plan['tests']['backend'], ['*'])
        self.assertIn('No dedicated backend coverage: roblox-payout', plan['testReasons'])
        self.assertIn('bot-runner/test/payment-voucher-api.test.ts', plan['tests']['bot-runner'])
        self.assertIn('bot-runner/test/role-shop.test.ts', plan['tests']['bot-runner'])
        self.assertNotIn('bot-runner/test/ticket.test.ts', plan['tests']['bot-runner'])

    def test_reverse_references_include_website_qr_and_wallet_consumers(self):
        plan = self.plan('backend/src/main/java/com/fujipp/backend/topup/PromptPayQrGenerator.java')
        self.assertIn('wallet', plan['features']['backend'])
        self.assertIn('website-topup', plan['features']['backend'])
        self.assertEqual(plan['tests']['backend'], ['*'])

    def test_shared_manual_deleted_and_unmapped_sources_use_full_checks(self):
        for path in ['bot-runner/src/features/presentation.ts', 'bot-runner/src/process-bot-manager.ts',
                     'bot-runner/src/features/ticket/deleted.ts', 'bot-runner/new-build-file.json']:
            with self.subTest(path=path):
                self.assertEqual(self.plan(path)['tests']['bot-runner'], ['*'])
        plan = features.select_tests([], {'backend': True, 'bot-runner': True}, force=True)
        self.assertEqual(plan['tests'], {'backend': ['*'], 'bot-runner': ['*']})

    def test_test_only_edit_selects_changed_test_and_baseline(self):
        plan = self.plan('bot-runner/test/ticket-mentions.test.ts')
        self.assertIn('bot-runner/test/ticket-mentions.test.ts', plan['tests']['bot-runner'])
        self.assertNotIn('bot-runner/test/ticket-history.test.ts', plan['tests']['bot-runner'])

    def test_shared_store_dispatch_is_not_an_unproven_isolation_boundary(self):
        plan = self.plan('backend/src/main/java/com/fujipp/backend/store/TicketConfigurationValidator.java')
        self.assertEqual(plan['tests']['backend'], ['*'])
        self.assertEqual(plan['tests']['bot-runner'], ['*'])

    def test_uncovered_feature_defaults_to_full_suite(self):
        plan = self.plan('bot-runner/src/features/bot-presence/v1.0.0.ts')
        self.assertEqual(plan['tests']['bot-runner'], ['*'])

    def test_java_selector_is_fully_qualified_and_does_not_disable_missing_tests(self):
        args = runner.command('backend', ['backend/src/test/java/com/fujipp/backend/voucher/VoucherServiceTests.java'])
        self.assertIn('-Dtest=com.fujipp.backend.voucher.VoucherServiceTests', args)
        self.assertIn('verify', args)
        self.assertNotIn('-DskipTests', args)
        self.assertNotIn('-Dtest', runner.command('backend', ['*']))

    def test_runner_selector_uses_explicit_files_and_rejects_paths_outside_tests(self):
        args = runner.command('bot-runner', ['bot-runner/test/ticket.test.ts'])
        self.assertEqual(args[-1], 'test/ticket.test.ts')
        for service, tests in [('bot-runner', []), ('backend', ['backend/pom.xml']),
                               ('bot-runner', ['bot-runner/src/main.ts'])]:
            with self.subTest(service=service, tests=tests), self.assertRaises(ValueError):
                runner.command(service, tests)

    def test_all_mapped_patterns_and_guides_exist(self):
        config = features.load_map()
        self.assertIn('ticket', config['features'])
        self.assertIn('/internal/v1/vouchers/**', config['features']['truemoney']['routes'])
        for path in (features.ROOT / 'backend/src/main/java').rglob('*Controller.java'):
            scope = features.owner(path.relative_to(features.ROOT).as_posix(), config)
            if scope == 'platform-core':
                continue
            for route in re.findall(r'@RequestMapping\("([^\"]+)"\)', path.read_text()):
                self.assertIn(route.rstrip('/') + '/**', config['features'][scope]['routes'], path.name)


if __name__ == '__main__':
    unittest.main()
