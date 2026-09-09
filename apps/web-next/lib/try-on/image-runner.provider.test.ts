// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_PROVIDER_TIMEOUT_MS, isAllowedGarmentUrl, parsePhotoDataUrl, runImageGeneration } from './image-runner';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PHOTO = `data:image/png;base64,${PNG}`;
const GARMENT = 'https://cdn.shopify.com/s/files/1/product.png';
const fetchMock = vi.fn();
const generate = () => runImageGeneration('session', 'product', PHOTO, 'test.myshopify.com', GARMENT);

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-only-key');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fetchMock.mockResolvedValueOnce(new Response(Buffer.from(PNG, 'base64'), { headers: { 'content-type': 'image/png' } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('image provider safety boundary', () => {
  it('bounds both fetches and forbids garment redirects', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ b64_json: PNG, media_type: 'image/png' }], usage: { cost: 0.02 } }));
    const job = await generate();
    expect(job.status).toBe('completed');
    expect(job.meta.costEstimate).toBe(0.02);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.cache).toBe('no-store');
    }
    expect(IMAGE_PROVIDER_TIMEOUT_MS).toBe(120_000);
  });
  it.each([undefined, -1, '0.01'])('does not invent zero cost for unreported/invalid usage (%s)', async (cost) => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ b64_json: PNG }], usage: { cost } }));
    expect((await generate()).meta.costEstimate).toBeNull();
  });
  it('retains a genuinely reported zero', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ b64_json: PNG }], usage: { cost: 0 } }));
    expect((await generate()).meta.costEstimate).toBe(0);
  });
  it('returns a safe failure with unknown cost and no retry after timeout', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('sensitive upstream detail', 'TimeoutError'));
    const job = await generate();
    expect(job.status).toBe('failed');
    expect(job.meta.costEstimate).toBeNull();
    expect(job.message).not.toContain('sensitive');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not expose a provider billing error', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'secret billing portal API key' } }, { status: 402 }));
    const job = await generate();
    expect(job.status).toBe('failed');
    expect(job.message).not.toMatch(/secret|API key|billing portal/);
    expect(job.meta.costEstimate).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([
    { error: { message: 'upstream failure' } },
    { data: [{ b64_json: 'PGh0bWw+', media_type: 'image/png' }] },
    { data: [{ b64_json: PNG, media_type: 'image/svg+xml' }] },
    { data: [{ b64_json: 123 }] },
  ])('rejects invalid or unsafe successful provider responses', async (body) => {
    fetchMock.mockResolvedValueOnce(Response.json(body));
    expect((await generate()).status).toBe('failed');
  });
  it('fails before reading an oversized provider response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('payload', { headers: { 'content-length': String(32 * 1024 * 1024) } }));
    expect((await generate()).status).toBe('failed');
  });
  it('rejects credential-bearing, nonstandard-port and untrusted garment URLs', () => {
    expect(isAllowedGarmentUrl('https://user:pass@cdn.shopify.com/x.png')).toBe(false);
    expect(isAllowedGarmentUrl('https://cdn.shopify.com:444/x.png')).toBe(false);
    expect(isAllowedGarmentUrl('https://example.com/x.png')).toBe(false);
    expect(isAllowedGarmentUrl('https://store.myshopify.com/cdn/image.png')).toBe(true);
  });
  it('rejects malformed or disguised photo bytes', () => {
    expect(parsePhotoDataUrl('data:image/png;base64,PGh0bWw+')).toBeNull();
    expect(parsePhotoDataUrl('data:image/png;base64,%%%%')).toBeNull();
  });
});
