// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const m = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ratelimit', () => ({ pastePlatformCheckRatelimit: { configured: true, limit: m.limit } }));

import { setMessengerServiceClientForTests } from '@/lib/messenger/db';
import { checkPasteDomainPlatform } from './platform-check';
import { pasteDomainOf, readPasteDomainPlatforms, recordPasteDomainPlatform } from './store';

/* The stored platform of a trusted paste domain (widget_domains.platform_detected),
   against a stub table that can be put back to before its migration. */
const SITE = '11111111-1111-4111-8111-111111111111';
const MISSING = { code: '42703', message: 'column widget_domains.platform_detected does not exist' };
const db = {
  rows: [] as Array<Record<string, unknown>>, error: null as { code: string; message: string } | null,
  filters: [] as unknown[][], updates: [] as Array<Record<string, unknown>>,
};
function query(result: () => unknown) {
  const chain: Record<string, unknown> = {};
  for (const name of ['eq', 'in']) chain[name] = (...args: unknown[]) => { db.filters.push([name, ...args]); return chain; };
  chain.then = (resolve: (value: unknown) => void) => resolve(result());
  return chain;
}
const client = {
  from: (table: string) => {
    expect(table).toBe('widget_domains');
    return {
      select: () => query(() => (db.error ? { data: null, error: db.error } : { data: db.rows, error: null })),
      update: (values: Record<string, unknown>) => query(() => {
        db.updates.push(values);
        return { error: db.error };
      }),
    };
  },
} as unknown as SupabaseClient;

let restore: () => void;
beforeEach(() => {
  restore = setMessengerServiceClientForTests(client);
  db.rows = []; db.error = null; db.filters = []; db.updates = [];
  m.limit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 1000 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { restore(); vi.restoreAllMocks(); });

describe('stored platform per trusted domain', () => {
  it('reads each trusted paste domain, unchecked as null and unknown values as custom', async () => {
    db.rows = [
      { domain: 'www.layla-store.com', platform_detected: 'easyorders', platform_detected_at: '2026-11-09T10:00:00Z' },
      { domain: 'layla.example', platform_detected: null, platform_detected_at: null },
      { domain: 'odd.example', platform_detected: 'magento', platform_detected_at: '2026-11-09T10:00:00Z' },
    ];
    const rows = await readPasteDomainPlatforms(SITE);
    expect(rows).toEqual([
      { domain: 'layla-store.com', platform: 'easyorders', detectedAt: '2026-11-09T10:00:00Z' },
      { domain: 'layla.example', platform: null, detectedAt: null },
      { domain: 'odd.example', platform: 'custom', detectedAt: '2026-11-09T10:00:00Z' },
    ]);
    expect(db.filters).toEqual(expect.arrayContaining([['eq', 'widget_site_id', SITE], ['eq', 'verification_status', 'trusted']]));
    expect(pasteDomainOf(rows!, 'www.layla-store.com')?.platform).toBe('easyorders');
    expect(pasteDomainOf(rows!, 'layla-store.com.evil.com')).toBeNull();
  });

  it('reads as not migrated (every domain custom) before the column exists, and fails closed on other errors', async () => {
    db.error = MISSING;
    expect(await readPasteDomainPlatforms(SITE)).toBeNull();
    db.error = { code: 'PGRST204', message: "Could not find the 'platform_detected_at' column in the schema cache" };
    expect(await readPasteDomainPlatforms(SITE)).toBeNull();
    db.error = { code: '42703', message: 'column widget_domains.verification_method does not exist' };
    await expect(readPasteDomainPlatforms(SITE)).rejects.toMatchObject({ code: 'unavailable' });
    db.error = { code: '57014', message: 'canceling statement due to statement timeout' };
    await expect(readPasteDomainPlatforms(SITE)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('records a platform on the domain and its www alias only, and never throws', async () => {
    expect(await recordPasteDomainPlatform(SITE, 'layla-store.com', 'easyorders')).toBe(true);
    expect(db.updates[0]).toMatchObject({ platform_detected: 'easyorders', platform_detected_at: expect.any(String) });
    expect(db.filters).toEqual(expect.arrayContaining([['in', 'domain', ['layla-store.com', 'www.layla-store.com']]]));
    db.error = MISSING;
    expect(await recordPasteDomainPlatform(SITE, 'layla-store.com', 'easyorders')).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
    db.error = { code: '57014', message: 'timeout' };
    expect(await recordPasteDomainPlatform(SITE, 'layla-store.com', 'easyorders')).toBe(false);
    expect(console.error).toHaveBeenCalledWith('[paste] platform not recorded', { code: 'paste_platform_record', site: SITE });
  });
});

describe('checkPasteDomainPlatform', () => {
  const easyOrdersPage = { url: 'https://layla-store.com/', headers: {},
    html: '<html><head><script src="https://cdn.easy-orders.net/_next/static/main.js"></script></head><body></body></html>' };

  it("fingerprints the domain from our own fetch of its home page and stores the result", async () => {
    const fetchPage = vi.fn(async () => easyOrdersPage);
    const record = vi.fn(async () => true);
    expect(await checkPasteDomainPlatform(SITE, 'layla-store.com', { fetchPage, record })).toBe('easyorders');
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith('layla-store.com');
    expect(record).toHaveBeenCalledExactlyOnceWith(SITE, 'layla-store.com', 'easyorders');
    expect(m.limit).toHaveBeenCalledWith('paste-platform:layla-store.com');
  });

  it('stores custom for an unrecognised page, and keeps the stored value when the page cannot be read', async () => {
    const record = vi.fn(async () => true);
    expect(await checkPasteDomainPlatform(SITE, 'shop.example', { fetchPage: async () => ({ ...easyOrdersPage, html: '<html></html>' }), record }))
      .toBe('custom');
    expect(record).toHaveBeenLastCalledWith(SITE, 'shop.example', 'custom');
    record.mockClear();
    expect(await checkPasteDomainPlatform(SITE, 'shop.example', { fetchPage: async () => ({ failure: 'timeout' as const }), record })).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });

  it('does not fetch past the per-domain budget or without rate limiting', async () => {
    const fetchPage = vi.fn(async () => easyOrdersPage);
    m.limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    expect(await checkPasteDomainPlatform(SITE, 'layla-store.com', { fetchPage })).toBeNull();
    m.limit.mockRejectedValue(new Error('redis down'));
    expect(await checkPasteDomainPlatform(SITE, 'layla-store.com', { fetchPage })).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
