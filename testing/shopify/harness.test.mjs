import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { validateManifest, validateEnvironment } from './config.mjs';
import { createProviderHarness, SYNTHETIC_PNG } from './provider-harness.mjs';

export function manifest(extra = {}) {
  return {environment:'controlled-test',synthetic_only:true,run_id:'synthetic-run-01',approval_ref:'synthetic-approval',
    expires_at:new Date(Date.now()+3600_000).toISOString(),drain_until:new Date(Date.now()+4200_000).toISOString(),project_ref:'abcdefghijklmnopqrst',
    preview_origin:'https://preview.example.org',shops:['synthetic.myshopify.com'],
    app_client_ids:['a'.repeat(32),'b'.repeat(32)],additional_hosts:['test.upstash.io'],max_calls:24,max_concurrent:2,...extra};
}
function fixture(t, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(),'gc-controlled-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const c = validateManifest(manifest(extra));
  const stateFile=join(dir,'budget.json'), controlFile=join(dir,'control.json');
  writeFileSync(stateFile,JSON.stringify({run_id:c.run_id,used:0,events:[]}));
  writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}));
  let sent=0;
  const options={stateFile,controlFile,fetchImpl:async()=>{sent++;return new Response('approved-test-endpoint');}};
  const fetch=createProviderHarness(c,options);
  return {c,options,fetch,stateFile,controlFile,sent:()=>sent};
}

