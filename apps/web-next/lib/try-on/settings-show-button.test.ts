import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/* The storefront Try-On button switch (tryon_settings.show_button) against
   an in-memory table that can be put back to before the migration. */
type DbError = { code: string; message: string };
const db = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  hasColumn: true,
  readError: null as DbError | null,
  upserts: [] as Array<Record<string, unknown>>,
}));
const MISSING_ON_READ = { code: '42703', message: 'column tryon_settings.show_button does not exist' };
const MISSING_ON_WRITE = { code: 'PGRST204', message: "Could not find the 'show_button' column of 'tryon_settings' in the schema cache" };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: (columns: string) => ({
        in: async (_column: string, shops: string[]) => {
          if (db.readError) return { data: null, error: db.readError };
          if (!db.hasColumn && columns.includes('show_button')) return { data: null, error: MISSING_ON_READ };
          return { data: shops.flatMap((shop) => (db.rows.has(shop) ? [{ ...db.rows.get(shop) }] : [])), error: null };
        },
      }),
      upsert: async (payload: Record<string, unknown>) => {
        db.upserts.push({ ...payload });
        if (!db.hasColumn && 'show_button' in payload) return { error: MISSING_ON_WRITE };
        db.rows.set(String(payload.shop), { ...db.rows.get(String(payload.shop)), ...payload });
        return { error: null };
      },
    }),
  }),
}));
const cache = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: cache.invalidate }));

import {
  DEFAULT_SETTINGS,
  getTryOnSettings,
  getTryOnSettingsForEdit,
  mergeSettings,
  readTryOnShowButton,
  saveTryOnSettings,
  TryOnShowButtonUnavailableError,
} from './settings';

const SHOP = 'maison.myshopify.com';
const SITE = 'site:123e4567-e89b-42d3-a456-426614174000';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  db.rows = new Map();
  db.hasColumn = true;
  db.readError = null;
  db.upserts = [];
  cache.invalidate.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('mergeSettings', () => {
  it('reads null and a missing column as on, and false as off', () => {
    expect(DEFAULT_SETTINGS.showButton).toBe(true);
    expect(mergeSettings(DEFAULT_SETTINGS, { shop: SHOP, show_button: null } as never).showButton).toBe(true);
    expect(mergeSettings(DEFAULT_SETTINGS, { shop: SHOP } as never).showButton).toBe(true);
    expect(mergeSettings(DEFAULT_SETTINGS, { shop: SHOP, show_button: false } as never).showButton).toBe(false);
    expect(mergeSettings({ ...DEFAULT_SETTINGS, showButton: false }, { shop: SHOP, show_button: true } as never).showButton).toBe(true);
  });
});

describe('readTryOnShowButton', () => {
  it('is on for a shop with no row or a null value, off when switched off', async () => {
    expect(await readTryOnShowButton(SHOP)).toBe(true);
    db.rows.set(SHOP, { shop: SHOP, show_button: null });
    expect(await readTryOnShowButton(SHOP)).toBe(true);
    db.rows.set(SITE, { shop: SITE, show_button: false });
    expect(await readTryOnShowButton(SITE)).toBe(false);
  });

  it('merges like the settings: the shop row over the global row', async () => {
    db.rows.set('default', { shop: 'default', show_button: false });
    db.rows.set(SHOP, { shop: SHOP, show_button: null });
    expect(await readTryOnShowButton(SHOP)).toBe(false);
    db.rows.set(SHOP, { shop: SHOP, show_button: true });
    expect(await readTryOnShowButton(SHOP)).toBe(true);
  });

  it('is on before the migration and without storage, and throws on any other failed read', async () => {
    db.hasColumn = false;
    expect(await readTryOnShowButton(SHOP)).toBe(true);
    db.readError = { code: '57014', message: 'canceling statement due to statement timeout' };
    await expect(readTryOnShowButton(SHOP)).rejects.toThrow('statement timeout');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(await readTryOnShowButton(SHOP)).toBe(true);
  });
});

describe('settings reads before the migration', () => {
  it('still reads every other setting, with the button on', async () => {
    db.hasColumn = false;
    db.rows.set(SHOP, { shop: SHOP, button_label: 'Try it on', radius_px: 12 });
    expect(await getTryOnSettingsForEdit(SHOP)).toMatchObject({ showButton: true, buttonLabel: 'Try it on', radiusPx: 12 });
    expect(await getTryOnSettings(SHOP)).toMatchObject({ showButton: true, buttonLabel: 'Try it on' });
  });
});

describe('saveTryOnSettings with showButton', () => {
  it('round-trips off and on, and a save without it leaves the switch alone', async () => {
    expect(await saveTryOnSettings(SHOP, { showButton: false })).toBe(true);
    expect((await getTryOnSettingsForEdit(SHOP)).showButton).toBe(false);
    expect(await readTryOnShowButton(SHOP)).toBe(false);

    expect(await saveTryOnSettings(SHOP, { buttonLabel: 'Try me' })).toBe(true);
    expect(db.upserts.at(-1)).not.toHaveProperty('show_button');
    expect(await getTryOnSettingsForEdit(SHOP)).toMatchObject({ showButton: false, buttonLabel: 'Try me' });

    expect(await saveTryOnSettings(SHOP, { showButton: true })).toBe(true);
    expect(await readTryOnShowButton(SHOP)).toBe(true);
  });

  it('clears the cached storefront answer for the shop on every save', async () => {
    await saveTryOnSettings(SITE, { showButton: false });
    expect(cache.invalidate).toHaveBeenCalledWith(SITE);
  });

  it('refuses to turn the button off before the migration, with a typed error and nothing saved', async () => {
    db.hasColumn = false;
    const failure = await saveTryOnSettings(SHOP, { showButton: false, buttonLabel: 'Try me' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TryOnShowButtonUnavailableError);
    expect(failure).toMatchObject({ code: 'show_button_unavailable' });
    expect(db.rows.has(SHOP)).toBe(false);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('saves everything else when an editor sends "on" before the migration', async () => {
    db.hasColumn = false;
    expect(await saveTryOnSettings(SHOP, { showButton: true, buttonLabel: 'Try me' })).toBe(true);
    expect(db.rows.get(SHOP)).toMatchObject({ button_label: 'Try me' });
    expect(db.rows.get(SHOP)).not.toHaveProperty('show_button');
  });
});
