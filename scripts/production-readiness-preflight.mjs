// Read-only checks. No generation, billing mutation, customer row contents,
// credentials or arbitrary response bodies are printed. Run with Node >=22:
// node scripts/production-readiness-preflight.mjs [local-env-file]
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

loadEnvFile(resolve(process.argv[2] ?? 'apps/web-next/.env.local'));
const report = { observedAt: new Date().toISOString(), checks: [] };
const add = (name, result) => report.checks.push({ name, ...result });
async function check(name, callback) {
  try { await callback(); } catch (error) { add(name, { ok: false, failure: error?.name ?? 'Error' }); }
}
const request = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000), redirect: 'error' });

await check('production_release', async () => {
  const response = await request('https://grindctrl.cloud/api/health');
  const data = response.ok ? await response.json() : null;
  add('production_release', { ok: response.ok, httpStatus: response.status,
    release: typeof data?.release === 'string' && /^[a-f0-9]{7,40}$/.test(data.release) ? data.release : null });
});
await check('openrouter_account', async () => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return add('openrouter_account', { ok: false, configured: false });
  const response = await request('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } });
  const data = response.ok ? (await response.json()).data : null;
  add('openrouter_account', { ok: response.ok, httpStatus: response.status,
    configured: true, hasExplicitKeyBudget: typeof data?.limit === 'number',
    keyBudgetRemainingPositive: typeof data?.limit_remaining === 'number' ? data.limit_remaining > 0 : null });
});
await check('image_model_catalogue', async () => {
  const model = process.env.TRYON_MODEL || 'google/gemini-3.1-flash-image';
  const response = await request('https://openrouter.ai/api/v1/images/models');
  const data = response.ok ? await response.json() : null;
  const item = Array.isArray(data?.data) ? data.data.find(item => item.id === model) : null;
  add('image_model_catalogue', { ok: response.ok && Boolean(item), httpStatus: response.status,
    configuredModel: model, acceptsImage: item?.architecture?.input_modalities?.includes('image') ?? null,
    returnsImage: item?.architecture?.output_modalities?.includes('image') ?? null,
    note: 'Catalogue presence does not prove generation quality, funding or reference-image compatibility.' });
});
await check('groq_models', async () => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return add('groq_models', { ok: false, configured: false });
  const response = await request('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const data = response.ok ? await response.json() : null;
  const models = ['openai/gpt-oss-120b', 'whisper-large-v3-turbo', 'canopylabs/orpheus-v1-english', 'canopylabs/orpheus-arabic-saudi'];
  add('groq_models', { ok: response.ok, httpStatus: response.status,
    models: models.map(id => ({ id, available: Array.isArray(data?.data) && data.data.some(item => item.id === id) })) });
});
await check('configured_supabase_read_access', async () => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return add('configured_supabase_read_access', { ok: false, configured: false });
  const url = new URL(base);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    return add('configured_supabase_read_access', { ok: false, failure: 'Unexpected Supabase host' });
  }
  const response = await request(`${url.origin}/rest/v1/tryon_jobs?select=id,cost_usd&limit=0`, {
    method: 'HEAD', headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  add('configured_supabase_read_access', { ok: response.ok, httpStatus: response.status,
    configuredProject: url.hostname.split('.')[0], note: 'Local configuration only; deployed DB identity, RLS, backups and privacy are separate gates.' });
});
add('shopify_local_auth_config', { apiKeyPresent: Boolean(process.env.SHOPIFY_API_KEY),
  secretPresent: Boolean(process.env.SHOPIFY_API_SECRET), note: 'No Shopify credentials are requested or printed by this script.' });
console.log(JSON.stringify(report, null, 2));
if (report.checks.some(check => check.ok === false)) process.exitCode = 1;
