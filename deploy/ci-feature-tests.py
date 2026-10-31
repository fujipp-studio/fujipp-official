#!/usr/bin/env python3
"""Feature ownership plus conservative reverse source/test dependencies."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SERVICES = ('backend', 'bot-runner')
TEST_ROOTS = {'backend': 'backend/src/test/java/', 'bot-runner': 'bot-runner/test/'}
SOURCE_ROOTS = {'backend': 'backend/src/main/java/', 'bot-runner': 'bot-runner/src/'}


def matches(rule, path):
    return path.startswith(rule[:-1] if rule.endswith('*') else rule) if rule.endswith(('/', '*')) else path == rule


def owner(path, config):
    choices = [(len(rule), name) for name, feature in config['features'].items()
               for rule in feature['paths'] if matches(rule, path)]
    return max(choices)[1] if choices else None


def expand(patterns):
    return sorted({path.relative_to(ROOT).as_posix() for pattern in patterns
                   for path in ROOT.glob(pattern) if path.is_file()})


def load_map():
    config = json.loads((ROOT / 'deploy/ci-feature-map.json').read_text())
    if config['version'] != 1:
        raise ValueError('Unsupported feature map')
    for name, feature in config['features'].items():
        if not feature['paths'] or not feature['guides']:
            raise ValueError('Missing ownership/guidance: ' + name)
        for rule in feature['paths']:
            path = ROOT / rule.rstrip('*')
            found = list(path.parent.glob(path.name + '*')) if rule.endswith('*') else [path] if path.exists() else []
            if not found:
                raise ValueError('Missing feature source: ' + rule)
        for dependency in feature['dependsOn']:
            if dependency not in config['features']:
                raise ValueError('Unknown feature dependency: ' + dependency)
        for guide in feature['guides']:
            if not (ROOT / guide).is_file():
                raise ValueError('Missing feature guide: ' + guide)
        for service in SERVICES:
            for pattern in feature['tests'][service]:
                if not pattern.startswith(TEST_ROOTS[service]) or not expand([pattern]):
                    raise ValueError('Missing or invalid mapped test pattern: ' + pattern)
    for boundary in config['boundaries']:
        if not boundary['reason'] or not (ROOT / boundary['path']).is_file():
            raise ValueError('Invalid integration boundary')
    for service in SERVICES:
        if not expand(config['baselineTests'][service]):
            raise ValueError('Missing service baseline tests: ' + service)
    # A new module needs explicit coverage. Shared files in features/ still fall
    # back to the full Runner suite when changed.
    for directory in (ROOT / 'bot-runner/src/features').iterdir():
        if directory.is_dir() and any(directory.rglob('*.ts')):
            scope = owner(directory.relative_to(ROOT).as_posix() + '/', config)
            if not scope or config['features'][scope].get('fullSuite'):
                raise ValueError('Unmapped Runner feature folder: ' + directory.name)
    return config


def service_of(path):
    return next((name for name in SERVICES if path.startswith(name + '/')), None)


def is_test(path):
    return path.startswith(TEST_ROOTS['backend']) and path.endswith(('Test.java', 'Tests.java')) or path.startswith(TEST_ROOTS['bot-runner']) and path.endswith('.test.ts')


def without_literals(text):
    # Java text blocks, JS templates, quoted literals and comments cannot create
    # type-reference edges. Computed/reflection dependencies need explicit map entries.
    return re.sub(r'/\*[\s\S]*?\*/|//[^\n]*|"""[\s\S]*?"""|`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', ' ', text)


def consumers():
    graph = {}
    java = list((ROOT / SOURCE_ROOTS['backend']).rglob('*.java')) + list((ROOT / TEST_ROOTS['backend']).rglob('*.java'))
    types = {}
    for path in java:
        types.setdefault(path.stem, []).append(path.relative_to(ROOT).as_posix())
    for path in java:
        consumer = path.relative_to(ROOT).as_posix()
        names = set(re.findall(r'\b[A-Za-z_$][A-Za-z0-9_$]*\b', without_literals(path.read_text())))
        for name in names & types.keys():
            for target in types[name]:
                if target != consumer:
                    graph.setdefault(target, set()).add(consumer)
    ts_files = list((ROOT / SOURCE_ROOTS['bot-runner']).rglob('*.ts')) + list((ROOT / TEST_ROOTS['bot-runner']).rglob('*.ts'))
    for path in ts_files:
        # Includes static imports, re-exports, inline import types and literal
        # lazy imports. NodeNext's .js imports resolve to source .ts files.
        # Preserve quoted URLs/templates while removing comments between import
        # tokens. Import-like text in a literal can only add conservative edges.
        text = re.sub(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`])*`)|/\*[\s\S]*?\*/|//[^\n]*',
                      lambda match: match.group(1) or ' ', path.read_text())
        imports = re.findall(r'(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)[\'\"]([^\'\"]+)[\'\"]', text)
        for specifier in imports:
            if not specifier.startswith('.'):
                continue
            target = (path.parent / specifier).resolve()
            candidates = [target, target.with_suffix('.ts')] if target.suffix else [target.with_suffix('.ts'), target / 'index.ts']
            resolved = next((candidate for candidate in candidates if candidate.is_file()), None)
            if resolved:
                graph.setdefault(resolved.relative_to(ROOT).as_posix(), set()).add(path.relative_to(ROOT).as_posix())
    return graph


def select_tests(changed, requested, force=False):
    config = load_map()
    selected = {name: set() for name in SERVICES}
    full = {name for name in SERVICES if requested[name]} if force else set()
    affected = {name: set() for name in SERVICES}
    reasons, boundaries = [], set()
    graph = consumers() if not force else {}
    pending = list(changed)
    seen = set()

    def include_scope(name, service):
        affected[service].add(name)

    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        service = service_of(path)
        if not service:
            if path.startswith(('deploy/', '.github/')):
                full.update(name for name in SERVICES if requested[name])
            continue
        if not requested[service]:
            continue
        if is_test(path) and path in changed:
            if (ROOT / path).is_file():
                selected[service].add(path)
            else:
                full.add(service)
            continue
        if not (ROOT / path).is_file():
            full.add(service)
            reasons.append('Deleted or renamed source: ' + path)
            if service == 'backend':
                full.add('bot-runner')
            continue
        scope = owner(path, config)
        if not scope:
            # Markdown outside source is not executable. Every unknown runtime,
            # fixture, build or shared source path gets full coverage.
            if path.endswith('.md') and '/src/' not in path:
                continue
            full.add(service)
            if service == 'backend':
                full.add('bot-runner')
            reasons.append('Shared or unclassified source: ' + path)
        else:
            include_scope(scope, service)
            if config['features'][scope].get('fullSuite'):
                full.add(service)
                if service == 'backend':
                    full.add('bot-runner')
                reasons.append('Shared platform code: ' + path)
        for consumer in graph.get(path, []):
            if is_test(consumer):
                selected[service_of(consumer)].add(consumer)
            elif any(boundary['path'] == consumer for boundary in config['boundaries']):
                boundaries.add(consumer)
            else:
                pending.append(consumer)
    # Expand explicit dependents transitively, independently for each service.
    for service in SERVICES:
        queue = list(affected[service])
        for scope in queue:
            for name, feature in config['features'].items():
                if scope in feature['dependsOn'] and name not in affected[service]:
                    affected[service].add(name)
                    queue.append(name)
    # Server behavior affects its clients; client-only UI logic does not require
    # rebuilding/retesting unchanged server implementations.
    affected['bot-runner'].update(name for name in affected['backend'] if config['features'][name]['backendAffectsRunner'])
    queue = list(affected['bot-runner'])
    for scope in queue:
        for name, feature in config['features'].items():
            if scope in feature['dependsOn'] and name not in affected['bot-runner']:
                affected['bot-runner'].add(name)
                queue.append(name)
    for service in SERVICES:
        for name in affected[service]:
            if config['features'][name].get('fullSuite'):
                full.add(service)
            tests = expand(config['features'][name]['tests'][service])
            selected[service].update(tests)
            baseline = set(expand(config['baselineTests'][service]))
            has_service_source = any(rule.startswith(SOURCE_ROOTS[service]) for rule in config['features'][name]['paths'])
            if not set(tests) - baseline and has_service_source:
                full.add(service)
                reasons.append('No dedicated ' + service + ' coverage: ' + name)
        if requested[service] and not selected[service] and not affected[service]:
            full.add(service)
        if requested[service] or selected[service] or affected[service] or service in full:
            selected[service].update(expand(config['baselineTests'][service]))
    tests = {service: ['*'] if service in full else sorted(selected[service]) for service in SERVICES}
    return {'tests': tests, 'features': {service: sorted(names) for service, names in affected.items()},
            'boundaries': sorted(boundaries), 'testReasons': sorted(set(reasons))}


if __name__ == '__main__':
    paths = sys.argv[1:]
    if paths == ['--graph']:
        print(json.dumps({path: sorted(users) for path, users in consumers().items()}))
    else:
        requested = {service: any(path.startswith(service + '/') for path in paths) for service in SERVICES}
        print(json.dumps(select_tests(paths, requested), indent=2))
