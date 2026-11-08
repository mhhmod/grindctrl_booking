// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ connections: [] as Array<Record<string, unknown>>, plugins: [] as Array<Record<string, unknown>>, error: false }));
function client() {
  return { from: (name: string) => {
    const filters: Array<[string, unknown]> = [];
    const rows = () => (name === 'paste_site_connections' ? m.connections : m.plugins).filter((row) => filters.every(([key, value]) => row[key] === value));
    const b = { select: () => b, eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      limit: async () => ({ data: rows(), error: m.error ? { code: 'outage' } : null }),
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: m.error ? { code: 'outage' } : null }) };
    return b;
  } };
}
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => client() }));
import { isActiveTenant, setShopTokenClientForTests } from '@/lib/shopify/tokens';
const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { m.connections = []; m.plugins = []; m.error = false; setShopTokenClientForTests(client() as unknown as SupabaseClient); });
describe('paste tenant activation and isolation', () => {
  it('makes only the opted-in active site a Try-On tenant', async () => {
    m.connections.push({ widget_site_id: SITE, status: 'active', platform: 'website', secret_version: 1 });
    expect(await isActiveTenant(`site:${SITE}`)).toBe(true);
    expect(await isActiveTenant(`site:${OTHER}`)).toBe(false);
    expect(await isActiveTenant('site:not-a-uuid')).toBe(false);
  });
  it('does not confuse paste and Woo signing identities', async () => {
    m.connections.push({ widget_site_id: SITE, status: 'active', platform: 'website', secret_version: 1 });
    expect(await isActiveTenant(`site:${SITE}`, 'grindctrl-paste')).toBe(true);
    expect(await isActiveTenant(`site:${SITE}`, 'grindctrl-woo')).toBe(false);
    m.connections = []; m.plugins = [{ widget_site_id: SITE, status: 'active' }];
    expect(await isActiveTenant(`site:${SITE}`, 'grindctrl-woo')).toBe(true);
    expect(await isActiveTenant(`site:${SITE}`, 'grindctrl-paste')).toBe(false);
  });
  it('denies disconnected, malformed and unreadable connection state', async () => {
    m.connections.push({ widget_site_id: SITE, status: 'disconnected', platform: 'website', secret_version: 1 });
    expect(await isActiveTenant(`site:${SITE}`)).toBe(false);
    m.connections[0].status = 'active'; m.connections[0].platform = 'unknown';
    expect(await isActiveTenant(`site:${SITE}`)).toBe(false);
    m.error = true; expect(await isActiveTenant(`site:${SITE}`)).toBe(false);
  });
});
