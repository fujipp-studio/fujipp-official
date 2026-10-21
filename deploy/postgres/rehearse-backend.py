#!/usr/bin/env python3
"""Run the candidate Backend against a restored scratch DB, then remove it."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target', required=True)
parser.add_argument('--jar', required=True, type=Path)
args = parser.parse_args()
if not re.fullmatch(r'migration_[a-z0-9_]{1,40}', args.target):
    parser.error('only migration_ scratch databases are allowed')
os.umask(0o077)
root = Path(__file__).resolve().parent
password_file = root/'secrets'/'backend_password'
if not password_file.exists():
    password_file.write_text(secrets.token_hex(32))
password = password_file.read_text().strip()
env = os.environ.copy()
env['PG_APP_PASSWORD'] = password
subprocess.run(['docker','compose','-f',str(root/'compose.yml'),'exec','-T','-e','PG_APP_PASSWORD',
                'database','psql','-X','-U','postgres','-d',args.target,'-v','ON_ERROR_STOP=1'],
               env=env,check=True,input=b"\\getenv app_password PG_APP_PASSWORD\nSELECT format('ALTER ROLE fujipp_backend LOGIN PASSWORD %L', :'app_password') \\gexec\n")
values = dict(line.split('=',1) for line in Path('/opt/fujipp/env/fujipp-official.production.env').read_text().splitlines()
              if line and not line.startswith('#') and '=' in line)
values.update(DB_URL='jdbc:postgresql://database:5432/'+args.target,DB_USERNAME='fujipp_backend',DB_PASSWORD=password,
              SPRING_PROFILES_ACTIVE='production',AUTH_IDENTITY_PROJECTION_ENABLED='true',
              JAVA_TOOL_OPTIONS='-Xms128m -Xmx640m -XX:MaxMetaspaceSize=192m')
# Do not pass Docker's embedded DNS alias "database" to production yet.
config = root/'.rehearsal.env'
config.write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
image = subprocess.check_output(['docker','inspect','fujipp-official-backend-1','--format','{{.Config.Image}}'],text=True).strip()
name = 'fujipp-backend-db-rehearsal'
started = False
try:
    subprocess.run(['docker','run','-d','--name',name,'--network','fujipp-postgres_database',
                    '--env-file',str(config),'--memory','1g','--cpus','1','--publish','127.0.0.1:3602:8080',
                    '--mount','type=bind,src='+str(args.jar.resolve())+',dst=/app/app.jar,readonly',image],check=True)
    started = True
    subprocess.run(['docker','network','connect','fujipp-official_internal',name],check=True)
    def get(path, headers=None):
        req=urllib.request.Request('http://127.0.0.1:3602'+path,headers=headers or {})
        with urllib.request.urlopen(req,timeout=10) as response:
            return json.load(response)
    for attempt in range(90):
        try:
            if get('/actuator/health').get('status')=='UP':break
        except Exception:
            pass
        time.sleep(1)
    else:
        raise RuntimeError('Rehearsal Backend health did not become UP; inspect container logs privately')
    report={'database':args.target,'health':'UP','public_endpoints':{}}
    for path in ['/api/v1/works','/api/v1/store/features','/api/v1/runtime/plans','/api/v1/runtime/availability']:
        payload=get(path)
        report['public_endpoints'][path]='PASS'
    payload=get('/internal/v1/runtime/bootstrap',{'X-Runner-Token':values['RUNNER_API_TOKEN']})
    report['bootstrap_bots']=len(payload['bots'])
    report['bootstrap_features']=sum(len(bot['features']) for bot in payload['bots'])
    report['production_connection_changed']=False
    (root/'migrations'/args.target/'backend-rehearsal.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
finally:
    if started:subprocess.run(['docker','rm','-f',name],check=True)
    config.unlink(missing_ok=True)
