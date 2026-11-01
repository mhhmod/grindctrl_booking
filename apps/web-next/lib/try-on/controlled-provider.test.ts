// @vitest-environment node
// Application wiring test: production service/entitlement/persistence/image
// code is real; Supabase API responses are simulated. This does NOT prove
// hosted ledger SQL, whose complete baseline must still be reviewed.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, rpc, upload } = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn(), upload: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
import { generateTryOn } from './service';
import type { VerifiedTryOnSession } from './storefront-context';

// Variable URL intentionally avoids introducing test tooling into the
// production build graph. The normal production Dockerfile excludes it.
const harnessUrl = pathToFileURL(resolve(process.cwd(), '../../testing/shopify/provider-harness.mjs')).href;
const { createProviderHarness, SYNTHETIC_PNG } = await import(/* @vite-ignore */ harnessUrl);
let dir: string;
let row: Record<string, unknown> | null;
let status: string;
let controlFile: string;
const externalFetch = vi.fn();

function authorization(): VerifiedTryOnSession {
  const now = Math.floor(Date.now()/1000);
  return { iss:'grindctrl-tryon',aud:'tryon-generation-api',purpose:'storefront',
    sessionId:'ts_abcdefghijklmnopqrstuvwx',shop:'synthetic.myshopify.com',productId:'premium-ringer-tee',
    variantId:'123',productGid:'gid://shopify/Product/99',variantGid:'gid://shopify/ProductVariant/123',
    canonicalGarmentUrl:'https://cdn.shopify.com/synthetic.png',garmentUrlDigest:'synthetic',nonce:'abcdefghijklmnopqrstuvwx',
    requestKey:'11111111-1111-4111-8111-111111111111',iat:now,exp:now+600,jti:'abcdefghijklmnop' };
}

beforeEach(() => {
  vi.resetAllMocks(); row=null; status='queued';
  vi.stubEnv('TRYON_MODE','live');
  vi.stubEnv('OPENROUTER_API_KEY','controlled-test-sentinel-not-a-provider-credential');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://abcdefghijklmnopqrst.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-only');
  dir=mkdtempSync(join(tmpdir(),'gc-credit-path-'));
  const stateFile=join(dir,'budget.json'); controlFile=join(dir,'control.json');
  writeFileSync(stateFile,JSON.stringify({run_id:'synthetic-run',used:0,events:[]}));
  writeFileSync(controlFile,JSON.stringify({image:'success',chat:'success'}));
  externalFetch.mockImplementation(async()=>new Response(Buffer.from(SYNTHETIC_PNG,'base64'),{headers:{'content-type':'image/png'}}));
  vi.stubGlobal('fetch',createProviderHarness({run_id:'synthetic-run',expires_at:new Date(Date.now()+60000).toISOString(),drain_until:new Date(Date.now()+120000).toISOString(),
    max_calls:24,max_concurrent:2,hosts:new Set(['cdn.shopify.com'])},{stateFile,controlFile,fetchImpl:externalFetch}));
  rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
    if(name==='reserve_tryon_credit') {
      const created=!row;
      if(!row) row={id:args.p_job_id,session_id:args.p_session_id,product_id:args.p_product_id,shop:args.p_shop_domain,
        request_key:args.p_request_key,created_at:new Date().toISOString(),result_storage_path:null,result_deleted_at:null};
      return {data:{job_id:row.id,created,job_status:status,recorded_model_key:'lite',job_created_at:row.created_at},error:null};
    }
    expect(name).toBe('finalize_tryon_job'); status=String(args.p_status);
    return {data:status,error:null};
  });
  upload.mockResolvedValue({error:null});
  createClient.mockReturnValue({rpc,storage:{from:()=>({upload})},from:(table:string)=>{
    let updates:Record<string,unknown>|undefined;
    const query={select:()=>query,eq:()=>query,is:()=>query,update:(data:Record<string,unknown>)=>{updates=data;return query;},
      maybeSingle:async()=>{
        if(table==='tryon_subscriptions')return {data:{plan_id:'synthetic-plan'},error:null};
        if(table==='tryon_plans')return {data:{model_key:'lite'},error:null};
        expect(table).toBe('tryon_jobs'); if(updates&&row)Object.assign(row,updates);
        return {data:row,error:null};
      }};
    return query;
  }});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();rmSync(dir,{recursive:true,force:true});});

describe('noncharging provider harness preserves the live credit/job code path',()=>{
  it('reserves, persists and finalizes a synthetic result; replay never calls the provider twice',async()=>{
    const auth=authorization();
    const result=await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    expect(result.status).toBe('completed');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenNthCalledWith(1,'reserve_tryon_credit',expect.objectContaining({p_shop_domain:auth.shop,p_request_key:auth.requestKey}));
    expect(rpc).toHaveBeenNthCalledWith(2,'finalize_tryon_job',expect.objectContaining({p_job_id:result.jobId,p_status:'completed',p_cost_usd:0}));
    expect(externalFetch).toHaveBeenCalledTimes(1); // Synthetic garment only; no provider transport.
    expect(externalFetch.mock.calls[0][0]).toBe(auth.canonicalGarmentUrl);
    expect((await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!)).jobId).toBe(result.jobId);
    expect(externalFetch).toHaveBeenCalledTimes(1); expect(upload).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.filter(([name])=>name==='finalize_tryon_job')).toHaveLength(1);
  });
  it('failure still reserves and invokes the existing failed-job finalizer/refund contract',async()=>{
    writeFileSync(controlFile,JSON.stringify({image:'failure',chat:'success'}));
    const auth=authorization();
    const result=await generateTryOn(auth,'upload',`data:image/png;base64,${SYNTHETIC_PNG}`,auth.canonicalGarmentUrl!);
    expect(result.status).toBe('failed'); expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenNthCalledWith(1,'reserve_tryon_credit',expect.objectContaining({p_shop_domain:auth.shop}));
    expect(rpc).toHaveBeenNthCalledWith(2,'finalize_tryon_job',expect.objectContaining({p_job_id:result.jobId,p_status:'failed',p_cost_usd:null}));
    expect(externalFetch).toHaveBeenCalledTimes(1);
  });
});
