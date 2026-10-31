#!/usr/bin/env python3
"""Select CI and release services. All network operations are read-only."""
import json
import importlib.util
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'deploy/ci-services.json').read_text())
if CONFIG['version'] != 1 or set(CONFIG['services']) != {'backend', 'bot-runner'}:
    raise ValueError('Unsupported delivery service map')
if any(service['root'] != name + '/' for name, service in CONFIG['services'].items()):
    raise ValueError('Service roots must match workflow build contexts')


def selection(changed, force=False):
    checks, release = set(), set()
    reason = 'Changed services and shared contract boundaries'
    paired = force
    if force:
        checks.update(CONFIG['services'])
        release.update(CONFIG['services'])
        reason = 'Manual run or no reliable deployed baseline'
    for path in changed:
        contract = (path.startswith('backend/src/main/')
                    and path.endswith(tuple(CONFIG['pairedBackendSuffixes'])))
        if contract or any(path.startswith(rule) for rule in CONFIG['pairedPaths']):
            checks.update(CONFIG['services'])
            release.update(CONFIG['services'])
            reason = 'Shared contract or deployment infrastructure changed'
            paired = True
            continue
        if any(path.startswith(rule) for rule in CONFIG['verificationPaths']):
            checks.update(CONFIG['services'])
            continue
        for name, service in CONFIG['services'].items():
            if not path.startswith(service['root']):
                continue
            if path.startswith(service['tests']):
                checks.add(name)
            elif not path.endswith('.md') or path.startswith(service['root'] + 'src/'):
                checks.add(name)
                release.add(name)
    services = 'both' if len(release) == 2 else next(iter(release), 'none')
    matrix = {'include': [{
        'name': name, 'context': '.ci-images/' + name,
        'dockerfile': name + '/Dockerfile.runtime',
        'artifact': name + '-compiled',
        'image': 'fujipp-official-' + name,
    } for name in sorted(release)]}
    result = {
        'backend': 'backend' in checks, 'runner': 'bot-runner' in checks,
        'deploy_backend': 'backend' in release, 'deploy_runner': 'bot-runner' in release,
        'services': services, 'matrix': matrix, 'reason': reason,
    }
    spec = importlib.util.spec_from_file_location('ci_feature_tests', ROOT / 'deploy/ci-feature-tests.py')
    features = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(features)
    test_plan = features.select_tests(changed, {'backend': result['backend'], 'bot-runner': result['runner']}, force=paired)
    result.update(test_plan)
    result['backend_tests'] = test_plan['tests']['backend']
    result['runner_tests'] = test_plan['tests']['bot-runner']
    result['backend'] = bool(result['backend_tests'])
    result['runner'] = bool(result['runner_tests'])
    return result


def deployed_base(token, repository):
    """Skip successful test-only runs: require a successful deploy job too."""
    if not token or not repository:
        return None
    api = os.environ.get('GITHUB_API_URL', 'https://api.github.com')

    def get(path):
        request = urllib.request.Request(api + '/repos/' + repository + path, headers={
            'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
            'User-Agent': 'fujipp-delivery-plan',
        })
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)

    try:
        runs = get('/actions/workflows/backend-cd.yml/runs?branch=main&status=success&per_page=10')
        for run in runs['workflow_runs']:
            jobs = get('/actions/runs/' + str(run['id']) + '/jobs?per_page=100')['jobs']
            if any(job['name'] == 'deploy' and job['conclusion'] == 'success' for job in jobs):
                return run['head_sha']
    except (OSError, ValueError, KeyError):
        # A missing baseline must expand coverage, never silently skip a service.
        return None
    return None


def changed_files(base, head):
    if not base or not re.fullmatch('[0-9a-f]{40}', base) or base == '0' * 40:
        return None
    if not head or not re.fullmatch('[0-9a-f]{40}', head):
        return None
    result = subprocess.run(['git', 'diff', '--name-only', '-z', '--no-renames', base, head],
                            cwd=ROOT, capture_output=True)
    return [file for file in result.stdout.decode().split('\0') if file] if result.returncode == 0 else None


if __name__ == '__main__':
    event = os.environ.get('CI_EVENT', '')
    head = os.environ.get('CI_HEAD', '')
    base = os.environ.get('CI_BASE', '') if event == 'pull_request' else None
    if event == 'push':
        base = deployed_base(os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY'))
    changed = changed_files(base, head)
    plan = selection(changed or [], force=event == 'workflow_dispatch' or changed is None)
    plan.update(base=base, head=head, changed=changed or [])
    print(json.dumps(plan, indent=2))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            for key in ('backend', 'runner', 'deploy_backend', 'deploy_runner', 'services', 'matrix', 'backend_tests', 'runner_tests'):
                value = json.dumps(plan[key], separators=(',', ':')) if not isinstance(plan[key], str) else plan[key]
                output.write(key + '=' + value + '\n')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write('### Backend / Runner delivery\n\n' + plan['reason']
                         + '\n\nDeploy: `' + plan['services'] + '`\n\nBaseline: `'
                         + (base or 'unavailable; both services selected') + '`\n')
            for service, tests in plan['tests'].items():
                output.write('\n' + service + ' features: ' + (', '.join(plan['features'][service]) or 'shared / full suite')
                             + '\n\nTests: ' + ('full suite' if tests == ['*'] else str(len(tests)) + ' files') + '\n')
            if plan['testReasons']:
                output.write('\nFallbacks: ' + '; '.join(plan['testReasons']) + '\n')
