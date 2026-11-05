// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('GET /llms.txt', () => {
  it('serves plain text with the platform status and the site origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
    const response = GET();
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await response.text();
    expect(body).toContain('- WooCommerce: Live.');
    expect(body).toContain('- Your website: Live.');
    expect(body).toContain('- Salla: Planned.');
    expect(body).toContain('](https://grindctrl.cloud/pricing):');
  });

  it('takes its host from NEXT_PUBLIC_APP_URL like the sitemap', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://staging.grindctrl.cloud');
    expect(await GET().text()).toContain('](https://staging.grindctrl.cloud/pricing):');
  });
});
