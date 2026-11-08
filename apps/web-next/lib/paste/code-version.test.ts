// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

import { setMessengerServiceClientForTests } from '@/lib/messenger/db';
import { readPasteCodeVersion, recordPasteCodeVersion, resetRecordedPasteCodeVersions } from './store';

/* Which pasted snippet a store runs (paste_site_connections.code_version),
   against a stub table that can be put back to before its migration. */
const SITE = '11111111-1111-4111-8111-111111111111';
const MISSING = { code: '42703', message: 'column paste_site_connections.code_version does not exist' };
const db = { row: null as Record<string, unknown> | null, error: null as { code: string; message: string } | null,
  updates: [] as Array<{ values: Record<string, unknown>; filter: string }> };

const client = {
  from: (table: string) => {
    expect(table).toBe('paste_site_connections');
    return {
      select: () => ({ eq: (_c: string, site: string) => ({ maybeSingle: async () => {
        expect(site).toBe(SITE);
        return db.error ? { data: null, error: db.error } : { data: db.row, error: null };
      } }) }),
      update: (values: Record<string, unknown>) => ({ eq: () => ({ or: async (filter: string) => {
        db.updates.push({ values, filter });
        if (db.error) return { error: db.error };
        db.row = { ...db.row, ...values };
        return { error: null };
      } }) }),
    };
  },
} as unknown as SupabaseClient;

let restore: () => void;
beforeEach(() => {
  restore = setMessengerServiceClientForTests(client);
  resetRecordedPasteCodeVersions();
  db.row = { code_version: null, code_version_seen_at: null };
  db.error = null;
  db.updates = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restore(); vi.restoreAllMocks(); });

describe('pasted snippet version', () => {
  it('records a version only when it differs, and reads it back', async () => {
    expect(await readPasteCodeVersion(SITE)).toBeNull();
    await recordPasteCodeVersion(SITE, 1);
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].filter).toBe('code_version.is.null,code_version.neq.1');
    expect(await readPasteCodeVersion(SITE)).toMatchObject({ version: 1, seenAt: expect.any(String) });
    // The same version again does not write on every render.
    await recordPasteCodeVersion(SITE, 1);
    expect(db.updates).toHaveLength(1);
    await recordPasteCodeVersion(SITE, 2);
    expect(db.updates).toHaveLength(2);
    expect((await readPasteCodeVersion(SITE))?.version).toBe(2);
  });

  it('ignores a version out of range', async () => {
    for (const version of [0, 100, 1.5, Number.NaN]) await recordPasteCodeVersion(SITE, version);
    expect(db.updates).toHaveLength(0);
  });

  it('tolerates the migration being absent: reads null, records nothing, and stops retrying', async () => {
    db.error = MISSING;
    expect(await readPasteCodeVersion(SITE)).toBeNull();
    await recordPasteCodeVersion(SITE, 1);
    await recordPasteCodeVersion(SITE, 1);
    expect(db.updates).toHaveLength(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('never throws from a render on a database failure, and retries next time', async () => {
    db.error = { code: '08006', message: 'connection failure' };
    await expect(recordPasteCodeVersion(SITE, 2)).resolves.toBeUndefined();
    await recordPasteCodeVersion(SITE, 2);
    expect(db.updates).toHaveLength(2);
    expect(console.error).toHaveBeenCalledWith('[paste] code version not recorded', { code: 'paste_code_version', site: SITE });
    await expect(readPasteCodeVersion(SITE)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
