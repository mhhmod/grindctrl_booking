// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => readFileSync(resolve(process.cwd(), '../../supabase', name), 'utf8');

describe('review 2 data hygiene SQL source contracts (not database execution)', () => {
  it('extends the audit action list without touching any function or removing data', () => {
    const sql = read('20261110_security_action_audit.sql');
    for (const action of ['member_role_changed', 'member_removed', 'site_key_regenerated', 'trusted_domain_added', 'trusted_domain_removed', 'manual_credit_grant', 'manual_plan_changed', 'order_lookup_performed']) expect(sql).toContain(`'${action}'`);
    expect(sql).not.toMatch(/create (or replace )?function|drop function|delete from|drop table|drop column/i);
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
