import copy
import io
import json
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import unittest
import urllib.error

from discord_ci import (ApiError, Discord, GitHub, NotifyError, Transport, WORKFLOWS,
                       card_key, collect, render, synchronize)

REPO = 'fixture/project'
SHA = 'a' * 40
HOOK_ID, CHANNEL, GUILD, MESSAGE = [str(10**17 + n) for n in range(1, 5)]
HOOK = 'https://discord.com/api/webhooks/' + HOOK_ID + '/' + 'fixture-token'
NOTIFIER = 'https://github.com/' + REPO + '/actions/runs/999'


def run(path='.github/workflows/frontend-cd.yml', id=10, event='push', status='completed', conclusion='success'):
    return {'id': id, 'path': path, 'head_sha': SHA, 'head_branch': 'main' if event != 'pull_request' else 'feature/test',
            'event': event, 'run_attempt': 1, 'status': status, 'conclusion': conclusion,
            'repository': {'full_name': REPO}, 'head_repository': {'full_name': REPO},
            'actor': {'login': 'fixture'}, 'display_title': 'Improve CI delivery',
            'created_at': '2026-11-01T00:00:00Z', 'run_started_at': '2026-11-01T00:00:00Z',
            'pull_requests': []}


def job(name='deploy', id=20, conclusion='success', status='completed'):
    return {'name': name, 'id': id, 'status': status, 'conclusion': conclusion,
            'completed_at': '2026-11-01T00:03:37Z' if status == 'completed' else None, 'steps': []}


def snapshot(*runs, jobs=None):
    anchor = runs[0] if runs else run()
    return {'repository': REPO, 'key': card_key(anchor, REPO), 'anchor': anchor,
            'runs': {item['path']: item for item in (runs or [anchor])},
            'jobs': jobs or {str(anchor['id']): [job()]}}


def field_value(payload, name):
    return next(field['value'] for field in payload['embeds'][0]['fields'] if field['name'] == name)


class FakeGitHub:
    repository = REPO

    def __init__(self):
        self.current, self.records, self.fail_record = None, [], 0

    def status(self, sha, context):
        return copy.deepcopy(self.current)

    def record(self, sha, context, state, description, url):
        if self.fail_record == len(self.records) + 1:
            raise ApiError('GitHub', 503)
        self.current = {'context': context, 'state': state, 'description': description, 'target_url': url}
        self.records.append(copy.deepcopy(self.current))


class FakeDiscordTransport:
    def __init__(self):
        self.calls, self.messages, self.post_error = [], {}, None

    def request(self, service, method, url, body=None, headers=None):
        self.calls.append((method, url, copy.deepcopy(body)))
        if method == 'GET' and '/messages/' not in url:
            return {'id': HOOK_ID, 'channel_id': CHANNEL, 'guild_id': GUILD}
        if method == 'POST':
            if self.post_error:
                raise self.post_error
            self.messages[MESSAGE] = {**copy.deepcopy(body), 'id': MESSAGE, 'webhook_id': HOOK_ID}
            return copy.deepcopy(self.messages[MESSAGE])
        message_id = url.rsplit('/', 1)[-1]
        if message_id not in self.messages:
            raise ApiError('Discord', 404)
        if method == 'PATCH':
            self.messages[message_id].update(copy.deepcopy(body))
        return copy.deepcopy(self.messages[message_id])

    def count(self, method):
        return sum(call[0] == method for call in self.calls)


