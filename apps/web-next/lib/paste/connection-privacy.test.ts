// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ result: { data: null as unknown, error: null as { code: string } | null }, select: vi.fn() }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({
  select: (columns: string) => { m.select(columns); return { eq: () => ({ maybeSingle: async () => m.result }) }; },
}) }) }));
import { getPasteConnection } from './store';
beforeEach(() => { vi.clearAllMocks(); m.result = { data: null, error: null }; });
it('reads the stored retention deadline without exposing any secret', async () => {
  m.result.data = { widget_site_id: 'site', platform: 'website', status: 'disconnected', secret_version: 1,
    redact_after: '2026-12-12T12:00:00Z' };
  expect(await getPasteConnection('site')).toMatchObject({ redact_after: '2026-12-12T12:00:00Z', status: 'disconnected' });
  expect(m.select).toHaveBeenCalledWith(expect.stringContaining('redact_after'));
  expect(m.select.mock.calls[0][0]).not.toContain('secret_value');
});
it.each(['42703', 'PGRST204'])('fails closed on missing retention columns (%s), rather than bypassing paste disconnect', async code => {
  m.result.error = { code };
  await expect(getPasteConnection('site')).rejects.toMatchObject({ code: 'schema_not_ready' });
});
it('still identifies a genuinely absent paste table as a non-paste installation', async () => {
  m.result.error = { code: '42P01' };
  expect(await getPasteConnection('site')).toBeNull();
});
