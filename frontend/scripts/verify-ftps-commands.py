"""Rehearse the generated commands with real lftp's local filesystem backend.

Requires Bun and lftp on PATH. Uses temporary files only; no hosting connection.
Run from frontend/. This also runs before production credentials are configured.
"""
import hashlib
import json
import pathlib
import subprocess
import tempfile


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


with tempfile.TemporaryDirectory(prefix='fujipp-ftps-verify-') as temporary:
    root = pathlib.Path(temporary)
    dist, remote, output = root / 'dist', root / 'remote', root / 'plan'
    dist.mkdir()
    remote.mkdir()
    files = {
        'index.html': 'first html', 'discord-preview.html': 'preview html',
        '.htaccess': 'rewrite', 'assets/app.js': 'app',
        'icons/logo.svg': 'logo', 'data/catalog.json': '{}',
    }
    for name, body in files.items():
        path = dist / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)

    def plan(extra=()):
        result = subprocess.run([
            'bun', 'scripts/deploy-ftps.ts', 'plan', '--dist', str(dist),
            '--out', str(output), '--release', 'rehearsal', *extra,
        ], capture_output=True, text=True, timeout=30)
        require(result.returncode == 0, result.stderr)

    def execute(phase):
        commands = ('set cmd:fail-exit yes\nopen file://' + str(remote)
                    + '\nsource "' + str(output / (phase + '.lftp')) + '"\nbye\n')
        return subprocess.run(['lftp'], input=commands, text=True,
                              capture_output=True, timeout=30)

    plan()
    result = execute('upload')
    require(result.returncode == 0, result.stderr)
    for name, body in files.items():
        require((remote / name).read_text() == body, 'Upload mismatch: ' + name)
    result = execute('finalize')
    require(result.returncode == 0, result.stderr)
    require(json.loads((remote / '.fujipp-deploy-state.json').read_text())['status']
            == 'succeeded', 'Successful state was not committed')

    (dist / 'index.html').write_text('second html')
    plan(['--force'])
    (output / 'stage/assets/app.js.fujipp-next').unlink()
    result = execute('upload')
    require(result.returncode != 0, 'Missing upload source did not fail')
    require((remote / 'index.html').read_text() == 'first html',
            'A failed asset upload published the new HTML')
    state = json.loads((remote / '.fujipp-deploy-state.json').read_text())
    require(state['status'] == 'pending', 'Interrupted upload lost pending state')

    body = 'retired'
    state['manifest']['retained']['assets/retired.js'] = {
        'sha256': hashlib.sha256(body.encode()).hexdigest(),
        'size': len(body), 'retiredAt': '2020-01-01T00:00:00Z',
    }
    state_file = root / 'state.json'
    state_file.write_text(json.dumps(state))
    (remote / 'assets/retired.js').write_text(body)
    (remote / 'assets/retired.js.fujipp-next').write_text(body)
    (remote / 'customer.php').write_text('unmanaged')
    plan(['--state', str(state_file)])
    result = execute('upload')
    require(result.returncode == 0, result.stderr)
    for _ in range(2):
        result = execute('finalize')
        require(result.returncode == 0, result.stderr)
    require(not (remote / 'assets/retired.js').exists(), 'Expired file survived')
    require(not (remote / 'assets/retired.js.fujipp-next').exists(),
            'Expired transfer temporary file survived')
    require((remote / 'customer.php').read_text() == 'unmanaged',
            'Cleanup changed an unmanaged hosting file')

print('lftp rehearsal passed: parallel uploads, dotfiles, interrupted upload, '
      'HTML publication, existing directories, repair and idempotent cleanup')
