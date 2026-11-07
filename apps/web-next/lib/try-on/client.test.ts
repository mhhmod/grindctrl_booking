// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepTryOnResultInPage, pollTryOnJob, releaseTryOnResult, runPublicTryOn } from './client';

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

  it("keeps one of our own files, such as the demo's mock look, as it is", async () => {
    const mock = '/try-on/mock-result.png';
    expect(await keepTryOnResultInPage('tryon_5', 'signed-session', mock)).toBe(mock);
    expect(fetchMock.mock.calls.filter(([url]) => url === mock)).toHaveLength(0);
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

/* Contract N38: a look made after the answer is polled for the whole
   provider run, and each answer on the way reports its stage. */
describe('pollTryOnJob for a look made after the answer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const answer = (body: Record<string, unknown>) =>
    new Response(JSON.stringify({ ok: true, jobId: 'tryon_1', ...body }), { headers: { 'content-type': 'application/json' } });

  it('reports each stage, then hands back the finished look', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ status: 'processing', stage: 'making' }))
      .mockResolvedValueOnce(answer({ status: 'processing', stage: 'finishing' }))
      .mockResolvedValueOnce(answer({ status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' }));
    const stages: unknown[] = [];

    const polled = pollTryOnJob('tryon_1', 'signed-session', 'Something went wrong', undefined, {
      timeoutMs: 5 * 60_000,
      onProgress: (data) => stages.push(data.stage),
    });
    await vi.runAllTimersAsync();

    await expect(polled).resolves.toMatchObject({ status: 'completed' });
    expect(stages).toEqual(['making', 'finishing']);
  });

  it('delays the first async poll for six seconds, then checks every 1.5 seconds', async () => {
    fetchMock.mockResolvedValueOnce(answer({ status: 'processing' }))
      .mockResolvedValueOnce(answer({ status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' }));
    const polled = pollTryOnJob('tryon_1', 'signed-session', 'failed', undefined, { initialDelayMs: 6_000 });
    await vi.advanceTimersByTimeAsync(5_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(polled).resolves.toMatchObject({ status: 'completed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([200, 429])('honors Retry-After on status %s', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, status: 'processing' }), {
      status, headers: { 'Retry-After': '9' },
    })).mockResolvedValueOnce(answer({ status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' }));
    const polled = pollTryOnJob('tryon_1', 'signed-session', 'failed');
    await vi.advanceTimersByTimeAsync(8_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(polled).resolves.toMatchObject({ status: 'completed' });
  });

  it('aborts an initial async delay without issuing a status request', async () => {
    const controller = new AbortController();
    const polled = pollTryOnJob('tryon_1', 'signed-session', 'failed', controller.signal, { initialDelayMs: 6_000 });
    const checked = expect(polled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await checked;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps polling past two minutes when given the longer window', async () => {
    fetchMock.mockImplementation(async () => answer({ status: 'processing', stage: 'making' }));
    let settled = false;
    const polled = pollTryOnJob('tryon_1', 'signed-session', 'Something went wrong', undefined, { timeoutMs: 5 * 60_000 })
      .catch((error: Error) => error)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    await expect(polled).resolves.toBeInstanceOf(Error);
  });
});

describe('public studio async generation', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('recovers the same job when synchronous fallback reports finalization pending', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (input.endsWith('/session')) return json({ ok: true, data: { sessionId: 'signed-session' } });
      if (input.endsWith('/attempt')) return json({ ok: true, data: { attemptId: 'same-signed-attempt' } });
      if (input.endsWith('/generate')) return json({ ok: false, code: 'TRYON_FINALIZATION_PENDING', jobId: 'tryon_same' }, 503);
      return json({ ok: true, jobId: 'tryon_same', status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(runPublicTryOn({ productId: 'demo-shirt', photoDataUrl: 'data:image/jpeg;base64,cGhvdG8=' }))
      .resolves.toMatchObject({ ok: true, jobId: 'tryon_same' });
    const submissions = fetchMock.mock.calls.filter(([input]) => input.endsWith('/generate'));
    expect(submissions).toHaveLength(2);
    expect(submissions[0][1]?.body).toBe(submissions[1][1]?.body);
  });
  it('retries the same attempt body, honors the accepted Retry-After and keeps the five-minute window', async () => {
    vi.useFakeTimers();
    const generateBodies: unknown[] = [];
    let polls = 0;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (input.endsWith('/session')) return json({ ok: true, data: { sessionId: 'signed-session' } });
      if (input.endsWith('/attempt')) return json({ ok: true, data: { attemptId: 'same-signed-attempt' } });
      if (input.endsWith('/generate')) {
        generateBodies.push(init?.body);
        return generateBodies.length === 1 ? json({}, 502)
          : json({ ok: true, jobId: 'tryon_async', status: 'processing' }, 202, { 'Retry-After': '8' });
      }
      polls += 1;
      return Date.now() < started + 130_000 ? json({ ok: true, status: 'processing' }) : json({
        ok: true, jobId: 'tryon_async', status: 'completed', resultImageUrl: 'data:image/png;base64,TE9PSw==',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const started = Date.now();
    const result = runPublicTryOn({ productId: 'demo-shirt', photoDataUrl: 'data:image/jpeg;base64,cGhvdG8=' });
    await vi.advanceTimersByTimeAsync(7_999);
    expect(polls).toBe(0);
    expect(generateBodies).toHaveLength(2);
    expect(generateBodies[0]).toBe(generateBodies[1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(polls).toBe(1);
    await vi.advanceTimersByTimeAsync(130_000);
    await expect(result).resolves.toMatchObject({ ok: true, jobId: 'tryon_async' });
  });
});
