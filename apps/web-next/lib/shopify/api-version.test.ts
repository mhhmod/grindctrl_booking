// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOPIFY_ADMIN_API_VERSION } from './admin';

describe('reviewed stable Shopify API pin', () => {
  it('keeps Admin, webhook, and theme extension pins aligned to stable 2026-07', () => {
    // Deliberate upgrade gate: review the actual queries before changing all
    // three together. October 2026 is still an RC on the review date.
    expect(SHOPIFY_ADMIN_API_VERSION).toBe('2026-07');
    const app = readFileSync(resolve(process.cwd(), '../grindctrl-tryon/shopify.app.toml'), 'utf8');
    const extension = readFileSync(resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/shopify.extension.toml'), 'utf8');
    for (const config of [app, extension]) {
      expect(config.match(/^api_version\s*=\s*"([^"]+)"/m)?.[1]).toBe(SHOPIFY_ADMIN_API_VERSION);
    }
  });
});
