// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl, socialMetadata } from './site-metadata';

afterEach(() => vi.unstubAllEnvs());

describe('siteUrl', () => {
  it('uses the configured origin and drops any path or trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://staging.grindctrl.cloud/');
    expect(siteUrl()).toBe('https://staging.grindctrl.cloud');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud/shopify/app/x?y=1');
    expect(siteUrl()).toBe('https://grindctrl.cloud');
  });

  it('falls back to the canonical host when the variable is missing or unusable', () => {
    for (const value of ['', 'invalid-url', 'ftp://grindctrl.cloud', 'staging.grindctrl.cloud:8443/app']) {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', value);
      expect(siteUrl(), value).toBe('https://grindctrl.cloud');
    }
  });
});

describe('socialMetadata', () => {
  it('repeats the page title and description for OpenGraph and Twitter', () => {
    const social = socialMetadata({ title: 'T', description: 'D', path: '/pricing' });
    expect(social.openGraph).toMatchObject({ title: 'T', description: 'D', url: '/pricing', type: 'website' });
    expect(social.twitter).toMatchObject({ title: 'T', description: 'D' });
  });
});
