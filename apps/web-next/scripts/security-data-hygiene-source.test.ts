// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => readFileSync(resolve(process.cwd(), '../../supabase', name), 'utf8');

describe('review 2 data hygiene SQL source contracts (not database execution)', () => {
  it('deletes linked leads before losing their conversation and bounds twelve-month cleanup', () => {
    const sql = read('20261112_lead_retention_paste_privacy.sql');
    expect(sql.indexOf('delete from public.widget_leads where conversation_id=p_conversation')).toBeLessThan(sql.indexOf('delete from public.widget_conversations where id = p_conversation'));
    expect(sql).toContain("l.created_at < clock_timestamp()-interval '12 months'");
    expect(sql).toContain('for update of l skip locked');
    expect(sql).toContain("a.detail->>'lead_id'");
    expect(sql).toContain('public.paste_site_connections where widget_site_id = p_site');
    expect(sql).toContain("clock_timestamp()+interval '30 days'");
    expect(sql).not.toContain("interval '48 hours'");
    expect(sql).toContain('public.woo_privacy_storage_queue');
    expect(sql).toContain("'inboxUpdatedAt', c.inbox_updated_at");
    expect(sql).toContain("'inboxHandoffAt', c.inbox_handoff_at");
  });
  it('has no apply-time deletes, drops or truncates and grants every function only to service_role', () => {
    const sql = read('20261112_lead_retention_paste_privacy.sql');
    const withoutBodies = sql.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/--[^\n]*/g, '');
    expect(withoutBodies).not.toMatch(/\b(delete|drop|truncate)\b/i);
    expect(withoutBodies.trim()).toMatch(/^begin;/);
    expect(withoutBodies.trim()).toMatch(/commit;$/);
    expect(sql).toContain('-- Rollback:');
    const functions = [...sql.matchAll(/create or replace function ([\w.]+)\(/g)];
    expect(functions).toHaveLength(9);
    for (const [, name] of functions) {
      expect(sql).toMatch(new RegExp(`revoke all on function ${name.replaceAll('.', '\\.')}\\([^;]*from public,anon,authenticated;`));
      expect(sql).toMatch(new RegExp(`grant execute on function ${name.replaceAll('.', '\\.')}\\([^;]*to service_role;`));
    }
  });
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
