import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

export const EXCLUDED_PROJECTS = ['prsusuwxbzaekynonifl', 'egvdxshlbcqndrcnzcdn', 'qldgpkqpyfpqfdchozsp'];
const forbidden = ['grindctrl.cloud', 'openrouter.ai', 'groq.com', 'openai.com', 'anthropic.com',
  'replicate.com', 'replicate.delivery', 'fal.ai', 'fal.run', 'workers.ai', 'api.cloudflare.com',
  'stripe.com', 'paypal.com', 'n8n.srv1141109.hstgr.cloud'];
export function forbiddenHost(host) {
  return forbidden.some(x => host === x || host.endsWith(`.${x}`)) ||
    EXCLUDED_PROJECTS.some(x => host === `${x}.supabase.co` || host.endsWith(`.${x}.supabase.co`));
}
export function validHost(host) {
  return typeof host === 'string' && host === host.toLowerCase() && host.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(host) && host.includes('.') &&
    !host.includes('..') && !isIP(host) && !forbiddenHost(host);
}

export function validateManifest(c, now = Date.now()) {
  if (!c || c.environment !== 'controlled-test' || c.synthetic_only !== true ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(c.run_id ?? '') ||
    typeof c.approval_ref !== 'string' || !c.approval_ref.trim() ||
    !/^[a-f0-9]{40}$/.test(c.source_release ?? '') || !/^[a-f0-9]{40}$/.test(c.harness_revision ?? '') ||
    !/^[a-z0-9]{20}$/.test(c.project_ref ?? '') || EXCLUDED_PROJECTS.includes(c.project_ref) ||
    !Array.isArray(c.shops) || c.shops.length < 1 || c.shops.length > 2 ||
    c.shops.some(s => !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) ||
    !Array.isArray(c.app_client_ids) || c.app_client_ids.length !== 2 ||
    new Set(c.app_client_ids).size !== 2 || c.app_client_ids.some(x => !/^[a-f0-9]{32}$/.test(x)) ||
    !Array.isArray(c.additional_hosts) || c.additional_hosts.some(x => !validHost(x)) ||
    !Number.isInteger(c.max_calls) || c.max_calls < 1 || c.max_calls > 24 ||
    !Number.isInteger(c.max_concurrent) || c.max_concurrent < 1 || c.max_concurrent > 2 ||
    !Number.isFinite(Date.parse(c.expires_at)) ||
    !Number.isFinite(Date.parse(c.drain_until)) || Date.parse(c.drain_until) <= now ||
    Date.parse(c.drain_until) < Date.parse(c.expires_at) ||
    Date.parse(c.drain_until) > Date.parse(c.expires_at) + 15 * 60_000 ||
    Date.parse(c.expires_at) > now + 24 * 3600_000) throw new Error('controlled_manifest_invalid');
  const origin = new URL(c.preview_origin);
  const previewHost = validHost(origin.hostname) || origin.hostname === 'shopify-m1-dev.grindctrl.cloud';
  if (origin.protocol !== 'https:' || origin.origin !== c.preview_origin || !previewHost) {
    throw new Error('controlled_origin_invalid');
  }
  return { ...c, hosts: new Set([`${c.project_ref}.supabase.co`, ...c.shops,
    'cdn.shopify.com', 'cdn.shopifycloud.com', ...c.additional_hosts]) };
}

export function readManifest(file) { return validateManifest(JSON.parse(readFileSync(file, 'utf8'))); }

export function validateEnvironment(c, env) {
  if (env.GRINDCTRL_CONTROLLED_TEST !== '1' || env.TRYON_MODE !== 'live' ||
    env.SENTRY_RELEASE !== c.source_release || env.GRINDCTRL_HARNESS_REVISION !== c.harness_revision ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${c.project_ref}.supabase.co` ||
    env.NEXT_PUBLIC_APP_URL !== c.preview_origin || !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.SHOPIFY_TOKEN_ENC_KEY || !env.GRINDCTRL_CAPABILITY_SECRET ||
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') ||
    !env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
    !env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN ||
    env.NODE_USE_ENV_PROXY !== '1' || env.HTTPS_PROXY !== 'http://egress:3128' ||
    env.HTTP_PROXY !== 'http://egress:3128' || env.NO_PROXY !== 'localhost,127.0.0.1,::1') {
    throw new Error('controlled_environment_invalid');
  }
  let redis;
  try { redis = new URL(env.UPSTASH_REDIS_REST_URL); } catch { throw new Error('controlled_redis_invalid'); }
  if (redis.protocol !== 'https:' || !c.hosts.has(redis.hostname) || redis.port || redis.username || redis.password) {
    throw new Error('controlled_redis_invalid');
  }
  // Refuse provider credentials, telemetry, SMTP and third-party fallback paths.
  const rejected = Object.keys(env).some(k =>
    (/^(OPENROUTER|GROQ|OPENAI|ANTHROPIC|REPLICATE|FAL|STRIPE|PAYPAL)_/.test(k) ||
      /^(TRYON_EMAIL_|NEXT_PUBLIC_SENTRY_|NEXT_PUBLIC_POSTHOG_)/.test(k) ||
      /^(SENTRY_DSN|SENTRY_AUTH_TOKEN|LANDING_TRIAL_INFLOW_URL|LANDING_TRIAL_INFLOW_TOKEN)$/.test(k)) && env[k]);
  if (rejected || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('controlled_external_credentials_forbidden');
  let apps;
  try { apps = JSON.parse(env.SHOPIFY_APPS ?? ''); } catch { throw new Error('controlled_apps_invalid'); }
  if (!Array.isArray(apps) || apps.length !== 2 || apps.some(a => !a.secret || !c.app_client_ids.includes(a.clientId)) ||
    new Set(apps.map(a => a.clientId)).size !== 2 || new Set(apps.map(a => a.secret)).size !== 2 ||
    env.SHOPIFY_API_KEY || env.SHOPIFY_API_SECRET) throw new Error('controlled_apps_invalid');
  if (Buffer.from(env.SHOPIFY_TOKEN_ENC_KEY,'base64').length !== 32 ||
    env.GRINDCTRL_CAPABILITY_SECRET.length < 32 ||
    apps.some(a => a.secret === env.GRINDCTRL_CAPABILITY_SECRET) ||
    env.SHOPIFY_TOKEN_ENC_KEY === env.GRINDCTRL_CAPABILITY_SECRET) throw new Error('controlled_independent_keys_required');
}
