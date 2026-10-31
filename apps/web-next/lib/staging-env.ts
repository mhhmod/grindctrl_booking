type Env = Record<string, string | undefined>;

const ORIGIN = 'https://shopify-m1-dev.grindctrl.cloud';
const PRODUCTION_REFS = ['prsusuwxbzaekynonifl', 'egvdxshlbcqndrcnzcdn'];
const PRODUCTION_APP = 'fc095fe656d9029fdc249a4af2315f19';

function requireSafe(condition: unknown, name: string): asserts condition {
  // Never include a value, JSON parser error, or credential in startup logs.
  if (!condition) throw new Error(`Staging environment refused: ${name}`);
}

function jsonArray(raw: string | undefined, name: string): unknown[] {
  try {
    const value: unknown = JSON.parse(raw ?? '');
    if (Array.isArray(value)) return value;
  } catch { /* Report the variable name only. */ }
  throw new Error(`Staging environment refused: ${name}`);
}

function assertSupabaseKey(env: Env, name: string, role: 'anon' | 'service_role'): void {
  const value = env[name] ?? '';
  if (value.startsWith('eyJ')) {
    let claims: { ref?: unknown; role?: unknown } = {};
    try { claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()); }
    catch { requireSafe(false, name); }
    requireSafe(claims?.role === role && typeof claims.ref === 'string' &&
      env.NEXT_PUBLIC_SUPABASE_URL === `https://${claims.ref}.supabase.co`, name);
  } else {
    requireSafe((role === 'anon' ? /^sb_publishable_\S+$/ : /^sb_secret_\S+$/).test(value), name);
  }
}

/** Also called by CI and the staging Docker build, before Next inlines public config. */
export function assertStagingBuildEnv(env: Env): void {
  requireSafe(env.NEXT_PUBLIC_APP_URL === ORIGIN, 'NEXT_PUBLIC_APP_URL');
  requireSafe(/^pk_test_\S+$/.test(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''), 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  // Build needs no Clerk secret; reject live keys if a runner ever supplies one.
  if (env.CLERK_SECRET_KEY) requireSafe(/^sk_test_\S+$/.test(env.CLERK_SECRET_KEY), 'CLERK_SECRET_KEY');
  let ref = '';
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash) {
      ref = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)?.[1] ?? '';
    }
  } catch { /* Invalid URLs fail below without printing them. */ }
  /* Owner decision (2026-10-31): staging may share the try-on app's own
     production project, named explicitly. The widget production project is
     never allowed, and no other production ref is implied by the override. */
  const sharedProduction = ref === 'prsusuwxbzaekynonifl' && env.STAGING_SHARED_PRODUCTION_SUPABASE_REF === ref;
  requireSafe(ref && (sharedProduction || !PRODUCTION_REFS.includes(ref)), 'NEXT_PUBLIC_SUPABASE_URL');
  // Do not accidentally bake a service-role secret into a public client bundle.
  assertSupabaseKey(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  for (const name of ['NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_POSTHOG_KEY', 'SENTRY_DSN', 'SENTRY_AUTH_TOKEN']) {
    requireSafe(!env[name]?.trim(), name);
  }
}

