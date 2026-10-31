#!/usr/bin/env python3
"""Execute a validated test plan without shell expansion or skipped-test flags."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def command(service, tests):
    if service not in ('backend', 'bot-runner') or not isinstance(tests, list) or not tests:
        raise ValueError('Missing or invalid service test plan')
    full = tests == ['*']
    if service == 'backend':
        args = ['./mvnw', '--batch-mode', 'verify']
        if not full:
            classes = []
            for name in tests:
                path = (ROOT / name).resolve()
                relative = path.relative_to(ROOT / 'backend/src/test/java')
                classname = '.'.join(relative.with_suffix('').parts)
                if not path.is_file() or path.suffix != '.java' or not re.fullmatch(r'[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*', classname):
                    raise ValueError('Invalid selected Java test: ' + str(name))
                classes.append(classname)
            args.append('-Dtest=' + ','.join(classes))
        return args
    selected = sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / 'bot-runner/test').rglob('*.test.ts')) if full else tests
    for name in selected:
        path = (ROOT / name).resolve()
        path.relative_to(ROOT / 'bot-runner/test')
        if not path.is_file() or not str(path).endswith('.test.ts'):
            raise ValueError('Invalid selected Runner test: ' + str(name))
    return ['node', '--import', 'tsx', '--test', *[str((ROOT / path).relative_to(ROOT / 'bot-runner')) for path in selected]]


if __name__ == '__main__':
    service = sys.argv[1]
    variable = 'BACKEND_TESTS' if service == 'backend' else 'RUNNER_TESTS'
    tests = json.loads(os.environ.get(variable, '["*"]'))
    args = command(service, tests)
    print('Test selection:', 'full suite' if tests == ['*'] else str(len(tests)) + ' files', flush=True)
    sys.exit(subprocess.call(args, cwd=ROOT / service))
