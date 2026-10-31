#!/usr/bin/env python3
"""Filesystem-only lftp test double. Never opens a network connection."""
import os
import pathlib
import shlex
import shutil
import sys

remote = pathlib.Path(os.environ['FTPS_TEST_ROOT'])
try:
    for line in sys.stdin:
        args = shlex.split(line)
        if not args or args[0] in ('set', 'cd', 'bye'):
            continue
        command = args[0]
        if command == 'cls':
            print('\n'.join(item.name for item in remote.iterdir()))
        elif command == 'get':
            shutil.copyfile(remote / args[1], args[3])
        elif command == 'mkdir':
            (remote / args[2]).mkdir(parents=True, exist_ok=True)
        elif command == 'put':
            if args[3] == os.environ.get('FTPS_TEST_FAIL'):
                raise RuntimeError('simulated transfer failure')
            shutil.copyfile(args[1], remote / args[3])
        elif command == 'mput':
            for source in args[5:]:
                shutil.copyfile(source, remote / args[4] / pathlib.Path(source).name)
        elif command == 'mv':
            os.replace(remote / args[1], remote / args[2])
        elif command == 'rm':
            (remote / args[2]).unlink(missing_ok=True)
        else:
            raise RuntimeError('unsupported test command: ' + command)
except Exception as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