/** No effect on production or credential-free release-check builds. */
export function assertStagingEnv(env: Env): void {
  if (env.GRINDCTRL_ENV !== 'staging') return;
  assertStagingBuildEnv(env);
  requireSafe(/^sk_test_\S+$/.test(env.CLERK_SECRET_KEY ?? ''), 'CLERK_SECRET_KEY');
  assertSupabaseKey(env, 'SUPABASE_SERVICE_ROLE_KEY', 'service_role');

  const apps = jsonArray(env.SHOPIFY_APPS, 'SHOPIFY_APPS');
  requireSafe(apps.length >= 1 && apps.length <= 2, 'SHOPIFY_APPS');
  for (const app of apps) {
    requireSafe(app && typeof app === 'object' && 'clientId' in app && 'secret' in app &&
      typeof app.clientId === 'string' && /^[a-f0-9]{32}$/.test(app.clientId) &&
      app.clientId !== PRODUCTION_APP && typeof app.secret === 'string' && app.secret.trim(), 'SHOPIFY_APPS');
  }
  // Disallow the legacy fallback entirely: it otherwise augments SHOPIFY_APPS.
  requireSafe(!env.SHOPIFY_API_KEY?.trim(), 'SHOPIFY_API_KEY');
  requireSafe(!env.SHOPIFY_API_SECRET?.trim(), 'SHOPIFY_API_SECRET');
  requireSafe(Buffer.from(env.SHOPIFY_TOKEN_ENC_KEY ?? '', 'base64').length === 32, 'SHOPIFY_TOKEN_ENC_KEY');
  // Signs storefront origin tokens; without it every chat panel is refused.
  requireSafe(Buffer.byteLength(env.GRINDCTRL_CAPABILITY_SECRET?.trim() ?? '', 'utf8') >= 32 &&
    !env.GRINDCTRL_CAPABILITY_SECRET?.startsWith('REPLACE'), 'GRINDCTRL_CAPABILITY_SECRET');
  const shops = jsonArray(env.GRINDCTRL_TEST_SHOPS, 'GRINDCTRL_TEST_SHOPS');
  requireSafe(shops.length >= 1 && shops.length <= 2 && new Set(shops).size === shops.length &&
    shops.every(shop => typeof shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)), 'GRINDCTRL_TEST_SHOPS');
  requireSafe(env.GRINDCTRL_TEST_PREVIEW_ORIGIN === ORIGIN, 'GRINDCTRL_TEST_PREVIEW_ORIGIN');
  requireSafe(env.TRYON_MODE === 'mock', 'TRYON_MODE');
  requireSafe(env.LANDING_SANDBOX_MODE === 'mock', 'LANDING_SANDBOX_MODE');
  // A one-off AI smoke test may boot with OPENROUTER_API_KEY alone, and only
  // while STAGING_AI_SMOKE_UNTIL is at most 2 hours away. The check runs at
  // boot, so the key must still be removed and the container restarted after.
  const smokeUntil = Date.parse(env.STAGING_AI_SMOKE_UNTIL ?? '');
  const aiSmoke = smokeUntil > Date.now() && smokeUntil - Date.now() <= 2 * 60 * 60 * 1000;
  for (const name of [
    'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'FAL_KEY', 'REPLICATE_API_TOKEN',
    'CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN', 'LANDING_TRIAL_INFLOW_URL', 'LANDING_TRIAL_INFLOW_TOKEN',
  ]) if (!(aiSmoke && name === 'OPENROUTER_API_KEY')) requireSafe(!env[name]?.trim(), name);
  requireSafe(env.UPSTASH_REDIS_REST_URL === 'http://srh:8080', 'UPSTASH_REDIS_REST_URL');
  requireSafe(/^[a-f0-9]{64}$/.test(env.UPSTASH_REDIS_REST_TOKEN ?? ''), 'UPSTASH_REDIS_REST_TOKEN');
  requireSafe(/^[a-f0-9]{64}$/.test(env.STAGING_REDIS_PASSWORD ?? '') && env.STAGING_REDIS_PASSWORD !== env.UPSTASH_REDIS_REST_TOKEN, 'STAGING_REDIS_PASSWORD');
  requireSafe(env.TRYON_EMAIL_LIVE_SEND_ENABLED === 'false', 'TRYON_EMAIL_LIVE_SEND_ENABLED');
  requireSafe(!env.TRYON_PLATFORM_OPERATOR_CLERK_IDS?.trim(), 'TRYON_PLATFORM_OPERATOR_CLERK_IDS');
  // Dynamic env lookups check actual runtime values, not Next's inlined literals.
  for (const name of ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (env[`STAGING_BUILT_${name}`] !== undefined) {
      requireSafe(env[name] === env[`STAGING_BUILT_${name}`], name);
    }
  }
}