class SummaryTests(unittest.TestCase):
    def test_create_update_and_repeat_keep_one_message(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        discord = Discord(HOOK, transport)
        first = snapshot(run(status='in_progress', conclusion=None))
        self.assertEqual(synchronize(github, discord, first, NOTIFIER), 'created')
        final = snapshot(run())
        self.assertEqual(synchronize(github, discord, final, NOTIFIER), 'updated')
        self.assertEqual(synchronize(github, discord, final, NOTIFIER), 'unchanged')
        self.assertEqual(transport.count('POST'), 1)
        self.assertEqual(transport.count('PATCH'), 1)
        self.assertEqual(github.records[0]['state'], 'pending')
        self.assertTrue(github.current['target_url'].endswith('/' + MESSAGE))

    def test_lost_post_response_never_automatically_posts_again(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        transport.post_error = ApiError('Discord')
        discord = Discord(HOOK, transport)
        with self.assertRaises(ApiError): synchronize(github, discord, snapshot(), NOTIFIER)
        transport.post_error = None
        with self.assertRaisesRegex(NotifyError, 'uncertain'):
            synchronize(github, discord, snapshot(), NOTIFIER)
        self.assertEqual(transport.count('POST'), 1)

    def test_pointer_write_failure_can_be_recovered_without_second_post(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        github.fail_record = 2
        discord = Discord(HOOK, transport)
        with self.assertRaisesRegex(NotifyError, MESSAGE): synchronize(github, discord, snapshot(), NOTIFIER)
        github.fail_record = 0
        self.assertEqual(synchronize(github, discord, snapshot(), NOTIFIER, recover_id=MESSAGE), 'updated')
        self.assertEqual(transport.count('POST'), 1)

    def test_explicit_recreate_is_needed_for_deleted_messages(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        discord = Discord(HOOK, transport)
        synchronize(github, discord, snapshot(), NOTIFIER)
        transport.messages.clear()
        with self.assertRaises(ApiError): synchronize(github, discord, snapshot(), NOTIFIER)
        self.assertEqual(transport.count('POST'), 1)
        self.assertEqual(synchronize(github, discord, snapshot(), NOTIFIER, allow_new=True), 'created')

    def test_another_revision_card_cannot_be_edited(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        discord = Discord(HOOK, transport)
        synchronize(github, discord, snapshot(), NOTIFIER)
        transport.messages[MESSAGE]['embeds'][0]['footer']['text'] = 'another card'
        with self.assertRaisesRegex(NotifyError, 'not owned'):
            synchronize(github, discord, snapshot(), NOTIFIER)
        self.assertEqual(transport.count('PATCH'), 0)

    def test_external_edits_are_repaired_even_if_status_hash_is_unchanged(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        discord = Discord(HOOK, transport)
        synchronize(github, discord, snapshot(), NOTIFIER)
        transport.messages[MESSAGE]['embeds'][0]['title'] = 'edited'
        self.assertEqual(synchronize(github, discord, snapshot(), NOTIFIER), 'updated')

    def test_definite_rejection_is_safe_to_retry_after_fix(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        transport.post_error = ApiError('Discord', 401)
        discord = Discord(HOOK, transport)
        with self.assertRaises(ApiError): synchronize(github, discord, snapshot(), NOTIFIER)
        self.assertTrue(github.current['description'].startswith('not_sent'))
        transport.post_error = None
        self.assertEqual(synchronize(github, discord, snapshot(), NOTIFIER), 'created')

    def test_run_groups_separate_pr_push_manual_schedule_and_revisions(self):
        push, pr = run(), run(event='pull_request')
        self.assertNotEqual(card_key(push, REPO), card_key(pr, REPO))
        other = {**push, 'head_sha': 'b' * 40}
        self.assertNotEqual(card_key(push, REPO), card_key(other, REPO))
        same = {**push, 'path': '.github/workflows/security.yml', 'id': 90}
        self.assertEqual(card_key(push, REPO), card_key(same, REPO))
        for event in ('schedule', 'workflow_dispatch'):
            self.assertNotEqual(card_key(run(event=event, id=10), REPO), card_key(run(event=event, id=11), REPO))

    def test_unmonitored_and_foreign_runs_are_rejected(self):
        for item in [run(path='.github/workflows/evil.yml'), {**run(), 'repository': {'full_name': 'other/repo'}},
                     {**run(), 'head_branch': 'not-main'}, {**run(), 'head_sha': 'bad'}]:
            with self.subTest(item=item), self.assertRaises(NotifyError): card_key(item, REPO)

    def test_render_distinguishes_deployment_checks_missing_and_cancellation(self):
        for state, conclusion, expected in [('completed', 'cancelled', 'Cancelled'), ('in_progress', None, 'In progress'),
                                             ('completed', 'skipped', 'Skipped')]:
            result = render(snapshot(run(status=state, conclusion=conclusion)))
            self.assertIn(expected, field_value(result, 'Frontend'))
        result = render(snapshot(run(event='pull_request'), jobs={'10': [job(conclusion='skipped')]}))
        self.assertIn('deployment skipped', field_value(result, 'Frontend'))
        self.assertIn('No run observed', field_value(result, 'Backend / Runner'))
        result = render(snapshot(run()))
        self.assertIn('Deployment succeeded', field_value(result, 'Frontend'))
        self.assertIn('3m 37s', field_value(result, 'Frontend'))

    def test_failure_lists_stage_links_without_claiming_rollback_success(self):
        failed = job(conclusion='failure')
        failed['steps'] = [{'name': 'Deploy selected services', 'conclusion': 'failure'}]
        result = render(snapshot(run(conclusion='failure'), jobs={'10': [failed]}))
        self.assertEqual(field_value(result, 'Status'), 'FAILED')
        output = json.dumps(result, ensure_ascii=False)
        self.assertIn('Deploy selected services', output)
        self.assertIn('Rollback outcome not verified', output)
        self.assertNotIn('Rollback succeeded', output)

    def test_pr_job_names_cannot_claim_a_production_deployment(self):
        source = run(event='pull_request')
        result = render(snapshot(source, jobs={'10': [job('deploy'), job('database / deploy')]}))
        output = json.dumps(result, ensure_ascii=False)
        self.assertNotIn('Deployment succeeded', output)
        self.assertNotIn('Verification passed', field_value(result, 'Database'))
        self.assertIn('Production deployment skipped', output)

    def test_database_reusable_jobs_are_aggregated_once(self):
        backend = run(path='.github/workflows/backend-cd.yml', id=11)
        result = render(snapshot(run(), backend, jobs={'10': [job()], '11': [job('database / checks'), job('database / deploy')]}))
        database = [field for field in result['embeds'][0]['fields'] if field['name'] == 'Database']
        self.assertEqual(len(database), 1)
        self.assertIn('Verification passed', database[0]['value'])
        self.assertNotIn('No pending migrations', json.dumps(result, ensure_ascii=False))

    def test_security_failure_does_not_suggest_a_deployment_rollback(self):
        source = run(path='.github/workflows/security.yml', conclusion='failure')
        result = render(snapshot(source, jobs={'10': [job('CodeQL', conclusion='failure')]}))
        self.assertNotIn('Recovery', [field['name'] for field in result['embeds'][0]['fields']])

    def test_standalone_database_check_only_does_not_claim_apply(self):
        source = run(path='.github/workflows/database-cd.yml', event='workflow_dispatch')
        result = render(snapshot(source, jobs={'10': [job('checks'), job('deploy', conclusion='skipped')]}))
        database = next(field for field in result['embeds'][0]['fields'] if field['name'] == 'Database')
        self.assertIn('Deployment skipped', database['value'])

    def test_report_uses_english_labels_standard_metadata_and_one_status_icon(self):
        result = render(snapshot(run()))
        embed = result['embeds'][0]
        self.assertEqual(embed['title'], '✅ FUJIPP STUDIO • CI/CD REPORT')
        self.assertEqual([field['name'] for field in embed['fields'][:4]], ['Status', 'Branch', 'Commit', 'Triggered by'])
        self.assertEqual(field_value(result, 'Status'), 'SUCCEEDED')
        self.assertEqual(field_value(result, 'Branch'), 'main')
        self.assertEqual(field_value(result, 'Triggered by'), 'fixture')
        self.assertIn('View Workflow', field_value(result, 'Links'))
        output = json.dumps(result, ensure_ascii=False)
        self.assertFalse(any('\u0e00' <= char <= '\u0e7f' for char in output))
        self.assertEqual(sum(output.count(icon) for icon in ['✅', '❌', '⏳', '⏹️', '❔']), 1)

    def test_existing_card_with_legacy_marker_is_upgraded_without_another_post(self):
        github, transport = FakeGitHub(), FakeDiscordTransport()
        discord = Discord(HOOK, transport)
        current = snapshot()
        synchronize(github, discord, current, NOTIFIER)
        transport.messages[MESSAGE]['embeds'][0]['footer']['text'] = 'FUJIPP CI • ' + current['key']
        self.assertEqual(synchronize(github, discord, current, NOTIFIER), 'updated')
        self.assertEqual(transport.count('POST'), 1)
        self.assertEqual(transport.count('PATCH'), 1)
        self.assertTrue(transport.messages[MESSAGE]['embeds'][0]['footer']['text'].startswith('FUJIPP STUDIO • Ref '))

    def test_preview_cli_runs_without_tokens_or_network(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            path.write_text(json.dumps(snapshot()))
            env = {key: value for key, value in os.environ.items() if key not in {'GH_TOKEN', 'DISCORD_CI_WEBHOOK'}}
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('discord_ci.py')), 'preview',
                                     '--snapshot', str(path)], env=env, text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout)['allowed_mentions'], {'parse': []})

    def test_running_failure_is_red_and_untrusted_titles_cannot_ping(self):
        source = run(status='in_progress', conclusion=None)
        source['display_title'] = '@everyone [fake](https://example.invalid) ' + 'x' * 4000
        result = render(snapshot(source, jobs={'10': [job(conclusion='failure')]}))
        self.assertEqual(result['allowed_mentions'], {'parse': []})
        self.assertNotIn('@everyone', result['embeds'][0]['description'])
        self.assertEqual(result['embeds'][0]['color'], 0xED4245)
        embed = result['embeds'][0]
        length = len(embed['title']) + len(embed['description']) + len(embed['footer']['text'])
        length += sum(len(field['name']) + len(field['value']) for field in embed['fields'])
        self.assertLess(length, 6000)
        self.assertTrue(all(len(field['value']) <= 1024 for field in embed['fields']))

    def test_only_native_discord_endpoints_are_accepted(self):
        for url in [HOOK + '/github', HOOK + '?x=y', HOOK.replace('discord.com', 'evil.invalid'),
                    HOOK.replace('https:', 'http:'), HOOK.replace('discord.com', 'discord.com@evil.invalid')]:
            with self.subTest(url=url), self.assertRaises(NotifyError): Discord(url)


class CollectorTests(unittest.TestCase):
    def test_latest_workflow_and_attempt_are_refetched_and_no_logs_are_read(self):
        anchor = run(status='in_progress', conclusion=None)
        newer = run(id=11)
        current = {**newer, 'run_attempt': 2}
        calls = []
        class API(FakeGitHub):
            def pages(self, path, key):
                calls.append(path)
                return [anchor, newer] if key == 'workflow_runs' else [job()]
            def request(self, method, path):
                calls.append(path)
                return current
        result = collect(API(), anchor)
        self.assertEqual(result['runs'][anchor['path']]['run_attempt'], 2)
        self.assertIn('/actions/runs/11/jobs?filter=latest', calls)
        self.assertFalse(any('/logs' in path or '/artifacts' in path for path in calls))


class Response:
    def __init__(self, data): self.data = json.dumps(data).encode()
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return self.data[:limit]


class Opener:
    def __init__(self, *responses): self.responses, self.calls = list(responses), []
    def open(self, request, timeout):
        self.calls.append(request)
        value = self.responses.pop(0)
        if isinstance(value, Exception): raise value
        return Response(value)


class TransportTests(unittest.TestCase):
    def error(self, status, payload=None):
        return urllib.error.HTTPError(HOOK, status, 'error with private URL', {}, io.BytesIO(json.dumps(payload or {}).encode()))

    def test_rate_limit_respects_retry_after(self):
        opener = Opener(self.error(429, {'retry_after': 0.25}), {'id': MESSAGE})
        sleeps = []
        result = Transport(opener, sleeps.append).request('Discord', 'POST', HOOK, {})
        self.assertEqual(result['id'], MESSAGE)
        self.assertEqual(sleeps, [0.35])

    def test_post_is_not_retried_after_uncertain_server_or_network_failure(self):
        for error in [self.error(500), urllib.error.URLError(HOOK)]:
            opener = Opener(error, {'id': MESSAGE})
            with self.subTest(error=type(error)), self.assertRaises(ApiError) as raised:
                Transport(opener, lambda delay: None).request('Discord', 'POST', HOOK, {})
            self.assertEqual(len(opener.calls), 1)
            self.assertNotIn('fixture-token', str(raised.exception))

    def test_patch_can_be_retried(self):
        opener = Opener(self.error(502), {'id': MESSAGE})
        self.assertEqual(Transport(opener, lambda delay: None).request('Discord', 'PATCH', HOOK, {})['id'], MESSAGE)
        self.assertEqual(len(opener.calls), 2)

    def test_status_pagination_finds_pointer_beyond_first_page(self):
        first = [{'context': 'other'}] * 100
        opener = Opener(first, [{'context': 'wanted', 'target_url': 'pointer'}])
        github = GitHub(REPO, 'fixture-auth', Transport(opener))
        self.assertEqual(github.status(SHA, 'wanted')['target_url'], 'pointer')

    def test_incomplete_pagination_fails_instead_of_creating_another_card(self):
        opener = Opener(*[[{'context': 'other'}] * 100 for _ in range(20)])
        github = GitHub(REPO, 'fixture-auth', Transport(opener))
        with self.assertRaisesRegex(NotifyError, 'incomplete'):
            github.status(SHA, 'wanted')


class WorkflowTests(unittest.TestCase):
    def test_privileged_jobs_use_default_branch_without_artifacts_or_pr_checkout(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / '.github/workflows/discord-ci.yml').read_text()
        notify = workflow.split('  resolve:', 1)[1]
        self.assertEqual(notify.count('ref: ${{ github.sha }}'), 2)
        self.assertNotIn('download-artifact', notify)
        self.assertNotIn('ref: ${{ github.event.workflow_run.head_sha }}', notify)
        self.assertIn('group: discord-card-${{ needs.resolve.outputs.key }}', notify)
        self.assertIn('cancel-in-progress: false', notify)
        self.assertIn('statuses: write', notify)
        self.assertEqual(workflow.count('DISCORD_CI_WEBHOOK: ${{ secrets.DISCORD_CI_WEBHOOK }}'), 1)


if __name__ == '__main__':
    unittest.main()
