// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ reserve: vi.fn(), test: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), error: null as null | { code: string; message: string } }));
vi.mock('server-only', () => ({}));
vi.mock('./entitlement', () => ({ reserveCredit: m.reserve, reserveTestLook: m.test }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => {
  const query = { insert: m.insert, eq: (key: string, value: unknown) => { m.eq(key, value); return query; },
    update: (value: unknown) => { m.update(value); return query; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: m.error }).then(resolve) };
  return query;
} }) }));
import { beginTryOnJob, beginTestTryOnJob, persistTryOnJob } from './persistence';
import { missingProductInfo } from './product-info';

const input = { shop: 'site:11111111-1111-4111-8111-111111111111', jobId: 'tryon_new', requestKey: 'request', modelKey: 'muse',
  sessionId: 'session', productId: '14', productInfo: { title: 'Store tee', imageUrl: 'https://store.example/tee.jpg' } };
beforeEach(() => {
  vi.clearAllMocks(); m.error = null;
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  m.insert.mockResolvedValue({ error: null });
  m.reserve.mockResolvedValue({ created: true, jobId: 'tryon_new' }); m.test.mockResolvedValue({ created: true, jobId: 'tryon_new' });
});
it('attaches product metadata to a newly inserted billed or test job with ownership predicates', async () => {
  for (const reserve of [beginTryOnJob, beginTestTryOnJob]) {
    await reserve(input);
    expect(m.update).toHaveBeenLastCalledWith({ product_title: 'Store tee', product_image_url: 'https://store.example/tee.jpg' });
    expect(m.eq.mock.calls).toEqual(expect.arrayContaining([['id', 'tryon_new'], ['shop', input.shop], ['session_id', 'session'], ['product_id', '14'], ['request_key', 'request']]));
  }
});
it.each(['42703', 'PGRST204'])('allows the reserved look before metadata columns exist (%s)', async (code) => {
  m.error = { code, message: "Could not find the 'product_image_url' column" };
  await expect(beginTryOnJob(input)).resolves.toMatchObject({ created: true });
  expect(missingProductInfo(m.error)).toBe(true);
  expect(missingProductInfo({ code, message: 'column request_key missing' })).toBe(false);
});
it('does not overwrite the product snapshot on an idempotent replay', async () => {
  m.reserve.mockResolvedValue({ created: false, jobId: 'tryon_old' });
  await beginTryOnJob(input);
  expect(m.update).not.toHaveBeenCalled();
});

it('inserts only signed product fields and retries a missing-column insert without them', async () => {
  const job = { jobId: 'tryon_new', sessionId: 'session', productId: '14', shop: input.shop, status: 'completed' as const,
    createdAt: '2026-11-11T00:00:00Z', meta: { runtime: 'mock' as const, provider: 'mock', costEstimate: 0 } };
  // These fields are selected from the verified capability, never a request body.
  const { signStorefrontContext, signTryOnSession } = await import('./storefront-context');
  const signed = signStorefrontContext('test-secret', { shop: input.shop, platform: 'paste-website', productId: '14', variantId: null,
    productGid: 'paste:14', variantGid: 'paste:14', canonicalGarmentUrl: 'https://store.example/tee.jpg',
    title: 'Signed Tee', origin: 'https://store.example', nonce: 'abcdefghijklmnopqrstuvwx' });
  const auth = signTryOnSession('test-secret', { purpose: 'storefront', context: signed.claims }).claims;
  const boundJob = { ...job, sessionId: auth.sessionId };
  m.insert.mockResolvedValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'product_title' column" } });
  await persistTryOnJob(boundJob, 10, auth);
  expect(m.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({ product_title: 'Signed Tee', product_image_url: 'https://store.example/tee.jpg' }));
  expect(m.insert.mock.calls[1][0]).not.toHaveProperty('product_title');
  expect(m.insert.mock.calls[1][0]).not.toHaveProperty('product_image_url');
});
