#!/usr/bin/env python3
"""Apply tracked dashboard/Chat SQL to a separate disposable local check DB.

No URL/credential/target argument is accepted. The existing synthetic local
database is cloned logically; its ledger, jobs and budget are never mutated.
This verifies checked-in delta ordering, not Production schema parity or Clerk
authentication. Missing base ownership DDL is deliberately not guessed.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
DATABASE='m1_foundation_check'
FILES=(
 'supabase/clerk_profiles_workspaces_widget_sites.sql',
 'supabase/widget_setup_extensions.sql',
 # Creates the obsolete submit_widget_lead signature explicitly revoked by
 # widget_production_foundation. Function bodies are PL/pgSQL, so later column
 # additions are resolved when called, after the complete chain is installed.
 'supabase/clerk_bootstrap_functions.sql',
 'supabase/dashboard_rpc_functions.sql',
 'supabase/widget_production_foundation.sql',
 'supabase/fix_workspace_members_rls_recursion.sql',
 'supabase/fix_workspace_members_rls_commands_split.sql',
 'supabase/dashboard_install_verification_rpc.sql',
 'supabase/dashboard_widget_events_analytics_rpc.sql',
 'supabase/messenger_foundation.sql',
 'supabase/widget_dashboard_grants_lockdown.sql',
 'supabase/bootstrap_profile_placeholder_guard.sql',
 'supabase/messenger_support_desk.sql',
 'supabase/messenger_handoff_notifications.sql',
 'supabase/shopify_tryon_foundation.sql',
 'supabase/shopify_unified_app.sql',
 'supabase/messenger_questions.sql',
 'supabase/20260912_messenger_canned_replies.sql',
 'supabase/20260912_messenger_audit_store_disconnected.sql',
 'supabase/20260912_messenger_audit_conversation_assigned.sql',
 'supabase/20260912_messenger_audit_config_reverted.sql',
 'supabase/20261016_store_flags.sql',
 'supabase/20261017_store_flags_screens.sql',
 'supabase/workspace_invites.sql',
 'supabase/20260910_tryon_shop_links.sql',
)

def runtime():
    spec=importlib.util.spec_from_file_location('local_stack',HERE/'stack.py')
    stack=importlib.util.module_from_spec(spec);spec.loader.exec_module(stack)
    s=stack.state()
    if not re.fullmatch(r'gc-m1-[a-f0-9]{8}',s['prefix']):raise RuntimeError('local_prefix_invalid')
    container=s['prefix']+'-db'
    label=stack.docker('inspect','--format','{{index .Config.Labels "io.grindctrl.disposable"}}',container)
    if label!='m1-local':raise RuntimeError('local_database_label_required')
    return stack,s,container

def execute(stack,container,sql,database=DATABASE):
    if database not in ('m1_local',DATABASE):raise RuntimeError('disposable_database_only')
    return stack.docker('exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1',
                       '-U','postgres','-d',database,data=sql)

def index_regressions(stack,container):
    migration=(ROOT/'supabase/shopify_tryon_foundation.sql').read_text()
    # Fresh creation was exercised by the manifest above, with its genuine
    # composite FK referencing the explicit unique index. Reapply unchanged.
    execute(stack,container,migration)
    # Rename the correctly referenced index, then give its old name to an
    # incompatible index. A failed migration must reject it, not repair or
    # silently accept it. Everything is in an aborted outer transaction.
    fixture="""begin;
      alter index public.idx_widget_sites_id_workspace rename to m1_fixture_correct_index;
      create index idx_widget_sites_id_workspace on public.widget_sites(workspace_id);
    """
    env=os.environ.copy()
    for key in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'):
        env.pop(key,None)
    result=subprocess.run(stack.DOCKER+['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1',
      '-U','postgres','-d',DATABASE],input=fixture+migration,text=True,capture_output=True,env=env)
    if result.returncode==0 or 'incompatible public.idx_widget_sites_id_workspace index' not in result.stderr:
        raise RuntimeError('tampered_index_guard_failed')
    # The psql connection rolled the failed transaction back. The exact prior
    # tables, foreign keys, index ownership and schema markers must still pass.
    execute(stack,container,migration)

def main():
    stack,s,container=runtime()
    exists=stack.docker('exec',container,'psql','-X','-t','-A','-U','postgres','-d','m1_local',
      '-c',"select count(*) from pg_database where datname='m1_foundation_check';")=='1'
    if not exists:
        dump=stack.docker('exec',container,'pg_dump','-U','postgres','-d','m1_local','--no-owner')
        stack.docker('exec',container,'createdb','-U','postgres',DATABASE)
        execute(stack,container,dump)
        execute(stack,container,"create schema m1_test_control; create table m1_test_control.applied(path text primary key,sha256 text not null);")
    elif execute(stack,container,"select to_regclass('m1_test_control.applied') is not null;")!='t':
        raise RuntimeError('existing_database_provenance_unverified')
    applied=apply_chain(stack,container)
    index_regressions(stack,container)
    execute(stack,container,(HERE/'foundations-check.sql').read_text())
    fingerprints="""select jsonb_build_object(
      'ledger', (select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by id),'')) from public.tryon_credit_ledger t),
      'jobs', (select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by id),'')) from public.tryon_jobs t),
      'subscriptions', (select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by id),'')) from public.tryon_subscriptions t));"""
    if execute(stack,container,fingerprints)!=execute(stack,container,fingerprints,'m1_local'):
        raise RuntimeError('synthetic_financial_copy_changed')
    # Evidence records no data, embed key, raw SQL, credentials or server errors.
    evidence={'database':DATABASE,'source':'tracked SQL plus prior local contract prerequisites',
      'production_parity':'UNVERIFIED','clerk_authentication':'UNVERIFIED','sql_checks':'PASSED',
      'index_checks':['fresh_creation','reapply_with_real_foreign_keys','tampered_index_rejected','rollback_preserved'],
      'financial_data_fingerprints':'MATCH_ORIGINAL_LOCAL_TARGET',
      'missing_source_ddl':['tryon_shops.owner_clerk_user_id'],'deltas':applied,
      'runner_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'contract_sha256':hashlib.sha256((HERE/'foundations-contract.sql').read_bytes()).hexdigest()}
    digest=hashlib.sha256(json.dumps(evidence,sort_keys=True).encode()).hexdigest()[:12]
    path=stack.STATE/('foundation-evidence-'+digest+'.json')
    if not path.exists():stack.private_write(path,json.dumps(evidence,indent=2))
    print('PASS: local dashboard/Chat foundations and service-only SQL contracts; original target unchanged.')

def apply_chain(stack,container,database=DATABASE):
    """Parent may explicitly reuse this source chain for the reviewed local target.

    This function is never invoked automatically against m1_local by this CLI.
    It takes no URL and execute() rejects every other database name.
    """
    execute(stack,container,'create schema if not exists m1_test_control; create table if not exists m1_test_control.applied(path text primary key,sha256 text not null);',database)
    execute(stack,container,(HERE/'foundations-contract.sql').read_text(),database)
    applied=[]
    for path in FILES:
        data=(ROOT/path).read_bytes();sha=hashlib.sha256(data).hexdigest()
        old=execute(stack,container,"select sha256 from m1_test_control.applied where path='"+path+"';",database)
        if old:
            if old!=sha:raise RuntimeError('source_delta_changed:'+path)
        else:
            try:execute(stack,container,data.decode(),database)
            except RuntimeError:raise RuntimeError('source_delta_failed:'+path) from None
            execute(stack,container,"insert into m1_test_control.applied values('"+path+"','"+sha+"');",database)
        applied.append({'path':path,'sha256':sha})
    return applied

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('BLOCKED:',str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__)
        raise SystemExit(1)
