import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('client instrumentation secret bootstrap order', () => {
  it('removes storefront proof before Sentry and PostHog initialization', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'instrumentation-client.ts'),
      'utf8',
    );
    const bootstrap = source.indexOf('bootstrapStorefrontProof();');
    const sentry = source.indexOf('Sentry.init(');
    const posthog = source.indexOf('posthog.init(');

    expect(bootstrap).toBeGreaterThan(-1);
    expect(bootstrap).toBeLessThan(sentry);
    expect(bootstrap).toBeLessThan(posthog);
  });
});
