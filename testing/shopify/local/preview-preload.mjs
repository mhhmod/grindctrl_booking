// LOCAL ONLY. The normal app Dockerfile never imports this entrypoint.
// No auth/RBAC/rate-limit bypass: missing Clerk/Redis denies protected work.
import { readFileSync } from 'node:fs';
import { createProviderHarness } from './provider-harness.mjs';
const c=JSON.parse(readFileSync('/run/local-preview/preview.json','utf8'));
if(c.kind!=='disposable-local-only'||c.source_sha!==process.env.SENTRY_RELEASE
  ||Date.now()/1000>=c.expires_at||!/^gc-m1-[a-f0-9]{8}$/.test(c.prefix)
  ||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://gateway:8000'
  ||process.env.CLERK_SECRET_KEY||process.env.UPSTASH_REDIS_REST_TOKEN
  ||Object.keys(process.env).some(k=>/^(OPENROUTER|GROQ|OPENAI|ANTHROPIC|SENTRY|NEXT_PUBLIC_SENTRY|NEXT_PUBLIC_POSTHOG)_/.test(k)&&k!=='SENTRY_RELEASE'&&process.env[k])){
  throw new Error('local_preview_isolation_required');
}
const wire=globalThis.fetch;
const provider=createProviderHarness({run_id:c.prefix,expires_at:new Date(c.expires_at*1000).toISOString(),
  drain_until:new Date((c.expires_at+900)*1000).toISOString(),max_calls:24,max_concurrent:2,hosts:new Set()},
  {stateFile:'/run/local-budget/budget.json',controlFile:'/run/local-budget/control.json',
    fetchImpl:()=>{throw new Error('local_preview_external_network_denied');}});
globalThis.fetch=(input,init)=>{
  const u=new URL(input instanceof Request?input.url:input);
  if(Date.now()/1000>c.expires_at+900)throw new Error('local_preview_drain_expired');
  if(u.origin==='http://gateway:8000'||u.origin==='http://localhost:3000'||u.origin==='http://127.0.0.1:3000'){
    return wire(input,{...init,redirect:'manual'});
  }
  return provider(input,init);
};
process.env.TRYON_MODE='live';
process.env.OPENROUTER_API_KEY='controlled-test-sentinel-not-a-provider-credential';
