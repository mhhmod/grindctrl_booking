// Explicit opt-in: real Docker PostgreSQL + PostgREST + Storage API.
// Shopify/AI responses and shopper claims are synthetic fixtures, never live E2E.
// No Supabase client/RPC/storage mocks and no replacement financial functions.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { acquireShopToken, getShopToken, setShopTokenClientForTests, verifyShopifyUninstall, hasShopOrderAccess } from '@/lib/shopify/tokens';
import { recordInstallationEvent } from '@/lib/shopify/installation-events';
import { generateTryOn, forgetJob } from '@/lib/try-on/service';
import { loadAuthorizedDurableTryOnJob } from '@/lib/try-on/persistence';
import type { VerifiedTryOnSession } from '@/lib/try-on/storefront-context';

const statePath = process.env.M1_LOCAL_STATE;
if (!statePath) throw new Error('explicit disposable local state required');
const state = JSON.parse(readFileSync(statePath,'utf8'));
if (state.kind !== 'disposable-local-only' || state.url !== 'http://127.0.0.1:54380'
  || Date.now()/1000 >= state.expires_at) throw new Error('invalid/expired local target');
const dir = dirname(statePath);
const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const X = 'm1-local-x.myshopify.com', Y = 'm1-local-y.myshopify.com';
const db = createClient(state.url,state.service_key,{auth:{persistSession:false}});
const anon = createClient(state.url,state.anon_key,{auth:{persistSession:false}});
const transport = globalThis.fetch;
let shopifyMode: 'active'|'revoked'|'refresh'|'invalid-refresh'|'throttled' = 'active';
let refreshCalls = 0;
const harnessUrl = pathToFileURL(resolve(process.cwd(),'../../testing/shopify/provider-harness.mjs')).href;
const { createProviderHarness, SYNTHETIC_PNG } = await import(/* @vite-ignore */ harnessUrl);
const providerDir=resolve(dir,'provider');
const controlFile = resolve(providerDir,'control.json'), budgetFile = resolve(providerDir,'budget.json');
let installedFetch: typeof fetch;

