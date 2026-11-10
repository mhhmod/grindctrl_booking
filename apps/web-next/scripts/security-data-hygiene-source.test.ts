// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => readFileSync(resolve(process.cwd(), '../../supabase', name), 'utf8');

describe('review 2 data hygiene SQL source contracts (not database execution)', () => {
  it('keeps optional server actors on every plan operation and best-effort audit writes', () => {
    const sql = read('20261110_security_action_audit.sql');
    expect(sql.match(/p_actor_user_id text default null/g)).toHaveLength(4);
    expect(sql).not.toMatch(/\n\s*'owner'[,\n]/);
    expect(sql).toContain('exception when others then');
    for (const action of ['member_role_changed', 'member_removed', 'embed_key_regenerated', 'site_key_regenerated', 'trusted_domain_added', 'trusted_domain_removed', 'store_disconnected', 'manual_credit_grant']) expect(sql).toContain(`'${action}'`);
    expect(sql).toContain('from public,anon,authenticated');
    expect(sql).not.toMatch(/^as \$$|^\$;$/m);
    expect(sql.match(/\$\$/g)).toHaveLength(16);
  });
  it('backfills the same digest used at runtime and leaves plaintext cleanup commented', () => {
    const sql = read('20261110_shop_link_hashes.sql');
    expect(sql).toContain('add column if not exists code_hash');
    expect(sql).toContain('encode(sha256(convert_to(');
    expect(sql).toContain('primary key(code_hash)');
    expect(sql).toContain('-- update public.tryon_shop_links set code = null;');
    expect(sql).not.toMatch(/^update public.tryon_shop_links set code = null;/m);
  });
});
