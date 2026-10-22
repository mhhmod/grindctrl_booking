import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The editor's read (the v16 Set up saves every field at once): a failed
   read throws, where the widget's read falls back to the defaults. */
const db = vi.hoisted(() => ({ result: { data: null as unknown, error: null as { message: string } | null } }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ in: async () => db.result }) }) }),
}));

import { DEFAULT_SETTINGS, getTryOnSettings, getTryOnSettingsForEdit } from './settings';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  db.result = { data: [{ shop: 'maison.myshopify.com', button_label: 'Try it on', radius_px: 12 }], error: null };
});

describe('getTryOnSettingsForEdit', () => {
  it('reads the shop’s own settings over the defaults', async () => {
    const settings = await getTryOnSettingsForEdit('maison.myshopify.com');
    expect(settings).toMatchObject({ buttonLabel: 'Try it on', radiusPx: 12, accentBg: DEFAULT_SETTINGS.accentBg });
  });

  it('throws on a failed read, where the widget’s read shows the defaults', async () => {
    db.result = { data: null, error: { message: 'timeout' } };
    await expect(getTryOnSettingsForEdit('maison.myshopify.com')).rejects.toThrow('timeout');
    await expect(getTryOnSettings('maison.myshopify.com')).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('throws without storage', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(getTryOnSettingsForEdit('maison.myshopify.com')).rejects.toThrow('not configured');
  });
});
