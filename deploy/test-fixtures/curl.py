#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

path = Path(os.environ['DEPLOY_TEST_STATE'])
state = json.loads(path.read_text())
if state.get('fail_health') and not state.get('health_failed'):
    state['health_failed'] = True
    path.write_text(json.dumps(state))
    sys.exit(22)
