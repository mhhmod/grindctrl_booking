// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const original = process.env.SENTRY_RELEASE;

afterEach(() => {
  if (original === undefined) delete process.env.SENTRY_RELEASE;
  else process.env.SENTRY_RELEASE = original;
});

describe('GET /api/health', () => {
  it('reports the release baked into the running image', async () => {
    process.env.SENTRY_RELEASE = 'abc123';

    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, release: 'abc123' });
  });

  it('never caches, so a deploy check cannot read a stale release', () => {
    process.env.SENTRY_RELEASE = 'abc123';

    expect(GET().headers.get('Cache-Control')).toBe('no-store');
  });

  it('degrades to "unknown" rather than throwing when the build arg is absent', async () => {
    delete process.env.SENTRY_RELEASE;

    await expect(GET().json()).resolves.toEqual({ ok: true, release: 'unknown' });
  });
});
