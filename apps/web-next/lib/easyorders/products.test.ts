// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), rpc: vi.fn(), load: vi.fn() }));
vi.mock('./client', () => ({ easyOrdersRequest: mocks.request }));
vi.mock('./store', () => ({ easyOrdersRpc: mocks.rpc, loadEasyOrdersConnection: mocks.load }));
import { fetchEasyOrdersProducts, productKnowledge, syncEasyOrdersProducts } from './products';
import { connection, SITE, TOKEN } from './test-fixtures';
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(connection()); mocks.rpc.mockResolvedValue(1); });
afterEach(() => vi.unstubAllGlobals());
describe('bounded product knowledge', () => {
  it('extracts readable reference data and does not infer stock/currency', () => {
    expect(productKnowledge({ id: '1', name: 'Cotton shirt', description: '<p>Soft cotton</p><script>steal()</script>', price: '200', variations: [{ name: 'Small' }] }))
      .toEqual({ id: '1', title: 'Cotton shirt', content: 'Cotton shirt\nSoft cotton\nPrice: 200\nVariations: Small' });
    expect(productKnowledge({ id: 1 })).toBeNull();
  });
  it('fetches at most two pages of 25 with variations', async () => {
    const products = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Product ${i}` }));
    mocks.request.mockResolvedValueOnce({ ok: true, json: { data: products } })
      .mockResolvedValueOnce({ ok: true, json: products.map((p) => ({ ...p, id: p.id + 25 })) });
    expect(await fetchEasyOrdersProducts(connection())).toHaveLength(50);
    expect(mocks.request).toHaveBeenNthCalledWith(2, expect.anything(), 'products?limit=25&page=2&join=variations');
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it('stops early on a short page, imports through existing messenger knowledge', async () => {
    mocks.request.mockResolvedValue({ ok: true, json: [{ id: 1, name: 'Shirt' }] });
    expect(await syncEasyOrdersProducts(SITE)).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith('sync_easyorders_knowledge', { p_site: SITE, p_token: TOKEN,
      p_entries: [{ id: '1', title: 'Shirt', content: 'Shirt' }] });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it.each([{ ok: false, reason: 'rate_limited' }, { ok: true, json: {} }, { ok: true, json: [{ id: 1 }] }])('keeps last known good import on %j', async (reply) => {
    mocks.request.mockResolvedValue(reply);
    await expect(syncEasyOrdersProducts(SITE)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('honors persisted freshness and refuses disconnected stores', async () => {
    mocks.load.mockResolvedValueOnce(connection({ products_synced_at: new Date().toISOString() }));
    expect(await syncEasyOrdersProducts(SITE)).toBe(0);
    mocks.load.mockResolvedValueOnce(connection({ status: 'disconnected' }));
    await expect(syncEasyOrdersProducts(SITE)).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
