// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepTryOnResultInPage, releaseTryOnResult } from './client';

/* Phase zero item 2: once this page holds the look, the server deletes its
   copy; a look this page could not read keeps its server copy until expiry. */
describe('keepTryOnResultInPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function releaseCalls() {
    return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE');
  }

  it('keeps a data URL as is and tells the server it can delete its copy', async () => {
    const look = 'data:image/png;base64,UkVTVUxU';
    expect(await keepTryOnResultInPage('tryon_1', 'signed-session', look)).toBe(look);

    expect(releaseCalls()).toHaveLength(1);
    const [url, init] = releaseCalls()[0] as [string, RequestInit];
    expect(url).toBe('/api/try-on/jobs/tryon_1');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer signed-session');
    expect(init.keepalive).toBe(true);
  });

  it('reads a signed link into the page first, then releases it', async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(new Uint8Array([82, 69, 83]), { headers: { 'content-type': 'image/png' } });
    });

    const kept = await keepTryOnResultInPage('tryon_2', 'signed-session', 'https://storage.example/signed');

    expect(kept).toBe('data:image/png;base64,UkVT');
    expect(fetchMock.mock.calls[0][0]).toBe('https://storage.example/signed');
    expect(releaseCalls()).toHaveLength(1);
  });

  it.each([
    ['a failed read', () => new Response('gone', { status: 404 })],
    ['something that is not a picture', () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })],
  ])('keeps the link and the server copy after %s', async (_label, answer) => {
    fetchMock.mockImplementation(async () => answer());
    const link = 'https://storage.example/signed';

    expect(await keepTryOnResultInPage('tryon_3', 'signed-session', link)).toBe(link);
    expect(releaseCalls()).toHaveLength(0);
  });

  it('never lets a failed release reach the shopper', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(() => releaseTryOnResult('tryon_4', 'signed-session')).not.toThrow();
    await Promise.resolve();
  });
});
