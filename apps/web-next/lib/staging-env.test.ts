// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStagingBuildEnv, assertStagingEnv } from './staging-env';

const valid = () => ({
  GRINDCTRL_ENV: 'staging',
  NEXT_PUBLIC_APP_URL: 'https://shopify-m1-dev.grindctrl.cloud',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
  CLERK_SECRET_KEY: 'sk_test_fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture',
  SHOPIFY_APPS: JSON.stringify([{ clientId: 'a'.repeat(32), secret: 'test-secret' }]),
  SHOPIFY_TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString('base64'),
  GRINDCTRL_CAPABILITY_SECRET: 's'.repeat(40),
  GRINDCTRL_TEST_SHOPS: '["fixture-a.myshopify.com","fixture-b.myshopify.com"]',
  GRINDCTRL_TEST_PREVIEW_ORIGIN: 'https://shopify-m1-dev.grindctrl.cloud',
  TRYON_MODE: 'mock', LANDING_SANDBOX_MODE: 'mock',
  UPSTASH_REDIS_REST_URL: 'http://srh:8080', UPSTASH_REDIS_REST_TOKEN: 'a'.repeat(64),
  STAGING_REDIS_PASSWORD: 'b'.repeat(64),
  TRYON_EMAIL_LIVE_SEND_ENABLED: 'false',
});

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('staging boot isolation', () => {
  it('leaves production and credential-free builds unchanged', () => {
    expect(() => assertStagingEnv({})).not.toThrow();
    expect(() => assertStagingEnv({ GRINDCTRL_ENV: 'production', CLERK_SECRET_KEY: 'sk_live_fixture' })).not.toThrow();
  });
  it('accepts the isolated mock profile and build subset', () => {
    expect(() => assertStagingEnv(valid())).not.toThrow();
    expect(() => assertStagingBuildEnv(valid())).not.toThrow();
  });
  it('allows the try-on production project only when named explicitly, and never the widget project', () => {
    const shared = { ...valid(), NEXT_PUBLIC_SUPABASE_URL: 'https://prsusuwxbzaekynonifl.supabase.co' };
    expect(() => assertStagingEnv(shared)).toThrow('NEXT_PUBLIC_SUPABASE_URL');
    expect(() => assertStagingEnv({ ...shared, STAGING_SHARED_PRODUCTION_SUPABASE_REF: 'prsusuwxbzaekynonifl' })).not.toThrow();
    expect(() => assertStagingEnv({
      ...valid(),
      NEXT_PUBLIC_SUPABASE_URL: 'https://egvdxshlbcqndrcnzcdn.supabase.co',
      STAGING_SHARED_PRODUCTION_SUPABASE_REF: 'egvdxshlbcqndrcnzcdn',
    })).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });
  it('refuses a live Clerk secret in workflow/build validation too', () => {
    expect(() => assertStagingBuildEnv({ ...valid(), CLERK_SECRET_KEY: 'sk_live_sensitive' })).toThrow('CLERK_SECRET_KEY');
  });
  it.each([
    ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_live_sensitive'], ['CLERK_SECRET_KEY', 'sk_live_sensitive'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'https://prsusuwxbzaekynonifl.supabase.co'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'https://egvdxshlbcqndrcnzcdn.supabase.co'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'https://test.example.com'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_secret_sensitive'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ.invalid.signature'],
    ['SHOPIFY_API_KEY', 'fc095fe656d9029fdc249a4af2315f19'], ['SHOPIFY_API_SECRET', 'sensitive'],
    ['SHOPIFY_APPS', '[{"clientId":"fc095fe656d9029fdc249a4af2315f19","secret":"sensitive"}]'],
    ['SHOPIFY_APPS', 'invalid-sensitive-json'], ['SHOPIFY_APPS', '[]'],
    ['SHOPIFY_TOKEN_ENC_KEY', 'short'], ['GRINDCTRL_CAPABILITY_SECRET', 'short'],
    ['GRINDCTRL_CAPABILITY_SECRET', 'REPLACE_WITH_NEW_STAGING_ONLY_SECRET_32_PLUS_CHARS'], ['TRYON_MODE', 'live'], ['TRYON_MODE', 'LIVE'],
    ['OPENROUTER_API_KEY', 'sensitive'], ['GROQ_API_KEY', 'sensitive'],
    ['OPENAI_API_KEY', 'sensitive'], ['CLOUDFLARE_API_TOKEN', 'sensitive'],
    ['LANDING_SANDBOX_MODE', 'live'], ['LANDING_TRIAL_INFLOW_URL', 'https://sensitive.example'],
    ['NEXT_PUBLIC_POSTHOG_KEY', 'sensitive'], ['NEXT_PUBLIC_SENTRY_DSN', 'sensitive'],
    ['UPSTASH_REDIS_REST_URL', 'https://production.upstash.io'], ['UPSTASH_REDIS_REST_TOKEN', 'short'],
    ['GRINDCTRL_TEST_SHOPS', '["a.myshopify.com","b.myshopify.com","c.myshopify.com"]'],
    ['GRINDCTRL_TEST_SHOPS', '[]'], ['TRYON_PLATFORM_OPERATOR_CLERK_IDS', 'user_fixture'],
    ['TRYON_EMAIL_LIVE_SEND_ENABLED', 'true'], ['NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud'],
  ])('refuses %s without exposing its value', (name, value) => {
    expect(() => assertStagingEnv({ ...valid(), [name]: value })).toThrow(`Staging environment refused: ${name}`);
    try { assertStagingEnv({ ...valid(), [name]: value }); }
    catch (error) { expect(String(error)).not.toContain(value); }
  });
  it.each(['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])('requires %s', name => {
    expect(() => assertStagingEnv({ ...valid(), [name]: '' })).toThrow(name);
  });
  it('rejects a production JWT paired with a test URL', () => {
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ ref: 'prsusuwxbzaekynonifl', role: 'service_role' })).toString('base64url')}.signature`;
    expect(() => assertStagingEnv({ ...valid(), SUPABASE_SERVICE_ROLE_KEY: jwt })).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });
  it('accepts legacy TEST JWTs with matching roles and refuses a public service-role key at build time', () => {
    const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ ref: 'abcdefghijklmnopqrst', role })).toString('base64url')}.signature`;
    expect(() => assertStagingEnv({ ...valid(), NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'), SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') })).not.toThrow();
    expect(() => assertStagingBuildEnv({ ...valid(), NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') })).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });
  it('rejects mismatched build and runtime public configuration', () => {
    expect(() => assertStagingEnv({ ...valid(), STAGING_BUILT_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_other' })).toThrow('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });
  it('fails during instrumentation before monitoring initializes', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('GRINDCTRL_ENV', 'staging');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
    const { register } = await import('../instrumentation');
    await expect(register()).rejects.toThrow('Staging environment refused: NEXT_PUBLIC_APP_URL');
  });
});
