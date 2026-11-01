// A NEW test process after actual Docker DB/REST/Storage restart. No AI mock is
// allowed here: recovery must use the saved private object, without a provider.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { generateTryOn } from '@/lib/try-on/service';
const file=process.env.M1_LOCAL_STATE;
if(!file)throw new Error('explicit local target required');
const s=JSON.parse(readFileSync(file,'utf8'));
if(s.kind!=='disposable-local-only'||s.url!=='http://127.0.0.1:54380'||Date.now()/1000>=s.expires_at)throw new Error('invalid local target');
const recovered=JSON.parse(readFileSync(join(dirname(file),'recovery.json'),'utf8'));
const budgetFile=join(dirname(file),'provider/budget.json');
const budget=JSON.parse(readFileSync(budgetFile,'utf8')).used;
const db=createClient(s.url,s.service_key,{auth:{persistSession:false}});
const transport=globalThis.fetch;
let forbidden=0;
beforeAll(()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',s.url);vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY',s.service_key);
  vi.stubEnv('TRYON_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','controlled-test-sentinel-not-a-provider-credential');
  vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
    const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(u.origin!==s.url){forbidden++;throw new Error('no external/provider calls allowed during recovery');}
    return transport(input,init);
  });
});
afterAll(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('recovers in a fresh app process after database/storage restart, with no new debit or provider invocation',async()=>{
  const before=await db.from('tryon_credit_ledger').select('id');expect(before.error).toBeNull();
  const job=await generateTryOn(recovered.authorization,'upload','intentionally-not-a-photo','intentionally-not-a-garment');
  expect(job.jobId).toBe(recovered.jobId);expect(job.status).toBe('completed');
  expect(job.resultImageUrl?.startsWith(s.url+'/storage/v1/object/sign/')).toBe(true);
  const image=await fetch(job.resultImageUrl!);expect(image.ok).toBe(true);
  expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
  expect((await db.from('tryon_credit_ledger').select('id')).data).toEqual(before.data);
  expect(JSON.parse(readFileSync(budgetFile,'utf8')).used).toBe(budget);
  expect(forbidden).toBe(0);
});
