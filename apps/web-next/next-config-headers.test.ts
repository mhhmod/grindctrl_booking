// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from './next.config';

type Rule = { source: string; headers: { key: string; value: string }[] };
const rules = async () => ((await config.headers?.()) ?? []) as Rule[];
const header = (rule: Rule | undefined, key: string) => rule?.headers.find((h) => h.key === key)?.value;

describe('framing headers', () => {
  it('keeps signed-in and sign-in pages from being framed by other sites', async () => {
    const all = await rules();
    for (const source of ['/dashboard/:path*', '/onboarding/:path*', '/claim/:path*', '/sign-in/:path*', '/sign-up/:path*', '/connect/:path*']) {
      const rule = all.find((r) => r.source === source);
      expect(header(rule, 'Content-Security-Policy'), source).toBe("frame-ancestors 'self'");
      expect(header(rule, 'X-Frame-Options'), source).toBe('SAMEORIGIN');
    }
  });

  it('never puts a global frame restriction on the embed or the Shopify admin pages', async () => {
    const all = await rules();
    const global = all.find((r) => r.source === '/:path*');
    expect(header(global, 'X-Frame-Options')).toBeUndefined();
    expect(header(global, 'Content-Security-Policy')).toBeUndefined();
    expect(header(all.find((r) => r.source === '/embed/:path*'), 'Content-Security-Policy')).toMatch(/^frame-ancestors https:/);
    expect(header(all.find((r) => r.source === '/shopify/:path*'), 'Content-Security-Policy')).toContain('admin.shopify.com');
  });
});
