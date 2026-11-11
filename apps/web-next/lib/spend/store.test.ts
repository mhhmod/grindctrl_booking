// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rows: {} as Record<string, { data: unknown; error: unknown }>, rpc: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => m.rows[table] }) }) }), rpc: m.rpc }) }));
import { readSpendLimits, readChatSpendLimits, writeSpendLimit } from './store';
beforeEach(() => { m.rows = { widget_sites: { data: { domain: null, settings_json: { spend_limits: { tryOnDailyLooks: 7, storeChatDailyTurns: 0 } } }, error: null }, tryon_shops: { data: { status: 'installed', settings_json: { spend_limits: { tryOnDailyLooks: 8, storeChatDailyTurns: 9 } } }, error: null } }; m.rpc.mockReset().mockResolvedValue({ error: null }); });
describe('canonical store limits', () => {
 it('reads site limits and Shopify shop limits from their own rows', async () => {
   expect(await readSpendLimits('site:123e4567-e89b-42d3-a456-426614174000')).toEqual({ tryOnDailyLooks: 7, storeChatDailyTurns: 0 });
   expect(await readSpendLimits('shop.myshopify.com')).toEqual({ tryOnDailyLooks: 8, storeChatDailyTurns: 9 });
 });
 it('uses Shopify store overrides for its Chat site and the site row for other platforms', async () => {
   expect(await readChatSpendLimits('site-id')).toMatchObject({ storeChatDailyTurns: 0 });
   m.rows.widget_sites.data = { domain: 'shop.myshopify.com', settings_json: { spend_limits: { storeChatDailyTurns: 1 } } };
   expect(await readChatSpendLimits('site-id')).toMatchObject({ storeChatDailyTurns: 9 });
   m.rows.tryon_shops.data = { status: 'uninstalled', settings_json: { spend_limits: { storeChatDailyTurns: 9 } } };
   expect(await readChatSpendLimits('site-id')).toMatchObject({ storeChatDailyTurns: 1 });
   m.rows.tryon_shops.data = null; expect(await readChatSpendLimits('site-id')).toMatchObject({ storeChatDailyTurns: 1 });
 });
 it('fails closed on failed reads and unknown tenants', async () => {
   m.rows.widget_sites.error = Error('DB'); await expect(readChatSpendLimits('site-id')).rejects.toThrow('unavailable');
   await expect(readSpendLimits('default')).rejects.toThrow('Unknown');
   m.rows.tryon_shops.data = null; await expect(readSpendLimits('shop.myshopify.com')).rejects.toThrow('unavailable');
 });
 it('passes operator id to the atomic audited setter and reports an RPC failure', async () => {
   await writeSpendLimit('shop.myshopify.com', 'tryOnDailyLooks', 0, 'clerk-operator');
   expect(m.rpc).toHaveBeenCalledWith('set_store_spend_limit', { p_tenant: 'shop.myshopify.com', p_key: 'tryOnDailyLooks', p_value: 0, p_operator: 'clerk-operator' });
   m.rpc.mockResolvedValue({ error: Error('audit failed') }); await expect(writeSpendLimit('shop.myshopify.com', 'tryOnDailyLooks', 0, 'operator')).rejects.toThrow('save failed');
 });
});
