// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]>, counts: new Map<string, number>(), ranges: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: (table: string) => ({ select: () => ({ order: () => ({ range: (start: number, end: number) => { m.ranges(table, start, end); return { returns: async () => ({ data: m.rows[table].slice(start, end + 1), error: null }) }; } }) }) }) }) }));
vi.mock('./daily-counter', async original => ({ ...await original<typeof import('./daily-counter')>(), readDailyUsage: async (keys: string[]) => keys.map(key => m.counts.get(key) ?? 0) }));
vi.mock('@/lib/try-on/demo-allowance', () => ({ demoDailyBudget: () => 150 }));
import { readSpendSnapshot } from './snapshot';
beforeEach(() => { vi.stubEnv('TRYON_SITE_DAILY_LOOKS', '300'); vi.stubEnv('TRYON_GLOBAL_DAILY_LOOKS', '5000'); vi.stubEnv('MESSENGER_AI_SITE_DAILY_TURNS', '2000'); vi.stubEnv('MESSENGER_AI_GLOBAL_DAILY_TURNS', '50000'); m.ranges.mockClear(); m.counts.clear();
 m.rows = { tryon_shops: [{ shop_domain: 'lulu.myshopify.com', status: 'installed', settings_json: { spend_limits: { tryOnDailyLooks: 5, storeChatDailyTurns: 7 } } }], widget_sites: [{ id: 'site-1', domain: 'lulu.myshopify.com', settings_json: {} }, { id: 'site-2', domain: null, settings_json: { spend_limits: { tryOnDailyLooks: 0 } } }] };
});
afterEach(() => vi.unstubAllEnvs());
it('reads all existing counter namespaces with canonical per-store override precedence', async () => {
 m.counts.set('gc-msgr-ai:{2026-11-11}:all', 40000); m.counts.set('gc-tryon:{2026-11-11}:all', 4500); m.counts.set('gc-demo:{2026-11-11}:spent', 120);
 m.counts.set('gc-msgr-ai:{2026-11-11}:site:site-1', 7); m.counts.set('gc-tryon:{2026-11-11}:site:lulu.myshopify.com', 5);
 const snapshot = await readSpendSnapshot(new Date('2026-11-11T10:00:00Z'));
 expect(snapshot.global).toEqual([{ feature: 'Store Chat', used: 40000, limit: 50000 }, { feature: 'Try-On', used: 4500, limit: 5000 }, { feature: 'Try-On demo', used: 120, limit: 150 }]);
 expect(snapshot.stores).toContainEqual({ store: 'lulu.myshopify.com', feature: 'Store Chat', used: 7, limit: 7 });
 expect(snapshot.stores).toContainEqual({ store: 'lulu.myshopify.com', feature: 'Try-On', used: 5, limit: 5 });
 expect(snapshot.stores).toContainEqual({ store: 'site:site-2', feature: 'Try-On', used: 0, limit: 0 });
});
it('pages past the database response cap and retains stores in the second page', async () => {
 m.rows.widget_sites = Array.from({ length: 501 }, (_, i) => ({ id: 's-' + i, domain: null, settings_json: {} }));
 const result = await readSpendSnapshot(); expect(result.stores).toHaveLength(1003);
 expect(m.ranges).toHaveBeenCalledWith('widget_sites', 500, 999); expect(result.stores).toContainEqual(expect.objectContaining({ store: 'site:s-500', feature: 'Try-On' }));
});
