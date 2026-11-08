import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/* The product card pill switch (tryon_settings.show_card_pill) against an
   in-memory table where either switch column can be missing, as before its
   migration runs. */
type DbError = { code: string; message: string };
const db = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  missing: new Set<string>(),
  selects: [] as string[],
  upserts: [] as Array<Record<string, unknown>>,
}));
const onRead = (column: string): DbError => ({ code: '42703', message: `column tryon_settings.${column} does not exist` });
const onWrite = (column: string): DbError => ({ code: 'PGRST204', message: `Could not find the '${column}' column of 'tryon_settings' in the schema cache` });

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: (columns: string) => ({
        in: async (_column: string, shops: string[]) => {
          db.selects.push(columns);
          const absent = [...db.missing].find((column) => columns.split(', ').includes(column));
          if (absent) return { data: null, error: onRead(absent) };
          return { data: shops.flatMap((shop) => (db.rows.has(shop) ? [{ ...db.rows.get(shop) }] : [])), error: null };
        },
      }),
      upsert: async (payload: Record<string, unknown>) => {
        db.upserts.push({ ...payload });
        const absent = [...db.missing].find((column) => column in payload);
        if (absent) return { error: onWrite(absent) };
        db.rows.set(String(payload.shop), { ...db.rows.get(String(payload.shop)), ...payload });
        return { error: null };
      },
    }),
  }),
}));
vi.mock('@/lib/shopify/proxy-config-cache', () => ({ invalidateProxyConfig: vi.fn() }));

import { DEFAULT_SETTINGS, getTryOnSettings, getTryOnSettingsForEdit, mergeSettings, readTryOnShowButton, saveTryOnSettings,
  TryOnShowButtonUnavailableError, TryOnShowCardPillUnavailableError, TryOnSwitchUnavailableError } from './settings';
import { cardPillsOn } from './card-pill';

const SHOP = 'maison.myshopify.com';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  db.rows = new Map();
  db.missing = new Set();
  db.selects = [];
  db.upserts = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the card pill switch', () => {
  it('is on by default, and the shop row wins over the global row', async () => {
    expect(DEFAULT_SETTINGS.showCardPill).toBe(true);
    expect((await getTryOnSettings(SHOP)).showCardPill).toBe(true);
    db.rows.set('default', { shop: 'default', show_card_pill: false });
    expect((await getTryOnSettings(SHOP)).showCardPill).toBe(false);
    db.rows.set(SHOP, { shop: SHOP, show_card_pill: true });
    expect((await getTryOnSettings(SHOP)).showCardPill).toBe(true);
    expect(mergeSettings(DEFAULT_SETTINGS, { shop: SHOP, show_card_pill: null } as never).showCardPill).toBe(true);
  });

  it('reads the rest, with the pills on, before its migration ran', async () => {
    db.missing.add('show_card_pill');
    db.rows.set(SHOP, { shop: SHOP, show_button: false, accent_bg: '#123456' });
    const settings = await getTryOnSettingsForEdit(SHOP);
    expect(settings).toMatchObject({ showCardPill: true, showButton: false, accentBg: '#123456' });
    expect(db.selects.at(-1)).not.toContain('show_card_pill');
    expect(db.selects.at(-1)).toContain('show_button');
  });

  it('reads the rest before either switch migration ran', async () => {
    db.missing = new Set(['show_button', 'show_card_pill']);
    db.rows.set(SHOP, { shop: SHOP, accent_bg: '#123456' });
    expect(await getTryOnSettingsForEdit(SHOP)).toMatchObject({ showCardPill: true, showButton: true, accentBg: '#123456' });
    expect(await readTryOnShowButton(SHOP)).toBe(true);
  });

  it('saves only when sent, and never touches the main switch', async () => {
    expect(await saveTryOnSettings(SHOP, { showCardPill: false })).toBe(true);
    expect(db.upserts.at(-1)).toMatchObject({ shop: SHOP, show_card_pill: false });
    expect(db.upserts.at(-1)).not.toHaveProperty('show_button');
    await saveTryOnSettings(SHOP, { accentBg: '#000000' });
    expect(db.upserts.at(-1)).not.toHaveProperty('show_card_pill');
    expect((await getTryOnSettings(SHOP)).showCardPill).toBe(false);
  });

  it('refuses to look saved when turned off before its migration, and drops an "on" so the rest saves', async () => {
    db.missing.add('show_card_pill');
    const failure = await saveTryOnSettings(SHOP, { showCardPill: false, accentBg: '#000000' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TryOnShowCardPillUnavailableError);
    expect(failure).toBeInstanceOf(TryOnSwitchUnavailableError);
    expect((failure as TryOnSwitchUnavailableError).code).toBe('show_card_pill_unavailable');
    expect(db.rows.has(SHOP)).toBe(false);

    expect(await saveTryOnSettings(SHOP, { showCardPill: true, showButton: false, accentBg: '#000000' })).toBe(true);
    expect(db.rows.get(SHOP)).toMatchObject({ show_button: false, accent_bg: '#000000' });
    expect(db.rows.get(SHOP)).not.toHaveProperty('show_card_pill');
  });

  it('names the switch that cannot be saved when both migrations are missing', async () => {
    db.missing = new Set(['show_button', 'show_card_pill']);
    await expect(saveTryOnSettings(SHOP, { showButton: false, showCardPill: true })).rejects.toBeInstanceOf(TryOnShowButtonUnavailableError);
    expect(await saveTryOnSettings(SHOP, { showButton: true, showCardPill: true, accentBg: '#000000' })).toBe(true);
    expect(db.rows.get(SHOP)).toEqual(expect.objectContaining({ accent_bg: '#000000' }));
  });
});

describe('cardPillsOn, the one rule every storefront config applies', () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])('showButton %s and showCardPill %s show pills: %s', (showButton, showCardPill, shown) => {
    expect(cardPillsOn({ showButton, showCardPill })).toBe(shown);
  });
});
