#!/usr/bin/env python3
"""One Discord card per source revision, using only trusted code and API metadata."""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

WORKFLOWS = {
    '.github/workflows/frontend-cd.yml': 'Frontend',
    '.github/workflows/backend-cd.yml': 'Backend / Runner',
    '.github/workflows/database-cd.yml': 'Database',
    '.github/workflows/security.yml': 'Security',
}
BAD = {'failure', 'timed_out', 'startup_failure', 'action_required', 'stale'}
SNOWFLAKE = re.compile(r'[0-9]{15,22}')


class NotifyError(RuntimeError):
    pass


class ApiError(NotifyError):
    def __init__(self, service, status=0):
        # Never include a request URL, response body or original exception:
        # Discord puts the webhook credential in the URL itself.
        self.service, self.status = service, status
        super().__init__(service + (' HTTP ' + str(status) if status else ' connection/response error'))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Transport:
    def __init__(self, opener=None, sleep=time.sleep):
        self.opener = opener or urllib.request.build_opener(NoRedirect())
        self.sleep = sleep

    def request(self, service, method, url, body=None, headers=None):
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        headers = {**(headers or {}), 'User-Agent': 'FUJIPP-CI-Notifier/1.0'}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        for attempt in range(3):
            request = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with self.opener.open(request, timeout=20) as response:
                    raw = response.read(2_000_001)
                    if len(raw) > 2_000_000:
                        raise ApiError(service)
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as error:
                status = error.code
                if status == 429 and attempt < 2:
                    try:
                        delay = float(json.loads(error.read(4096)).get('retry_after', error.headers.get('Retry-After', '1')))
                    except (ValueError, TypeError, AttributeError):
                        delay = 1
                    if not 0 <= delay <= 30:
                        raise ApiError(service, status) from None
                    self.sleep(delay + 0.1)
                    continue
                # GET/PATCH retries are safe. A Discord POST can have succeeded
                # before a timeout/5xx; the durable intent prevents another POST.
                if status >= 500 and (method != 'POST' or service == 'GitHub') and attempt < 2:
                    self.sleep(attempt + 1)
                    continue
                raise ApiError(service, status) from None
            except (urllib.error.URLError, TimeoutError, OSError, ValueError):
                if method in {'GET', 'PATCH'} and attempt < 2:
                    self.sleep(attempt + 1)
                    continue
                raise ApiError(service) from None


