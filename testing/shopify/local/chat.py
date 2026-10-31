#!/usr/bin/env python3
"""One bounded local anonymous Store Chat HTTP round-trip; no Clerk bypass.

Actual SQL, Redis, routes and orchestration; only the existing AI wire response
is synthetic. Uses one provider invocation and preserves its durable budget.
No hosted URL, key, merchant target or identity argument is accepted.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.error
import urllib.request
import uuid

HERE=Path(__file__).resolve().parent
ORIGIN='http://127.0.0.1:3102'
SHOP='m1-local-x.myshopify.com'
OWNER='m1_local_chat_contract_owner'
SITE_NAME='M1 Local Store Chat Contract'
REPLY='Synthetic controlled-test response; no AI provider was called.'

def api(s,path,data=None,method='GET',service=False):
    base=s['url'] if service else ORIGIN
    headers={'Content-Type':'application/json'}
    if service:
        headers.update({'Authorization':'Bearer '+s['service_key'],'apikey':s['service_key'],
                        'Prefer':'return=representation'})
    request=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),
                                  headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # Never log payloads, embed/session identifiers or raw server errors.
        raise RuntimeError('local_chat_http_'+str(exc.code)) from None

def one(value):
    if isinstance(value,list) and len(value)==1:return value[0]
    if isinstance(value,dict):return value
    raise RuntimeError('local_chat_rpc_shape_invalid')

def fingerprints(stack,s):
    parts=[]
    for name in ('tryon_jobs','tryon_credit_ledger','tryon_subscriptions','shopify_installations'):
        parts.append("'"+name+"',(select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by id),'')) from public."+name+' t)')
    return stack.sql(s,'select jsonb_build_object('+','.join(parts)+');')

def main():
    spec=importlib.util.spec_from_file_location('foundations',HERE/'foundations.py')
    foundation=importlib.util.module_from_spec(spec);spec.loader.exec_module(foundation)
    stack,s,_=foundation.runtime()
    if s['url']!='http://127.0.0.1:54380':raise RuntimeError('local_chat_target_invalid')
    ready=stack.sql(s,"select to_regprocedure('public.bootstrap_profile(text,text,text,text,text,text)') is not null and to_regclass('public.messenger_knowledge') is not null;")
    if ready!='t':raise RuntimeError('local_chat_schema_not_ready')
    budget_path=stack.STATE/'provider/budget.json'
    before_budget=json.loads(budget_path.read_text())
    if before_budget['run_id']!=s['prefix'] or not 0<=before_budget['used']<24:
        raise RuntimeError('local_chat_budget_unavailable')
    control=json.loads((stack.STATE/'provider/control.json').read_text())
    if control.get('chat')!='success':raise RuntimeError('local_chat_success_scenario_required')
    before=fingerprints(stack,s)
    pending=stack.STATE/'chat-pending.json'
    stack.private_write(pending,json.dumps({'run':s['prefix'],'operation':'single_synthetic_chat'}))
    profile=one(api(s,'/rest/v1/rpc/bootstrap_profile',{'p_clerk_user_id':OWNER,
        'p_email':'m1-local-chat@example.invalid'},'POST',True))
    workspace=one(api(s,'/rest/v1/rpc/bootstrap_workspace',{'p_owner_profile_id':profile['id'],
        'p_name':'M1 Local Chat Contract','p_slug':'m1-local-chat-contract'},'POST',True))
    existing=api(s,'/rest/v1/widget_sites?select=id,name,workspace_id,embed_key&domain=eq.'+SHOP,service=True)
    if existing:
        if len(existing)!=1 or existing[0]['name']!=SITE_NAME or existing[0]['workspace_id']!=workspace['id']:
            raise RuntimeError('local_chat_site_already_owned')
        site=existing[0]
    else:
        site=one(api(s,'/rest/v1/rpc/dashboard_create_widget_site',{'p_clerk_user_id':OWNER,
            'p_workspace_id':workspace['id'],'p_name':SITE_NAME},'POST',True))
    site_id=str(uuid.UUID(site['id']))
    settings={'security':{'allow_localhost':True},'messenger_ai':{'enabled':True,'escalationEnabled':False},
              'messenger_behaviour':{'availabilityMode':'always'},
              'messenger_notifications':{'emailOnHandoff':False,'recipients':[]},
              'messenger_contact_capture':{'enabled':False},'messenger_order_lookup':{'enabled':False}}
    rows=api(s,'/rest/v1/widget_sites?id=eq.'+site_id+'&workspace_id=eq.'+workspace['id'],
             {'status':'active','domain':SHOP,'settings_json':settings},'PATCH',True)
    if len(rows)!=1:raise RuntimeError('local_chat_publish_failed')
    bootstrap=api(s,'/api/messenger/bootstrap',{'key':site['embed_key'],'origin':ORIGIN,'locale':'en'},'POST')
    conversation=str(uuid.UUID(bootstrap['conversationId']))
    if bootstrap.get('aiEnabled') is not True:raise RuntimeError('local_chat_ai_not_enabled')
    payload={'key':site['embed_key'],'origin':ORIGIN,'locale':'en','anonymousId':bootstrap['anonymousId'],
             'conversationId':conversation,'text':'What sizes can I choose for this shirt?','clientKey':str(uuid.uuid4())}
    pending.write_text(json.dumps({'run':s['prefix'],'siteId':site_id,'payload':payload}))
    sent=api(s,'/api/messenger/send',payload,'POST')
    if sent.get('reply',{}).get('content')!=REPLY:raise RuntimeError('local_chat_synthetic_reply_missing')
    after_send=json.loads(budget_path.read_text())
    if after_send['used']!=before_budget['used']+1:raise RuntimeError('local_chat_provider_invocation_count_wrong')
    replay=api(s,'/api/messenger/send',payload,'POST')
    if replay.get('reply',{}).get('id')!=sent['reply']['id']:raise RuntimeError('local_chat_replay_reply_changed')
    if json.loads(budget_path.read_text())!=after_send:raise RuntimeError('local_chat_replay_invoked_provider')
    messages=api(s,'/rest/v1/widget_messages?select=role&conversation_id=eq.'+conversation,service=True)
    if sorted(message['role'] for message in messages)!=['assistant','user']:
        raise RuntimeError('local_chat_message_deduplication_failed')
    if fingerprints(stack,s)!=before:raise RuntimeError('local_chat_unrelated_state_changed')
    evidence={'run':s['prefix'],'kind':'local_http_contract','shopify_delivery':'SYNTHETIC_NOT_EXECUTED',
              'clerk_authentication':'NOT_USED_ANONYMOUS_STOREFRONT_CONTRACT',
              'bootstrap':'PASSED','reply':'PASSED_SYNTHETIC_WIRE','replay':'PASSED',
              'real_message_rows':2,'provider_invocations':1,'financial_job_installation_state':'UNCHANGED',
              'site_id_sha256':hashlib.sha256(site_id.encode()).hexdigest()}
    stack.private_write(stack.STATE/'chat-evidence.json',json.dumps(evidence,indent=2))
    print('PASS: actual local Chat bootstrap/send/replay; two message rows, one synthetic provider call, unrelated state unchanged.')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('BLOCKED:',str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__)
        raise SystemExit(1)
