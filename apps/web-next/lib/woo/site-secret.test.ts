// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { deriveWooSiteSecret } from './site-secret';

const SITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const CORE = 'test-only-independent-core-signing-key-2026';

afterEach(() => {
  delete process.env.GRINDCTRL_CAPABILITY_SECRET;
});

describe('deriveWooSiteSecret', () => {
  it('derives the exact versioned HMAC as base64url', () => {
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
    const expected = createHmac('sha256', CORE)
      .update(`woo-site:${SITE_ID}:v3`, 'utf8')
      .digest('base64url');

    expect(deriveWooSiteSecret(SITE_ID, 3)).toBe(expected);
  });

  it('separates site and version trust domains', () => {
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
    const first = deriveWooSiteSecret(SITE_ID, 1);

    expect(deriveWooSiteSecret(SITE_ID, 2)).not.toBe(first);
    expect(deriveWooSiteSecret('223e4567-e89b-12d3-a456-426614174000', 1)).not.toBe(first);
  });

  it('fails closed for missing or short core configuration', () => {
    expect(deriveWooSiteSecret(SITE_ID, 1)).toBeNull();
    process.env.GRINDCTRL_CAPABILITY_SECRET = 'too-short';
    expect(deriveWooSiteSecret(SITE_ID, 1)).toBeNull();
  });

  it('refuses malformed site ids and versions', () => {
    process.env.GRINDCTRL_CAPABILITY_SECRET = CORE;
    expect(deriveWooSiteSecret('not-a-site', 1)).toBeNull();
    expect(deriveWooSiteSecret(SITE_ID, 0)).toBeNull();
    expect(deriveWooSiteSecret(SITE_ID, 1.5)).toBeNull();
  });
});
