#!/usr/bin/env python3
"""Disposable, loopback-only Docker SQL/REST/Storage integration target.

Never accepts a database URL, token, project ref, remote Docker context or
hosted SQL target. Credentials are generated locally, mode 0600, not printed.
Source-derived prerequisites are NOT a verified Production schema baseline.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
STATE = ROOT.parent / 'work' / 'grindctrl-m1-local'
LABEL = 'io.grindctrl.disposable=m1-local'
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
IMAGES = {
 'db': 'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3',
 'rest': 'postgrest/postgrest:v14.18@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf',
 'storage': 'supabase/storage-api:v1.81.0@sha256:98ffec5d0678803783c30e404c27f4ec65e97efbe014088f2a86b4b8b54b9f54',
 'node': 'node:24.21.0-alpine@sha256:333f6b3eca25980d5682c26207665b93c9417786b21760b2764d5821d9704c8a',
 'redis': 'redis:7.4-alpine@sha256:8da19c7399dca900c6822a1cf30f9d2285585e2c4b457ff4095b0f4500054d3f',
 # Community adapter explicitly recommended by Upstash for local development.
 'redis-http': 'hiett/serverless-redis-http@sha256:5b0bb9239fce53abf87b2018a7a0deb9ec7bd900c5360738fe5fbeeb426f9150',
}
DELTAS = [
 'supabase-migration-shops.sql', 'supabase-migration-plans.sql',
 'supabase/tryon_settings_arabic_labels.sql', 'supabase/store_launch.sql',
 'supabase/20260831_tryon_durable_result_recovery.sql',
 'supabase/20261016_tryon_credit_balance.sql',
 'supabase/20260909_shopify_privacy_requests.sql',
 'supabase/20261024_shopify_installation_isolation.sql',
 'supabase/20261024_shopify_review_remediation.sql',
 'supabase/20261024_shopify_privacy_casework.sql',
]

def docker(*args, data=None):
    env = os.environ.copy()
    for key in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'):
        env.pop(key, None)
    p = subprocess.run(DOCKER + list(args), input=data, text=True, capture_output=True, env=env)
    if p.returncode:
        # Never echo Docker commands/env files/SQL payloads or provider responses.
        raise RuntimeError('local Docker operation failed: ' + args[0])
    return p.stdout.strip()

def private_write(path, value):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write(value)

def jwt(secret, role):
    def enc(data):
        return base64.urlsafe_b64encode(json.dumps(data,separators=(',',':')).encode()).rstrip(b'=')
    content = enc({'alg':'HS256','typ':'JWT'}) + b'.' + enc({
        'iss':'grindctrl-local-only','role':role,'iat':int(time.time()),'exp':int(time.time())+86400})
    return (content + b'.' + base64.urlsafe_b64encode(hmac.new(secret.encode(),content,hashlib.sha256).digest()).rstrip(b'=')).decode()

def state():
    value = json.loads((STATE/'state.json').read_text())
    if value.get('kind') != 'disposable-local-only' or time.time() > value['expires_at']:
        raise RuntimeError('local state invalid/expired; stop target, preserve evidence, create a new run')
    return value

def sql(s, text, database='m1_local'):
    if database != 'm1_local':
        raise RuntimeError('only the disposable local database is permitted')
    return docker('exec','-i',s['prefix']+'-db','psql','-X','-q','-t','-A',
                  '-v','ON_ERROR_STOP=1','-U','postgres','-d',database,data=text)

def run(s, name, image, env=None, extra=None, command=None):
    args = ['run','-d','--name',s['prefix']+'-'+name,'--label',LABEL,
            '--network',s['prefix']+('-edge' if name=='gateway' else ''),'--network-alias',name,'--memory','768m',
            '--cpus','1','--pids-limit','128','--security-opt','no-new-privileges:true']
    if env:
        path=STATE/(name+'.env')
        private_write(path,''.join(k+'='+str(v)+'\n' for k,v in env.items()))
        args+=['--env-file',str(path)]
    docker(*(args+(extra or [])+[image]+(command or [])))
    if name=='gateway':
        docker('network','connect','--alias','gateway',s['prefix'],s['prefix']+'-gateway')

def wait_for(check):
    for _ in range(45):
        try:
            if check(): return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('local service did not become ready; inspect local container diagnostics')

def up():
    # Refuse replacement/reset: restarts must preserve reservations and evidence.
    STATE.mkdir(parents=True, mode=0o700, exist_ok=False)
    os.chmod(STATE,0o700)
    s={'kind':'disposable-local-only','prefix':'gc-m1-'+secrets.token_hex(4),
       'expires_at':int(time.time())+86400,'url':'http://127.0.0.1:54380',
       'password':secrets.token_hex(24),'jwt_secret':secrets.token_hex(32)}
    s['anon_key']=jwt(s['jwt_secret'],'anon')
    s['service_key']=jwt(s['jwt_secret'],'service_role')
    private_write(STATE/'state.json',json.dumps(s))
    docker('network','create','--internal','--label',LABEL,s['prefix'])
    run(s,'db',IMAGES['db'],{'POSTGRES_PASSWORD':s['password'],'POSTGRES_DB':'m1_local'})
    wait_for(lambda:docker('exec',s['prefix']+'-db','pg_isready','-U','postgres','-d','m1_local').endswith('accepting connections'))
    sql(s,(HERE/'prerequisites.sql').read_text())
    sql(s,"alter role authenticator password '"+s['password']+"'; alter role supabase_storage_admin password '"+s['password']+"';")
    run(s,'rest',IMAGES['rest'],{
        'PGRST_DB_URI':'postgres://authenticator:'+s['password']+'@db:5432/m1_local',
        'PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':s['jwt_secret']})
    run(s,'storage',IMAGES['storage'],{
        'ANON_KEY':s['anon_key'],'SERVICE_KEY':s['service_key'],'AUTH_JWT_SECRET':s['jwt_secret'],
        'DATABASE_URL':'postgres://supabase_storage_admin:'+s['password']+'@db:5432/m1_local',
        'DATABASE_POOL_URL':'postgres://supabase_storage_admin:'+s['password']+'@db:5432/m1_local',
        'POSTGREST_URL':'http://rest:3000','STORAGE_BACKEND':'file','FILE_STORAGE_BACKEND_PATH':'/var/lib/storage',
        'FILE_SIZE_LIMIT':'16777216','TENANT_ID':'m1-local','REGION':'local','GLOBAL_S3_BUCKET':'local',
        'ENABLE_IMAGE_TRANSFORMATION':'false','STORAGE_PUBLIC_URL':s['url'],
        'REQUEST_ALLOW_X_FORWARDED_PATH':'true'})
    wait_for(lambda:sql(s,"select to_regclass('storage.buckets') is not null;")=='t')
    sql(s,'grant usage on schema storage to service_role; '
        'grant all on all tables in schema storage to service_role; '
        'grant usage on all sequences in schema storage to service_role;')
    applied=[]
    for relative in DELTAS:
        data=(ROOT/relative).read_bytes()
        sql(s,data.decode())
        applied.append({'path':relative,'sha256':hashlib.sha256(data).hexdigest()})
    sql(s,(HERE/'seed.sql').read_text())
    sql(s,"notify pgrst,'reload schema';")
    # Docker 28 does not publish ports for an internal-only container. The
    # credential-free, fixed-upstream router has a separate ingress network;
    # database/REST/storage remain on the internal network only.
    docker('network','create','--label',LABEL,s['prefix']+'-edge')
    run(s,'gateway',IMAGES['node'],extra=[
        '-p','127.0.0.1:54380:8000','-p','127.0.0.1:3102:8001','--read-only','--cap-drop','ALL','--user','node',
        '--mount','type=bind,src='+str(HERE/'gateway.mjs')+',dst=/gateway.mjs,readonly'],
        command=['node','/gateway.mjs'])
    def ready():
        req=urllib.request.Request(s['url']+'/rest/v1/tryon_plans?select=plan_key',headers={
            'Authorization':'Bearer '+s['service_key'],'apikey':s['service_key']})
        with urllib.request.urlopen(req,timeout=2) as res:
            return res.status==200
    private_write(STATE/'applied.json',json.dumps(applied,indent=2))
    wait_for(ready)
    print('Local PostgreSQL, PostgREST and Storage API ready on 127.0.0.1:54380; no hosted resources.')
    print('Source-derived prerequisites; hosted baseline parity UNVERIFIED. Two synthetic 12-credit accounts.')

def local_redis_config(s):
    value=json.loads((STATE/'redis-state.json').read_text())
    if value.get('kind')!='disposable-local-redis' or value.get('prefix')!=s['prefix'] \
      or value.get('url')!='http://127.0.0.1:54380/redis' or value.get('expires_at')!=s['expires_at']:
        raise RuntimeError('local Redis target mismatch')
    return value

def owned_container(s,name):
    container=s['prefix']+'-'+name
    if docker('inspect','--format','{{index .Config.Labels "io.grindctrl.disposable"}}',container)!='m1-local':
        raise RuntimeError('refuse nonlocal container')
    return container

def redis_ready(s):
    config=local_redis_config(s)
    req=urllib.request.Request(config['url'],data=b'["PING"]',method='POST',
          headers={'Authorization':'Bearer '+config['token'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=2) as res:
        return json.load(res).get('result')=='PONG'

def redis():
    s=state()
    path=STATE/'redis-state.json'
    if path.exists():
        local_redis_config(s)
        owned_container(s,'redis');owned_container(s,'redis-http')
    else:
        # Reuses the existing local target; never resets DB, objects or budget.
        token=secrets.token_hex(32);password=secrets.token_hex(32)
        private_write(path,json.dumps({'kind':'disposable-local-redis','prefix':s['prefix'],
            'url':'http://127.0.0.1:54380/redis','token':token,'expires_at':s['expires_at']}))
        data=STATE/'redis-data';data.mkdir(mode=0o700)
        conf=STATE/'redis.conf'
        private_write(conf,'bind 0.0.0.0\nprotected-mode yes\nrequirepass '+password+
            '\nappendonly yes\nappendfsync everysec\nmaxmemory 64mb\nmaxmemory-policy noeviction\n')
        run(s,'redis',IMAGES['redis'],extra=[
            '--user',str(os.getuid())+':'+str(os.getgid()),'--read-only','--cap-drop','ALL',
            '--mount','type=bind,src='+str(conf)+',dst=/etc/redis/m1.conf,readonly',
            '--mount','type=bind,src='+str(data)+',dst=/data'],
            command=['redis-server','/etc/redis/m1.conf'])
        run(s,'redis-http',IMAGES['redis-http'],{'SRH_MODE':'env','SRH_TOKEN':token,
            'SRH_CONNECTION_STRING':'redis://:'+password+'@redis:6379','SRH_PORT':'8080',
            'SRH_MAX_CONNECTIONS':'2'},extra=['--read-only','--cap-drop','ALL','--tmpfs','/tmp:size=16m,mode=1777'])
        # Existing router processes need to load the new fixed Redis route.
        # Refuse interruption if a reserved job currently needs its connection.
        if sql(s,"select count(*) from tryon_jobs where status='processing';")!='0':
            raise RuntimeError('local Redis ready; router restart requires reserved-job drain')
        docker('restart','--time','5',owned_container(s,'gateway'))
    wait_for(lambda:redis_ready(s))
    private_evidence=STATE/'redis-evidence.json'
    if not private_evidence.exists():
        private_write(private_evidence,json.dumps({'kind':'local-only','url':'http://127.0.0.1:54380/redis',
            'images':{k:IMAGES[k] for k in ('redis','redis-http')},'account_required':False,
            'public_endpoint':False,'credentials_printed':False}))
    print('Real local Redis + Upstash-compatible REST ready; no hosted resource or account credential.')

def backup():
    s=state()
    dump=docker('exec',s['prefix']+'-db','pg_dump','-U','postgres','-d','m1_local','--no-owner')
    private_write(STATE/'database.sql',dump)
    # Storage objects are separate from a SQL backup.
    docker('cp',s['prefix']+'-storage:/var/lib/storage',str(STATE/'storage-backup'))
    print('Local-only SQL and separate storage backup saved privately; no restore or deletion.')

def test_phase(phase):
    s=state()
    env=os.environ.copy()
    # A narrow child environment, never inherit production/runtime credentials.
    env={k:v for k,v in env.items() if k in ('PATH','HOME','LANG','NODE_EXTRA_CA_CERTS')}
    env.update({'M1_LOCAL_STATE':str(STATE/'state.json'),'M1_LOCAL_PHASE':phase})
    result=subprocess.run(['node',str(ROOT/'apps/web-next/node_modules/vitest/vitest.mjs'),
        'run','--config',str(HERE/'vitest.config.ts')],cwd=ROOT/'apps/web-next',env=env)
    return result.returncode

def tests(phase='runtime'):
    raise SystemExit(test_phase(phase))

def test_redis():
    s=state();local_redis_config(s)
    result=test_phase('redis')
    if result:raise SystemExit(result)
    target=owned_container(s,'redis')
    docker('stop','--time','10',target)
    try:
        result=test_phase('redis-outage')
    finally:
        docker('start',target)
        wait_for(lambda:redis_ready(s))
    if result:raise SystemExit(result)
    raise SystemExit(test_phase('redis-recovery'))

def rehearse():
    s=state()
    backup()
    # Recovery is a second database inside this same disposable cluster. No
    # hosted connection or destructive down-migration is accepted by this tool.
    docker('exec',s['prefix']+'-db','createdb','-U','postgres','m1_recovery')
    docker('exec','-i',s['prefix']+'-db','psql','-X','-q','-v','ON_ERROR_STOP=1',
           '-U','postgres','-d','m1_recovery',data=(STATE/'database.sql').read_text())
    counts="select jsonb_build_object('ledger',(select count(*) from tryon_credit_ledger),'jobs',(select count(*) from tryon_jobs),'installations',(select count(*) from shopify_installations),'privacy',(select count(*) from shopify_privacy_work_queue));"
    original=sql(s,counts)
    restored=docker('exec',s['prefix']+'-db','psql','-X','-t','-A','-U','postgres','-d','m1_recovery','-c',counts)
    if json.loads(original)!=json.loads(restored):raise RuntimeError('local backup restore counts differ')
    private_write(STATE/'restore-evidence.json',json.dumps({'source':'m1_local','restored':'m1_recovery',
      'counts':json.loads(original),'sql_sha256':hashlib.sha256((STATE/'database.sql').read_bytes()).hexdigest()}))
    # Normal restart preserves all database/storage/budget files. Fresh worker
    # below cannot use the former process's job cache or provider responses.
    for name in ('storage','rest','db'):
        docker('stop','--time','10',s['prefix']+'-'+name)
    for name in ('db','rest','storage'):
        docker('start',s['prefix']+'-'+name)
        if name=='db':wait_for(lambda:docker('exec',s['prefix']+'-db','pg_isready','-U','postgres','-d','m1_local').endswith('accepting connections'))
    time.sleep(2)
    print('Local logical restore verified; DB/REST/Storage restarted, budget retained.')
    tests('recovery')

def preview():
    s=state()
    if os.getuid()==0:raise RuntimeError('local preview requires a nonroot operator')
    # Only locally built standalone artifacts, not an existing deployed image.
    build=ROOT/'apps/web-next/.next'
    if not (build/'standalone/server.js').is_file():raise RuntimeError('build the credential-free local candidate first')
    if not (STATE/'provider/budget.json').is_file():raise RuntimeError('real local SQL test run must precede preview')
    context=STATE/'image-context';context.mkdir(mode=0o700)
    for origin,dest in [(build/'standalone','standalone'),(build/'static','static'),(ROOT/'apps/web-next/public','public')]:
        shutil.copytree(origin,context/dest)
    harness=context/'harness';harness.mkdir()
    for p in [HERE/'preview-preload.mjs',HERE/'preview-guards.mjs',HERE.parent/'provider-harness.mjs',HERE.parent/'config.mjs']:
        shutil.copyfile(p,harness/p.name)
    shutil.copyfile(HERE/'Dockerfile',context/'Dockerfile')
    revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    image=s['prefix']+'-preview:'+revision
    docker('build','--network','none','--build-arg','SOURCE_SHA='+revision,'-t',image,str(context))
    config=STATE/'preview-config';config.mkdir(mode=0o700)
    redis_config=local_redis_config(s) if (STATE/'redis-state.json').exists() else None
    manifest={'kind':s['kind'],'prefix':s['prefix'],'expires_at':s['expires_at'],'source_sha':revision}
    if redis_config:manifest['redis_token_sha256']=hashlib.sha256(redis_config['token'].encode()).hexdigest()
    private_write(config/'preview.json',json.dumps(manifest))
    run(s,'app',image,{
        'NEXT_PUBLIC_SUPABASE_URL':'http://gateway:8000','SUPABASE_SERVICE_ROLE_KEY':s['service_key'],
        'NEXT_PUBLIC_APP_URL':'http://127.0.0.1:3102','GRINDCTRL_CAPABILITY_SECRET':secrets.token_hex(32),
        'SHOPIFY_TOKEN_ENC_KEY':base64.b64encode(secrets.token_bytes(32)).decode(),
        'SHOPIFY_APPS':json.dumps([{'clientId':'a'*32,'secret':secrets.token_hex(32)},
                                 {'clientId':'b'*32,'secret':secrets.token_hex(32)}]),
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'','CLERK_SECRET_KEY':'',
        'UPSTASH_REDIS_REST_URL':'http://gateway:8000/redis' if redis_config else '',
        'UPSTASH_REDIS_REST_TOKEN':redis_config['token'] if redis_config else ''},extra=[
        '--user',str(os.getuid())+':'+str(os.getgid()),
        '--read-only','--cap-drop','ALL','--tmpfs','/tmp:size=64m,mode=1777',
        '--tmpfs','/app/apps/web-next/.next/cache:size=64m,uid='+str(os.getuid())+',gid='+str(os.getgid())+',mode=0700',
        '--mount','type=bind,src='+str(config)+',dst=/run/local-preview,readonly',
        '--mount','type=bind,src='+str(STATE/'provider')+',dst=/run/local-budget'])
    def ready():
        with urllib.request.urlopen('http://127.0.0.1:3102/api/health',timeout=3) as res:
            data=json.load(res)
        return data.get('ok') is True and data.get('release')==revision
    wait_for(ready)
    private_write(STATE/'preview-evidence.json',json.dumps({'source':revision,
        'image_id':docker('image','inspect','--format','{{.Id}}',image),
        'url':'http://127.0.0.1:3102','shopify':'SYNTHETIC_NOT_CONNECTED',
        'clerk':'NOT_CONNECTED','redis':'NOT_CONNECTED','external_url':None}))
    print('Actual local Docker application: http://127.0.0.1:3102 (not a public/shareable URL).')
    print('Shopify/Clerk remain unconnected; protected features fail closed. No live E2E claim.')

def refresh_preview():
    s=state()
    if sql(s,"select count(*) from tryon_jobs where status='processing';")!='0':
        raise RuntimeError('local preview refresh requires reserved-job drain')
    name=owned_container(s,'app')
    docker('stop','--time','10',name);docker('rm',name)
    stamp=str(time.time_ns())
    for relative in ('image-context','preview-config','app.env','preview-evidence.json'):
        path=STATE/relative
        if path.exists():path.rename(path.with_name(path.name+'-retired-'+stamp))
    # Database, objects and /provider budget directory are deliberately retained.
    preview()

def stop():
    # Can stop an expired run too. Only resources bearing this local label.
    s=json.loads((STATE/'state.json').read_text())
    if s.get('kind')!='disposable-local-only': raise RuntimeError('invalid local state')
    names=docker('ps','-a','--filter','label='+LABEL,'--format','{{.Names}}').splitlines()
    for name in ('app','gateway','redis-http','redis','storage','rest','db'):
        container=s['prefix']+'-'+name
        if container not in names:continue
        label=docker('inspect','--format','{{index .Config.Labels "io.grindctrl.disposable"}}',container)
        if label!='m1-local': raise RuntimeError('refuse nonlocal container')
        docker('stop','--time','15',container)
    print('Only this disposable local stack stopped. Containers/data/evidence retained.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['up','test','redis','test-redis','backup','rehearse','preview','refresh-preview','stop'])
    args=parser.parse_args()
    try:
        {'up':up,'test':tests,'redis':redis,'test-redis':test_redis,
          'backup':backup,'rehearse':rehearse,'preview':preview,'refresh-preview':refresh_preview,'stop':stop}[args.operation]()
    except Exception as exc:
        # Messages are fixed local error classes, never echo server/SQL replies.
        print('BLOCKED:',str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__)
        raise SystemExit(1)