async function row(app: string, shop=X) {
  const {data,error} = await db.from('shopify_installations').select('*').eq('shop_domain',shop).eq('app_client_id',app).single();
  if(error) throw new Error('local installation read failed');
  return data;
}
async function rpc(name:string,args:Record<string,unknown>) {
  const result = await db.rpc(name,args);
  if(result.error) throw new Error('local RPC failed: '+name+': '+result.error.message);
  return result.data;
}
async function authorize(app:string,shop=X) {
  return acquireShopToken({shopDomain:shop,appClientId:app,force:true,
    exchange:async()=>({access_token:'synthetic-access-'+app+'-'+randomUUID(),scope:'read_products,read_orders',
      expires_in:3600,refresh_token:'synthetic-refresh-'+app,refresh_token_expires_in:86400})});
}
async function receipt(app:string, topic='app/uninstalled', id=randomUUID(), triggeredAt:string|null=null) {
  return recordInstallationEvent({appClientId:app,shopDomain:X,topic,webhookId:id,payload:{id:123},triggeredAt});
}
function authorization(shop=X): VerifiedTryOnSession {
  const now = Math.floor(Date.now()/1000);
  return {iss:'grindctrl-tryon',aud:'tryon-generation-api',purpose:'storefront',
    sessionId:'ts_'+randomBytes(16).toString('hex'),shop,productId:'premium-ringer-tee',
    variantId:'123',productGid:'gid://shopify/Product/99',variantGid:'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl:'https://cdn.shopify.com/m1-local-synthetic.png',garmentUrlDigest:'synthetic',
    nonce:randomBytes(16).toString('hex'),requestKey:randomUUID(),iat:now,exp:now+600,jti:randomBytes(16).toString('hex')};
}
async function balance(shop=X) {
  const {data,error}=await db.from('tryon_subscriptions').select('id').eq('shop_domain',shop).single();
  if(error)throw error;
  const result=await rpc('tryon_credit_balance',{p_subscription_id:data.id});
  return Number(result[0].plan_remaining)+Number(result[0].top_up_remaining);
}
async function ledger(job:string) {
  const {data,error}=await db.from('tryon_credit_ledger').select('entry_type,amount').eq('job_id',job);
  if(error)throw error;
  return data;
}
beforeAll(async()=>{
  if (['OPENROUTER_API_KEY','GROQ_API_KEY','CLERK_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'].some(k=>process.env[k])) {
    throw new Error('local integration tests require a clean environment, no external credentials');
  }
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',state.url);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY',state.service_key);
  vi.stubEnv('SHOPIFY_TOKEN_ENC_KEY',randomBytes(32).toString('base64'));
  vi.stubEnv('SHOPIFY_APPS',JSON.stringify([
    {clientId:A,secret:'synthetic-local-a-secret',distribution:'custom',tokenMode:'expiring'},
    {clientId:B,secret:'synthetic-local-b-secret',distribution:'public',tokenMode:'expiring'}]));
  vi.stubEnv('TRYON_MODE','live');
  vi.stubEnv('OPENROUTER_API_KEY','controlled-test-sentinel-not-a-provider-credential');
  // Refuse budget reuse/reset. A second run needs a fresh disposable target.
  mkdirSync(providerDir,{mode:0o700});
  writeFileSync(budgetFile,JSON.stringify({run_id:state.prefix,used:0,events:[]}),{flag:'wx',mode:0o600});
  writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}),{flag:'wx',mode:0o600});
  const providerFetch = createProviderHarness({run_id:state.prefix,
    expires_at:new Date(state.expires_at*1000).toISOString(),drain_until:new Date((state.expires_at+900)*1000).toISOString(),
    max_calls:24,max_concurrent:2,hosts:new Set()}, {stateFile:budgetFile,controlFile,
      fetchImpl:async()=>{throw new Error('external network forbidden in local integration test');}});
  installedFetch=async(input,init)=>{
    const url = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.origin===state.url) return transport(input,init); // Actual local REST/storage, not simulated.
    if(url.href==='https://cdn.shopify.com/m1-local-synthetic.png')return new Response(Buffer.from(SYNTHETIC_PNG,'base64'),{headers:{'content-type':'image/png'}});
    if(url.origin===`https://${X}` && url.pathname==='/admin/oauth/access_token'){
      refreshCalls++;
      if(shopifyMode==='invalid-refresh')return new Response('{}',{status:401});
      if(shopifyMode==='throttled')return new Response('{}',{status:429,headers:{'retry-after':'60'}});
      await new Promise(r=>setTimeout(r,75));
      return Response.json({access_token:'synthetic-rotated',scope:'read_products,read_orders',expires_in:3600,
        refresh_token:'synthetic-rotated-refresh',refresh_token_expires_in:86400});
    }
    if(url.origin===`https://${X}` && url.pathname==='/admin/api/2026-07/graphql.json'){
      return shopifyMode==='revoked'?new Response('{}',{status:401}):Response.json({data:{currentAppInstallation:{id:'gid://shopify/AppInstallation/123'}}});
    }
    return providerFetch(input,init);
  };
  vi.stubGlobal('fetch',installedFetch);
  setShopTokenClientForTests(null);
});
afterAll(()=>{setShopTokenClientForTests(null);vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('real local database/storage integration (synthetic Shopify and AI)',()=>{
  it('starts with exactly 12 real ledger credits per synthetic store and no test-look bypass',async()=>{
    expect(await balance(X)).toBe(12);expect(await balance(Y)).toBe(12);
    const {data,error}=await db.from('tryon_credit_ledger').select('entry_type,amount');
    expect(error).toBeNull();expect(data?.filter(x=>x.entry_type==='grant').map(x=>x.amount)).toEqual([12,12]);
  });
  it('stores encrypted A/B credentials independently for two stores via actual RPCs',async()=>{
    const a=await authorize(A),b=await authorize(B),y=await authorize(A,Y);
    expect(a.installationId).not.toBe(b.installationId);expect(a.installationId).not.toBe(y.installationId);
    expect((await getShopToken(X,A))?.accessToken).toBe(a.accessToken);
    expect((await getShopToken(X,B))?.accessToken).toBe(b.accessToken);
    expect(await getShopToken(X)).toBeNull();expect(await getShopToken(Y,B)).toBeNull();
    expect((await row(A)).access_token_ciphertext).not.toContain('synthetic-access');
  });
  it('serializes competing refreshes using real concurrent DB sessions, rotates once, preserves B',async()=>{
    const b=await row(B);const a=await row(A);
    const update=await db.from('shopify_installations').update({access_expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',a.id);
    expect(update.error).toBeNull();shopifyMode='refresh';refreshCalls=0;
    const results=await Promise.all([getShopToken(X,A),getShopToken(X,A),getShopToken(X,A)]);
    expect(refreshCalls).toBe(1);expect(results.some(x=>x?.accessToken==='synthetic-rotated')).toBe(true);
    expect((await row(A)).credential_version).toBe(a.credential_version+1);
    expect((await row(B)).access_token_ciphertext).toBe(b.access_token_ciphertext);
  });
  it('records forged-time/replayed lifecycle bodies without retiring the active replacement',async()=>{
    const before=await row(A);shopifyMode='active';
    const id=randomUUID();const e=await receipt(A,'app/uninstalled',id,new Date(Date.now()+86400000).toISOString());
    expect(e.status).toBe('manual_required');await verifyShopifyUninstall(X,A,e.id);
    expect((await receipt(A,'app/uninstalled',id)).duplicate).toBe(true);
    expect((await row(A)).credential_version).toBe(before.credential_version);
    expect((await row(B)).status).toBe('active');
  });
  it('preserves refresh credentials on 429 then leaves expired/revoked uninstall unresolved',async()=>{
    const a=await row(A),b=await row(B);
    await db.from('shopify_installations').update({access_expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',a.id);
    shopifyMode='throttled';expect(await getShopToken(X,A)).toBeNull();
    const deferred=await row(A);expect(deferred.refresh_token_ciphertext).toBe(a.refresh_token_ciphertext);
    expect(deferred.refresh_retry_after).toBeTruthy();
    // Fixture-only time manipulation, never claimed as an actual Shopify expiry.
    await db.from('shopify_installations').update({refresh_retry_after:null}).eq('id',a.id);
    shopifyMode='invalid-refresh';const e=await receipt(A);
    await expect(verifyShopifyUninstall(X,A,e.id)).rejects.toThrow();
    expect((await row(A)).status).toBe('reauthorization_required');
    const {data}=await db.from('shopify_installation_events').select('status').eq('id',e.id).single();
    expect(data?.status).toBe('manual_required');expect((await row(B)).credential_version).toBe(b.credential_version);
    await authorize(A);
  });
  it('completes live-path generation with actual ledger debit, private object and durable replay',async()=>{
    const auth=authorization(),before=await balance();
    const result=await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    expect(result.status).toBe('completed');expect(await balance()).toBe(before-1);
    expect(await ledger(result.jobId)).toEqual([{entry_type:'debit',amount:-1}]);
    forgetJob(result.jobId); // Process-cache loss; recovery must read actual database/storage.
    const replay=await loadAuthorizedDurableTryOnJob(auth,result.jobId);
    expect(replay?.status).toBe('completed');expect(replay?.resultImageUrl?.startsWith(state.url+'/storage/v1/object/sign/')).toBe(true);
    const image=await installedFetch(replay!.resultImageUrl!);expect(image.ok).toBe(true);
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(await loadAuthorizedDurableTryOnJob({...auth,shop:Y},result.jobId)).toBeNull();
    expect(await loadAuthorizedDurableTryOnJob({...auth,sessionId:'ts_foreign_session_abcdefghijkl'},result.jobId)).toBeNull();
    expect(JSON.parse(readFileSync(budgetFile,'utf8')).used).toBe(1);
    writeFileSync(resolve(dir,'recovery.json'),JSON.stringify({authorization:auth,jobId:result.jobId}),{flag:'wx',mode:0o600});
    await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    expect(JSON.parse(readFileSync(budgetFile,'utf8')).used).toBe(1);expect(await balance()).toBe(before-1);
  });
  it('refunds a failed provider fixture exactly once using real finalization SQL',async()=>{
    writeFileSync(controlFile,JSON.stringify({image:'failure',chat:'success'}));
    const auth=authorization(),before=await balance();
    const result=await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    expect(result.status).toBe('failed');expect(await balance()).toBe(before);
    await rpc('refund_tryon_credit',{p_job_id:result.jobId});
    expect((await ledger(result.jobId)).filter(x=>x.entry_type==='refund')).toHaveLength(1);
    expect(await balance()).toBe(before);
    writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}));
  });
  it('settles an in-flight reservation after A revocation without disabling B or duplicating credit',async()=>{
    writeFileSync(controlFile,JSON.stringify({image:'pause',chat:'success'}));
    const auth=authorization(),before=await balance(),b=await row(B);
    const pending=generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    let reserved=false;
    for(let i=0;i<30;i++){
      const {data}=await db.from('tryon_jobs').select('id,status,billable').eq('request_key',auth.requestKey);
      if(data?.[0]?.status==='processing'&&data[0].billable){reserved=true;break;}
      await new Promise(r=>setTimeout(r,20));
    }
    expect(reserved).toBe(true);shopifyMode='revoked';const e=await receipt(A);
    await verifyShopifyUninstall(X,A,e.id);
    writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}));
    const result=await pending;expect(result.status).toBe('completed');
    expect((await row(A)).status).toBe('uninstalled');expect((await row(B)).credential_version).toBe(b.credential_version);
    expect(await balance()).toBe(before-1);expect((await ledger(result.jobId)).filter(x=>x.entry_type==='debit')).toHaveLength(1);
    const {data}=await db.from('tryon_shops').select('status').eq('shop_domain',X).single();expect(data?.status).toBe('installed');
    await authorize(A);shopifyMode='active';writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}));
  });
  it('records all privacy topics as unresolved, retains B/shared ledger and exposes an actionable queue',async()=>{
    const before=await balance();
    for(const topic of ['customers/data_request','customers/redact','shop/redact']){
      expect((await receipt(A,topic)).status).toBe('manual_required');
    }
    const {data,error}=await db.from('shopify_privacy_work_queue').select('reviewed_status,due_at');
    expect(error).toBeNull();expect(data).toHaveLength(3);expect(data?.every(x=>x.reviewed_status==='manual_required'&&x.due_at)).toBe(true);
    expect((await row(B)).status).toBe('active');expect(await balance()).toBe(before);
  });
  it('denies anonymous credential/ledger access and unauthorized RPC/storage operations',async()=>{
    for(const table of ['shopify_installations','shopify_installation_events','tryon_credit_ledger','tryon_jobs']){
      expect((await anon.from(table).select('*')).error).toBeTruthy();
    }
    expect((await anon.rpc('shopify_credential_operation',{p_shop:X,p_app:A,p_operation:'acquire',p_lease:randomUUID()})).error).toBeTruthy();
    expect((await anon.storage.from('tryon-results').upload('forbidden.png',Buffer.from(SYNTHETIC_PNG,'base64'),{contentType:'image/png'})).error).toBeTruthy();
    expect(await getShopToken(Y,B)).toBeNull();
  });
  it('enforces missing order scope using the installed app identity',async()=>{
    expect(await hasShopOrderAccess(X,A)).toBe(true);
    await db.from('shopify_installations').update({scopes:'read_products'}).eq('shop_domain',X).eq('app_client_id',A);
    expect(await hasShopOrderAccess(X,A)).toBe(false);expect(await hasShopOrderAccess(X,B)).toBe(true);
  });
  it('refuses overspending under two-session contention and refunds each reservation once',async()=>{
    const before=await balance();const jobs:string[]=[];
    for(let i=0;i<7;i++){
      const results=await Promise.all([0,1].map(async()=>{
        const job='tryon_'+randomUUID();
        const result=await db.rpc('reserve_tryon_credit',{p_shop_domain:X,p_job_id:job,p_request_key:randomUUID(),
          p_session_id:'ts_'+randomBytes(16).toString('hex'),p_product_id:'synthetic',p_model_key:'lite'});
        if(result.error){expect(result.error.message).toContain('no credits remain');return;}
        jobs.push(job);
      }));void results;
    }
    expect(jobs).toHaveLength(before);expect(await balance()).toBe(0);
    for(const job of jobs){await rpc('refund_tryon_credit',{p_job_id:job});await rpc('refund_tryon_credit',{p_job_id:job});}
    expect(await balance()).toBe(before);
  });
});
