#!/usr/bin/env python3
"""Package only reviewed SQL, checks and migration tools; never secrets/backups."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

from migrationlib import ROOT, MigrationError, catalog, feature_checks, file_hash


def build(output, commit, root=ROOT):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise MigrationError('Invalid bundle commit')
    files, _ = catalog(root)
    config = json.loads((root / 'deploy/postgres/feature-map.json').read_text())
    checks = feature_checks([], root)
    paths = {item['path'] for item in files.values()} | set(checks['paths'])
    paths.update({'deploy/postgres/migrationlib.py', 'deploy/postgres/delivery.py',
                  'deploy/postgres/feature-map.json', 'deploy/postgres/legacy-baseline.json'})
    paths.update(guide for feature in config['features'].values() for guide in feature['guides'])
    hashes = {}
    with tarfile.open(output, 'w:gz') as archive:
        for name in sorted(paths):
            path = root / name
            if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
                raise MigrationError('Invalid bundle source')
            content = path.read_bytes()
            hashes[name] = hashlib.sha256(content).hexdigest()
            item = tarfile.TarInfo(name)
            item.size, item.mode = len(content), 0o600
            archive.addfile(item, io.BytesIO(content))
        content = json.dumps({'version': 1, 'commit': commit, 'files': hashes}, indent=2).encode()
        item = tarfile.TarInfo('database-bundle.json')
        item.size, item.mode = len(content), 0o600
        archive.addfile(item, io.BytesIO(content))
    return file_hash(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip() != args.commit:
        raise MigrationError('Bundle must match the checked-out source revision')
    print(build(args.output, args.commit))