test('blank manifests, production project references and duplicate app identities fail closed',()=>{
  assert.throws(()=>validateManifest({}),/invalid/);
  for(const project_ref of ['prsusuwxbzaekynonifl','egvdxshlbcqndrcnzcdn','qldgpkqpyfpqfdchozsp']) {
    assert.throws(()=>validateManifest(manifest({project_ref})),/invalid/);
  }
  for(const extra of [{preview_origin:'https://grindctrl.cloud'},{app_client_ids:['a'.repeat(32),'a'.repeat(32)]},
    {additional_hosts:['api.openai.com']},{additional_hosts:['*.supabase.co']},
    {additional_hosts:['127.0.0.1']},{max_calls:25},{max_concurrent:3},
    {expires_at:'2000-01-01'},{drain_until:'2000-01-01'},{drain_until:new Date(Date.now()+7200_000).toISOString()},
    {expires_at:new Date(Date.now()+25*3600_000).toISOString()}]) {
    assert.throws(()=>validateManifest(manifest(extra)));
  }
});
test('runtime rejects real provider keys, production auth, app mismatches and proxy bypass',()=>{
  const c=validateManifest(manifest());
  const env={GRINDCTRL_CONTROLLED_TEST:'1',TRYON_MODE:'live',NEXT_PUBLIC_APP_URL:c.preview_origin,
    NEXT_PUBLIC_SUPABASE_URL:`https://${c.project_ref}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',
    SHOPIFY_TOKEN_ENC_KEY:'synthetic-only',GRINDCTRL_CAPABILITY_SECRET:'synthetic-only',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_test_synthetic',CLERK_SECRET_KEY:'sk_test_synthetic',
    UPSTASH_REDIS_REST_URL:'https://test.upstash.io',UPSTASH_REDIS_REST_TOKEN:'synthetic-only',
    SHOPIFY_APPS:JSON.stringify(c.app_client_ids.map((clientId,i)=>({clientId,secret:`synthetic-${i}`}))),
    NODE_USE_ENV_PROXY:'1',HTTP_PROXY:'http://egress:3128',HTTPS_PROXY:'http://egress:3128',NO_PROXY:'localhost,127.0.0.1,::1'};
  assert.doesNotThrow(()=>validateEnvironment(c,env));
  for(const override of [{OPENROUTER_API_KEY:'should-never-leave-test'},{GROQ_API_KEY:'should-never-leave-test'},
    {CLERK_SECRET_KEY:'sk_live_forbidden'},{NEXT_PUBLIC_SUPABASE_URL:'https://prsusuwxbzaekynonifl.supabase.co'},
    {TRYON_MODE:'mock'},{HTTPS_PROXY:'http://elsewhere:8080'},{NO_PROXY:'*'},
    {SHOPIFY_API_KEY:'legacy-app'},{SHOPIFY_APPS:'[]'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'}]) {
    assert.throws(()=>validateEnvironment(c,{...env,...override}));
  }
});
test('image and chat use synthetic wire responses without forwarding requests or recording inputs',async t=>{
  const f=fixture(t);
  const image=await f.fetch('https://openrouter.ai/api/v1/images',{method:'POST',body:'private-photo-and-secret'});
  assert.equal((await image.json()).data[0].b64_json,SYNTHETIC_PNG);
  const chat=await f.fetch(new Request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',body:'private-customer'}));
  assert.match((await chat.json()).choices[0].message.content,/Synthetic/);
  assert.equal(f.sent(),0);
  const state=readFileSync(f.stateFile,'utf8');assert.doesNotMatch(state,/private|photo|secret|customer/);
  assert.equal(JSON.parse(state).used,2);
});
test('failure, corruption, missing state, stale locks and exhausted restart budgets never forward',async t=>{
  const f=fixture(t,{max_calls:1});
  writeFileSync(f.controlFile,JSON.stringify({image:'failure',chat:'failure'}));
  assert.equal((await f.fetch('https://openrouter.ai/api/v1/images',{method:'POST'})).status,422);
  const restarted=createProviderHarness(f.c,f.options);
  await assert.rejects(restarted('https://openrouter.ai/api/v1/images',{method:'POST'}),/budget_denied/);
  assert.equal(f.sent(),0);
  writeFileSync(f.stateFile,'corrupt');
  await assert.rejects(restarted('https://openrouter.ai/api/v1/images',{method:'POST'}));
  rmSync(f.stateFile);
  await assert.rejects(restarted('https://openrouter.ai/api/v1/images',{method:'POST'}));
  mkdirSync(`${f.stateFile}.lock`);
  await assert.rejects(restarted('https://openrouter.ai/api/v1/images',{method:'POST'}));
  assert.equal(f.sent(),0);
});
test('pause allows transitions but enforces concurrency and charges the durable invocation budget',async t=>{
  const f=fixture(t,{max_concurrent:1});
  writeFileSync(f.controlFile,JSON.stringify({image:'pause',chat:'success'}));
  const pending=f.fetch('https://openrouter.ai/api/v1/images',{method:'POST'});
  await delay(10);
  await assert.rejects(f.fetch('https://openrouter.ai/api/v1/images',{method:'POST'}),/concurrency_denied/);
  writeFileSync(f.controlFile,JSON.stringify({image:'success',chat:'success'}));
  assert.equal((await pending).status,200);
  assert.equal(JSON.parse(readFileSync(f.stateFile,'utf8')).used,1);
});
test('abort and expired runs stop without retry or network work',async t=>{
  const f=fixture(t);
  writeFileSync(f.controlFile,JSON.stringify({image:'pause',chat:'success'}));
  const controller=new AbortController();
  const pending=f.fetch('https://openrouter.ai/api/v1/images',{method:'POST',signal:controller.signal});
  const rejected=assert.rejects(pending);controller.abort();await rejected;
  f.c.expires_at='2000-01-01';
  await assert.rejects(f.fetch('https://openrouter.ai/api/v1/images',{method:'POST'}),/run_expired/);
  assert.equal(f.sent(),0);
});
test('provider cutoff preserves only approved dependency drain for settlement/refund',async t=>{
  const f=fixture(t); f.c.expires_at=new Date(Date.now()-1000).toISOString();
  await assert.rejects(f.fetch('https://openrouter.ai/api/v1/images',{method:'POST'}),/run_expired/);
  await f.fetch(`https://${f.c.project_ref}.supabase.co/rest/v1/rpc/finalize_tryon_job`,{method:'POST'});
  assert.equal(f.sent(),1);
  f.c.drain_until=new Date(Date.now()-1000).toISOString();
  await assert.rejects(f.fetch(`https://${f.c.project_ref}.supabase.co/rest/v1/rpc/finalize_tryon_job`,{method:'POST'}),/drain_expired/);
  assert.equal(f.sent(),1);
});
test('unknown providers, production databases, external redirects and metadata destinations fail closed',async t=>{
  const f=fixture(t);
  for(const url of ['https://openrouter.ai/api/v1/unknown','https://api.groq.com/openai/v1/chat/completions',
    'https://api.openai.com/v1/images','https://prsusuwxbzaekynonifl.supabase.co/rest/v1/tryon_jobs',
    'http://169.254.169.254/latest/meta-data','https://evil.example','https://test.upstash.io:444',
    'https://user:password@test.upstash.io','http://localhost:8080']) await assert.rejects(f.fetch(url));
  assert.equal(f.sent(),0);
  let options;
  const fetch=createProviderHarness(f.c,{...f.options,fetchImpl:async(_url,init)=>{options=init;return new Response('safe');}});
  await fetch(`https://${f.c.project_ref}.supabase.co/rest/v1/tryon_jobs`,{redirect:'follow'});
  assert.equal(options.redirect,'error');
});