class GitHub:
    def __init__(self, repository, token, transport=None):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
            raise NotifyError('Invalid repository')
        self.repository, self.token = repository, token
        self.transport = transport or Transport()
        self.base = 'https://api.github.com/repos/' + repository

    def request(self, method, path, body=None):
        if not path.startswith('/') or '://' in path:
            raise NotifyError('Invalid GitHub API path')
        return self.transport.request('GitHub', method, self.base + path, body, {
            'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        })

    def pages(self, path, key=None):
        result = []
        for page in range(1, 21):
            data = self.request('GET', path + ('&' if '?' in path else '?') + f'per_page=100&page={page}')
            rows = data[key] if key else data
            if not isinstance(rows, list):
                raise NotifyError('Invalid paginated GitHub response')
            if key and data.get('total_count', 0) > 1000:
                raise NotifyError('Too many workflow results to summarize reliably')
            result.extend(rows)
            if len(rows) < 100:
                return result
        raise NotifyError('Incomplete GitHub pagination; refusing to create a duplicate card')

    def status(self, sha, context):
        # GitHub returns most recent first. Stop at the first matching context.
        for page in range(1, 21):
            rows = self.request('GET', f'/commits/{sha}/statuses?per_page=100&page={page}')
            for item in rows:
                if item['context'] == context:
                    return item
            if len(rows) < 100:
                return None
        raise NotifyError('Status history is incomplete; refusing a second message')

    def record(self, sha, context, state, description, url):
        return self.request('POST', '/statuses/' + sha, {
            'context': context, 'state': state, 'description': description[:140], 'target_url': url,
        })


def workflow_path(run):
    return run.get('path', '').split('@', 1)[0]


def validate_run(run, repository):
    if (workflow_path(run) not in WORKFLOWS or run.get('repository', {}).get('full_name', '').lower() != repository.lower()
            or not re.fullmatch(r'[0-9a-f]{40}', run.get('head_sha', ''))
            or run.get('event') not in {'push', 'pull_request', 'workflow_dispatch', 'schedule'}
            or not isinstance(run.get('id'), int) or run['id'] <= 0):
        raise NotifyError('Unsupported workflow source')
    if run['event'] == 'push' and run.get('head_branch') != 'main':
        raise NotifyError('Only main push releases are summarized')


def card_key(run, repository):
    validate_run(run, repository)
    group = [repository.lower(), run['head_sha'], run['event'],
             (run.get('head_repository') or {}).get('full_name', repository).lower(), run.get('head_branch')]
    if run['event'] in {'workflow_dispatch', 'schedule'}:
        group.append(run['id'])  # Do not mix unrelated manual/weekly runs.
    return hashlib.sha256(json.dumps(group, separators=(',', ':')).encode()).hexdigest()


def collect(github, anchor):
    key = card_key(anchor, github.repository)
    query = urllib.parse.urlencode({'head_sha': anchor['head_sha'], 'event': anchor['event']})
    runs = github.pages('/actions/runs?' + query, 'workflow_runs')
    selected = {}
    for item in [*runs, anchor]:
        if workflow_path(item) not in WORKFLOWS:
            continue
        if card_key(item, github.repository) != key:
            continue
        previous = selected.get(workflow_path(item))
        if previous is None or (item['id'], item.get('run_attempt', 1)) > (previous['id'], previous.get('run_attempt', 1)):
            selected[workflow_path(item)] = item
    # Fetch each selected run again: old events must not overwrite a newer rerun.
    fresh, jobs = {}, {}
    for path, item in selected.items():
        run = github.request('GET', '/actions/runs/' + str(item['id']))
        if card_key(run, github.repository) != key:
            raise NotifyError('Run identity changed during collection')
        fresh[path] = run
        jobs[str(run['id'])] = github.pages('/actions/runs/' + str(run['id']) + '/jobs?filter=latest', 'jobs')
    return {'repository': github.repository, 'key': key, 'anchor': anchor,
            'runs': fresh, 'jobs': jobs}


def text(value, limit=180):
    value = ' '.join(str(value or '').split())
    value = ''.join(char for char in value if char.isprintable())
    # Descriptions/job names are untrusted display text, never links or mentions.
    value = value.replace('@', '@\u200b')
    value = re.sub(r'([\\`*_{}\[\]()<>|~])', r'\\\1', value)
    return value[:limit]


def run_url(repository, run):
    return f"https://github.com/{repository}/actions/runs/{int(run['id'])}"


def result_state(run):
    if run.get('status') != 'completed':
        return 'running'
    conclusion = run.get('conclusion')
    if conclusion in BAD:
        return 'failure'
    if conclusion == 'success':
        return 'success'
    if conclusion == 'cancelled':
        return 'cancelled'
    return 'skipped' if conclusion in {'skipped', 'neutral'} else 'unknown'


def elapsed(run, jobs):
    try:
        start = datetime.fromisoformat((run.get('run_started_at') or run['created_at']).replace('Z', '+00:00'))
        end = max([datetime.fromisoformat(job['completed_at'].replace('Z', '+00:00'))
                   for job in jobs if job.get('completed_at')], default=start)
        if run.get('status') != 'completed':
            return ''
        seconds = max(0, int((end - start).total_seconds()))
        return f' · {seconds // 60}m {seconds % 60:02d}s'
    except (KeyError, ValueError, TypeError):
        return ''


def display_result(run, jobs, database=False):
    state = result_state(run)
    if state != 'success':
        label = {'running': 'In progress', 'failure': 'Failed', 'cancelled': 'Cancelled',
                 'skipped': 'Skipped', 'unknown': 'Outcome unconfirmed'}[state]
    else:
        deploys = [job for job in jobs if job['name'] == 'deploy']
        if workflow_path(run) == '.github/workflows/security.yml':
            label = 'Checks passed'
        elif run['event'] == 'pull_request' or run.get('head_branch') != 'main':
            label = 'Checks passed · Production deployment skipped'
        elif any(job.get('conclusion') == 'success' for job in deploys):
            label = 'Verification passed' if database else 'Deployment succeeded'
        elif any(job.get('conclusion') == 'skipped' for job in deploys) or run['event'] == 'pull_request':
            label = 'Checks passed · Deployment skipped'
        else:
            label = 'Checks passed · Deployment unconfirmed'
    return label + elapsed(run, jobs)


def card_marker(key):
    return 'FUJIPP STUDIO • Ref ' + key[:24]


def render(snapshot):
    repository, anchor = snapshot['repository'], snapshot['anchor']
    runs, job_map = snapshot['runs'], snapshot['jobs']
    states = [result_state(run) for run in runs.values()]
    if 'failure' in states or any(job.get('conclusion') in BAD for jobs in job_map.values() for job in jobs):
        status, icon, color = 'FAILED', '❌', 0xED4245
    elif 'running' in states:
        status, icon, color = 'IN PROGRESS', '⏳', 0xFEE75C
    elif 'unknown' in states:
        status, icon, color = 'UNCONFIRMED', '❔', 0xFEE75C
    elif states and all(state == 'success' for state in states):
        status, icon, color = 'SUCCEEDED', '✅', 0x57F287
    else:
        status = 'CANCELLED' if 'cancelled' in states else 'SKIPPED'
        icon, color = '⏹️', 0x95A5A6
    pr = next((pr for run in runs.values() for pr in run.get('pull_requests', []) if isinstance(pr.get('number'), int)), None)
    commit_url = f"https://github.com/{repository}/commit/{anchor['head_sha']}"
    description = f"**{text(repository)}**\n"
    description += text(anchor.get('display_title') or (anchor.get('head_commit') or {}).get('message', '').split('\n')[0], 200)
    description += '\n\nObserved workflow results for this revision.'
    actor = anchor.get('triggering_actor') or anchor.get('actor') or {}
    fields = [
        {'name': 'Status', 'value': status, 'inline': True},
        {'name': 'Branch', 'value': text(anchor.get('head_branch') or 'Unknown', 80), 'inline': True},
        {'name': 'Commit', 'value': f"[{anchor['head_sha'][:7]}]({commit_url})", 'inline': True},
        {'name': 'Triggered by', 'value': text(actor.get('login', 'Unknown'), 50), 'inline': False},
    ]
    failures, database_jobs = [], []
    deployment_failed = False
    for path, label in WORKFLOWS.items():
        if label == 'Database':
            continue
        run = runs.get(path)
        if not run:
            fields.append({'name': label, 'value': 'No run observed for this revision', 'inline': False})
            continue
        jobs = job_map.get(str(run['id']), [])
        fields.append({'name': label, 'value': '[' + display_result(run, jobs) + '](' + run_url(repository, run) + ')', 'inline': False})
        for job in jobs:
            if any(segment.strip() == 'database' for segment in job['name'].split('/')[:-1]):
                database_jobs.append((run, job))
            if job.get('conclusion') in BAD:
                if job['name'].split('/')[-1].strip() == 'deploy' and run['event'] != 'pull_request':
                    deployment_failed = True
                step = next((step for step in job.get('steps', []) if step.get('conclusion') in BAD), None)
                detail = text(job['name'], 90) + (' → ' + text(step['name'], 100) if step else '')
                url = run_url(repository, run) + '/job/' + str(int(job['id']))
                failures.append('• [' + detail + '](' + url + ')')
    standalone = runs.get('.github/workflows/database-cd.yml')
    if standalone:
        jobs = job_map.get(str(standalone['id']), [])
        database_jobs.extend((standalone, job) for job in jobs)
        for job in jobs:
            if job.get('conclusion') in BAD:
                if job['name'] == 'deploy' and standalone['event'] != 'pull_request':
                    deployment_failed = True
                failures.append('• [Database: ' + text(job['name'], 100) + '](' + run_url(repository, standalone) + ')')
    if database_jobs:
        active = [job for _, job in database_jobs if job.get('status') != 'completed']
        failed = [job for _, job in database_jobs if job.get('conclusion') in BAD]
        deployed = [(run, job) for run, job in database_jobs if job['name'].split('/')[-1].strip() == 'deploy'
                    and job.get('conclusion') == 'success' and run['event'] in {'push', 'workflow_dispatch'}
                    and run.get('head_branch') == 'main']
        checked = [job for _, job in database_jobs if job.get('conclusion') == 'success']
        if failed: value = 'Verification failed'
        elif active: value = 'Verification in progress'
        elif deployed: value = 'Verification passed'
        elif checked: value = 'Checks passed · Deployment skipped'
        elif any(job.get('conclusion') == 'cancelled' for _, job in database_jobs): value = 'Cancelled'
        else: value = 'Skipped'
        source = (deployed[0][0] if deployed else database_jobs[0][0])
        value = '[' + value + '](' + run_url(repository, source) + ')'
    else:
        value = 'No verification result observed'
    fields.insert(6, {'name': 'Database', 'value': value, 'inline': False})
    if failures:
        fields.append({'name': 'Failure details', 'value': '\n'.join(dict.fromkeys(failures))[:1000], 'inline': False})
    if deployment_failed:
        fields.append({'name': 'Recovery', 'value': 'Rollback outcome not verified. Review the failed deployment in Actions.', 'inline': False})
    links = '[View Workflow](' + run_url(repository, anchor) + ') · [View Commit](' + commit_url + ')'
    if pr:
        links += f" · [View Pull Request](https://github.com/{repository}/pull/{pr['number']})"
    fields.append({'name': 'Links', 'value': links, 'inline': False})
    return {'content': '', 'allowed_mentions': {'parse': []}, 'embeds': [{
        'title': icon + ' FUJIPP STUDIO • CI/CD REPORT', 'description': description, 'color': color,
        'fields': fields, 'footer': {'text': card_marker(snapshot['key'])},
    }]}


class Discord:
    def __init__(self, url, transport=None):
        parsed = urllib.parse.urlsplit(url)
        match = re.fullmatch(r'/api(?:/v[0-9]+)?/webhooks/([0-9]{15,22})/([A-Za-z0-9._-]+)', parsed.path)
        if parsed.scheme != 'https' or parsed.netloc not in {'discord.com', 'discordapp.com'} or parsed.query or parsed.fragment or not match:
            raise NotifyError('DISCORD_CI_WEBHOOK must be a native Discord webhook URL without /github')
        self.base = 'https://discord.com' + parsed.path
        self.id, self.transport = match[1], transport or Transport()

    def request(self, method, suffix='', body=None):
        return self.transport.request('Discord', method, self.base + suffix, body)

    def metadata(self):
        info = self.request('GET')
        if str(info.get('id')) != self.id or any(not SNOWFLAKE.fullmatch(str(info.get(key, ''))) for key in ('guild_id', 'channel_id')):
            raise NotifyError('Webhook must belong to a server text channel')
        return info

    def message(self, message_id, key):
        if not SNOWFLAKE.fullmatch(str(message_id)):
            raise NotifyError('Invalid Discord message ID')
        data = self.request('GET', '/messages/' + str(message_id))
        markers = {card_marker(key), 'FUJIPP CI • ' + key}
        if str(data.get('webhook_id')) != self.id or not any(embed.get('footer', {}).get('text') in markers for embed in data.get('embeds', [])):
            raise NotifyError('Message is not owned by this webhook/revision; refusing to edit')
        return data


def synchronize(github, discord, snapshot, notifier_url, recover_id='', allow_new=False):
    key, sha = snapshot['key'], snapshot['anchor']['head_sha']
    context = 'discord/ci/' + key[:40]
    payload = render(snapshot)
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
    status = github.status(sha, context)
    info = discord.metadata()
    prefix = f"https://discord.com/channels/{info['guild_id']}/{info['channel_id']}/"
    message_id = ''
    if recover_id:
        message_id = recover_id
    elif status and str(status.get('target_url', '')).startswith(prefix) and not allow_new:
        message_id = status['target_url'][len(prefix):]
    elif status and not str(status.get('description', '')).startswith('not_sent') and not allow_new:
        raise NotifyError('Previous send is uncertain or points to another channel. Recover the message ID; do not send again blindly.')
    if message_id:
        message = discord.message(message_id, key)
        same = message.get('content', '') == payload['content'] and len(message.get('embeds', [])) == len(payload['embeds'])
        for actual, wanted in zip(message.get('embeds', []), payload['embeds']):
            same = same and all(actual.get(name) == wanted[name] for name in ('title', 'description', 'color', 'fields', 'footer'))
        if recover_id or status.get('description') != 'synced ' + digest or not same:
            discord.request('PATCH', '/messages/' + message_id, payload)
            github.record(sha, context, 'success', 'synced ' + digest, prefix + message_id)
            return 'updated'
        return 'unchanged'
    # A pending journal survives runner loss and uncertain POST responses.
    github.record(sha, context, 'pending', 'dispatch_pending', notifier_url)
    try:
        message = discord.request('POST', '?wait=true', {**payload, 'username': 'FUJIPP CI'})
    except ApiError as error:
        if 400 <= error.status < 500:
            github.record(sha, context, 'error', 'not_sent HTTP ' + str(error.status), notifier_url)
        raise
    message_id = str((message or {}).get('id', ''))
    if not SNOWFLAKE.fullmatch(message_id):
        raise NotifyError('Send response is uncertain; recover the message ID before retrying')
    try:
        github.record(sha, context, 'success', 'synced ' + digest, prefix + message_id)
    except NotifyError:
        raise NotifyError('Message was sent but its pointer was not confirmed. Recovery message ID: ' + message_id) from None
    return 'created'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['resolve', 'notify', 'preview'])
    parser.add_argument('--snapshot', type=Path)
    args = parser.parse_args()
    if args.mode == 'preview':
        print(json.dumps(render(json.loads(args.snapshot.read_text())), ensure_ascii=False, indent=2))
        return
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    github = GitHub(os.environ['GITHUB_REPOSITORY'], os.environ['GH_TOKEN'])
    source = os.environ.get('SOURCE_RUN_ID') or str(event.get('workflow_run', {}).get('id', ''))
    if not re.fullmatch(r'[1-9][0-9]*', source):
        raise NotifyError('A valid source workflow run ID is required')
    anchor = github.request('GET', '/actions/runs/' + source)
    key = card_key(anchor, github.repository)
    if args.mode == 'resolve':
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('key=' + key + '\nsource=' + source + '\n')
        return
    discord = Discord(os.environ.get('DISCORD_CI_WEBHOOK', ''))
    manual = os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
    recover = os.environ.get('RECOVER_MESSAGE_ID', '') if manual else ''
    allow_new = manual and os.environ.get('ALLOW_NEW_MESSAGE') == 'true'
    snapshot = collect(github, anchor)
    url = f"https://github.com/{github.repository}/actions/runs/{int(os.environ['GITHUB_RUN_ID'])}"
    outcome = synchronize(github, discord, snapshot, url, recover, allow_new)
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
        output.write('### Discord CI summary\n\nCard ' + outcome + ' for source revision ' + anchor['head_sha'][:7] + '.\n')
    print('Discord summary:', outcome)


if __name__ == '__main__':
    try:
        main()
    except (NotifyError, KeyError, ValueError, TypeError, OSError):
        # Never emit a traceback containing a webhook URL/token.
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, NotifyError) else 'Invalid notifier metadata/configuration', file=sys.stderr)
        raise SystemExit(1)
