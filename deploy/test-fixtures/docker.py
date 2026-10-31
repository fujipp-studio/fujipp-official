#!/usr/bin/env python3
"""Docker command double; mutates only a test-owned JSON state file."""
import json
import os
from pathlib import Path
import sys

path = Path(os.environ['DEPLOY_TEST_STATE'])
state = json.loads(path.read_text())
args = sys.argv[1:]
if args[0] == 'inspect':
    container = state['containers'].get(args[-1])
    if not container:
        sys.exit(1)
    print(container['status'] + ' ' + container.get('health', 'none'))
    sys.exit(0)
environment = [args[i + 1] for i, value in enumerate(args) if value == '--env-file'][-1]
values = dict(line.split('=', 1) for line in Path(environment).read_text().splitlines() if '=' in line)
command = next(value for value in args if value in ('pull', 'up', 'ps', 'stop', 'rm'))
services = [value for value in args if value in ('backend', 'bot-runner')]
with open(os.environ['DEPLOY_TEST_LOG'], 'a') as log:
    log.write(json.dumps({'command': command, 'services': services, 'args': args, 'images': values}) + '\n')
if command == 'ps':
    print('\n'.join(name for name in services if name in state['containers']))
    sys.exit(0)
for service in services:
    if command == 'up':
        image = values['BACKEND_IMAGE' if service == 'backend' else 'BOT_RUNNER_IMAGE']
        state['containers'][service] = {'image': image, 'status': 'running', 'health': 'healthy'}
    elif command == 'stop' and service in state['containers']:
        state['containers'][service]['status'] = 'stopped'
    elif command == 'rm':
        state['containers'].pop(service, None)
failure = state.get('fail', {})
failed = (not state.get('failed') and failure.get('command') == command
          and failure.get('service') in services)
if failed:
    state['failed'] = True
path.write_text(json.dumps(state))
sys.exit(1 if failed else 0)
