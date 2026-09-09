// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteShopToken, hasShopOrderAccess, setShopTokenClientForTests } from './tokens';

const from = vi.fn();
const select = vi.fn();
const remove = vi.fn();
const eq = vi.fn();
const maybeSingle = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue({ select, delete: remove });
  select.mockReturnValue({ eq });
  remove.mockReturnValue({ eq });
  eq.mockReturnValue({ maybeSingle });
  setShopTokenClientForTests({ from } as unknown as SupabaseClient);
});

afterEach(() => {
  setShopTokenClientForTests(null);
  vi.restoreAllMocks();
});

describe('hasShopOrderAccess', () => {
  it.each([
    ['read_products', false],
    ['read_products, read_orders', true],
    ['write_products', false],
    ['', false],
  ])('checks actual recorded scopes: %s', async (scopes, allowed) => {
    maybeSingle.mockResolvedValue({ data: { scopes }, error: null });
    expect(await hasShopOrderAccess('demo.myshopify.com')).toBe(allowed);
    expect(select).toHaveBeenCalledWith('scopes');
    expect(eq).toHaveBeenCalledWith('shop_domain', 'demo.myshopify.com');
  });

  it.each([
    { data: null, error: null },
    { data: { scopes: null }, error: null },
    { data: { scopes: 'read_orders' }, error: { message: 'unavailable' } },
  ])('never reports access from absent or failed data', async (result) => {
    maybeSingle.mockResolvedValue(result);
    expect(await hasShopOrderAccess('demo.myshopify.com')).toBe(false);
  });
});

describe('deleteShopToken', () => {
  it('deletes only the normalized shop and permits already-absent rows', async () => {
    eq.mockResolvedValue({ data: null, error: null });
    expect(await deleteShopToken('DEMO.myshopify.com')).toBe(true);
    expect(await deleteShopToken('demo.myshopify.com')).toBe(true);
    expect(from).toHaveBeenCalledWith('shopify_shop_tokens');
    expect(eq).toHaveBeenCalledWith('shop_domain', 'demo.myshopify.com');
  });

  it('does not delete anything for invalid domains', async () => {
    expect(await deleteShopToken('attacker.example')).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(['returned', 'thrown'])('reports %s storage failure without exposing its contents', async (kind) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    if (kind === 'returned') eq.mockResolvedValue({ error: { message: 'secret detail' } });
    else eq.mockRejectedValue(new Error('secret detail'));
    expect(await deleteShopToken('demo.myshopify.com')).toBe(false);
    expect(log).toHaveBeenCalledWith('[shopify] token delete failed');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret detail');
  });
});
