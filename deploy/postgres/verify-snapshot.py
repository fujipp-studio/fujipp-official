#!/usr/bin/env python3
"""Compare a restored snapshot with source fingerprints without reconnecting to Supabase."""
import argparse
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target', required=True)
parser.add_argument('--fingerprints', required=True, type=Path)
args = parser.parse_args()
if not re.fullmatch(r'migration_[a-z0-9_]{1,40}', args.target):
    parser.error('verification is restricted to migration_ scratch databases')
root = Path(__file__).resolve().parent
base = ['docker', 'compose', '-f', str(root/'compose.yml'), 'exec', '-T', 'database',
        'psql', '-X', '-U', 'postgres', '-d', args.target, '-At', '-v', 'ON_ERROR_STOP=1']
expected = json.loads(args.fingerprints.read_text())
failures = []
for key, fingerprint in expected.items():
    schema, table = key.split('.', 1)
    identifier = '"' + schema.replace('"', '""') + '"."' + table.replace('"', '""') + '"'
    sql = "SELECT json_build_array(count(*),md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM (SELECT md5(row_to_json(t)::text) h FROM " + identifier + ' t) q;'
    result = subprocess.run(base+['-c', sql], capture_output=True, text=True, check=True)
    if json.loads(result.stdout) != fingerprint:
        failures.append(key)
report = {'target': args.target, 'tables_checked': len(expected), 'rows_checked': sum(v[0] for v in expected.values()), 'mismatched_tables': failures}
print(json.dumps(report))
raise SystemExit(1 if failures else 0)
