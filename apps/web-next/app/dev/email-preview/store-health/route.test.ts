// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from './route';
afterEach(() => vi.unstubAllEnvs());
it('previews problem and recovery in both languages and offers the plain text alternative', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  for (const locale of ['en', 'ar']) for (const recovery of ['0', '1']) {
    const response = await GET(new NextRequest(`http://localhost/dev/email-preview/store-health?locale=${locale}&recovery=${recovery}`));
    expect(response.status).toBe(200); expect(await response.text()).toContain(`lang="${locale}"`);
  }
  const plain = await GET(new NextRequest('http://localhost/dev/email-preview/store-health?format=text'));
  expect(plain.headers.get('content-type')).toContain('text/plain'); expect(await plain.text()).toContain('Manage alerts:');
});
it('hides the preview in production', async () => {
  vi.stubEnv('NODE_ENV', 'production'); expect((await GET(new NextRequest('http://localhost/dev/email-preview/store-health'))).status).toBe(404);
});
