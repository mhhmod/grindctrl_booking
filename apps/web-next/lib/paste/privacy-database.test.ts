// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrivacyDatabase } from '@/lib/shopify/privacy-database-fixture';
import { toWordPressExport } from '@/lib/woo/privacy';

const read = async (name: string) => (await readFile(resolve(process.cwd(), '../../supabase', name), 'utf8')).replace(/^\uFEFF/, '');
let db: PGlite;
let site: string;
let other: string;
let workspace: string;
const migration = '20261112_lead_retention_paste_privacy.sql';
async function value<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ value: T }>(sql, params)).rows[0]?.value;
}
const count = (table: string, id = site) => value<number>(`select count(*)::int as value from public.${table} where widget_site_id=$1`, [id]);
const disconnect = async (id = site) => (await value<{ code: string }>('select public.disconnect_paste_install($1) as value', [id])).code === 'ok';
const redact = (id = site, batch = 100) => value<{ done: boolean; redacted: boolean }>('select public.paste_site_redact($1,$2) as value', [id, batch]);
const due = () => db.query<{ id: string }>('select public.paste_sites_due_for_redaction() as id').then(r => r.rows.map(r => r.id));

beforeAll(async () => {
  db = await createPrivacyDatabase();
  await db.exec(`
    alter table widget_sites add column status text not null default 'active',
      add column updated_at timestamptz default now(), add column settings_json jsonb default '{}',
      add column settings_version integer default 1;
    alter table widget_conversations add column assigned_profile_id uuid;
    create table store_launch(shop_domain text primary key);
    create table widget_domains(id uuid primary key default gen_random_uuid(),
      widget_site_id uuid not null references widget_sites(id) on delete cascade, domain text not null, pattern text not null,
      environment text not null default 'production', verification_status text not null default 'pending',
      verification_method text not null default 'dns_txt', verification_token text, verified_at timestamptz,
      last_checked_at timestamptz, disabled_at timestamptz, created_at timestamptz not null default now());
  `);
  // Actual merchant catalogue declaration; later migrations add product_data.
  const foundation = await read('messenger_foundation.sql');
  const start = foundation.indexOf('create table if not exists public.messenger_knowledge (');
  await db.exec(foundation.slice(start, foundation.indexOf('\n);', start) + 3));
  // Apply real current definitions, including reconnect and the new inbox,
  // product and health fields. Only external parent infrastructure is stubbed.
  for (const file of ['20261104_site_tenants.sql', '20261105_woo_dashboard_plans.sql', '20261105_woo_privacy.sql',
    '20261108_paste_install.sql', '20261109_paste_domain_verification.sql',
    '20260912_messenger_audit_store_disconnected.sql', '20261110_security_action_audit.sql',
    '20261111_messenger_inbox.sql', '20261111_messenger_products.sql',
    '20261110_store_health_signals.sql', '20261111_store_health_alerts.sql',
    '20261111_store_health_spot_missing.sql', '20261111_tryon_job_product_info.sql',
    '20261111_paste_disconnect.sql',
    migration, migration]) await db.exec(await read(file));
  await db.exec('grant select,insert,update,delete on all tables in schema public to service_role');
}, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('truncate public.widget_sites cascade; truncate public.workspaces cascade; truncate public.woo_privacy_storage_queue');
  workspace = randomUUID(); site = randomUUID(); other = randomUUID();
  await db.query('insert into workspaces(id) values ($1)', [workspace]);
  for (const id of [site, other]) {
    await db.query('insert into widget_sites(id,workspace_id) values ($1,$2)', [id, workspace]);
    expect(await value('select enable_paste_install($1,$2,$3) as value', [id, 'website', null])).toBe('enabled');
  }
});

async function shopper(id = site, email = 'shopper@example.com') {
  const visitor = randomUUID(), chat = randomUUID(), lead = randomUUID();
  await db.query(`insert into widget_visitors(id,widget_site_id,anonymous_id,user_email,user_name,metadata)
    values ($1::uuid,$2,$1::text,$3,'Shopper','{"language":"ar"}')`, [visitor, id, email]);
  await db.query(`insert into widget_conversations(id,widget_site_id,visitor_id,status,metadata)
    values ($1,$2,$3,'handoff_requested','{"tags":["exchange"],"cart":{"items":2}}')`, [chat, id, visitor]);
  await db.query(`insert into widget_leads(id,widget_site_id,workspace_id,visitor_id,conversation_id,email,name)
    values ($1,$2,$3,$4,$5,$6,'Shopper')`, [lead, id, workspace, visitor, chat, email]);
  await db.query(`insert into widget_messages(conversation_id,role,content) values ($1,'user','My size?')`, [chat]);
  await db.query(`update widget_messages set metadata='{"internal":true,"note":"Shopper asked about exchange"}' where conversation_id=$1`, [chat]);
  await db.query(`insert into widget_events(widget_site_id,conversation_id,event_name,payload)
    values ($1,$2,'contact','{"email":"shopper@example.com"}')`, [id, chat]);
  await db.query(`insert into messenger_feedback(widget_site_id,conversation_id,visitor_id,rating,comment)
    values ($1,$2,$3,'up','Thanks')`, [id, chat, visitor]);
  await db.query(`insert into messenger_unanswered(widget_site_id,conversation_id,question,language)
    values ($1,$2,'My size?','en')`, [id, chat]);
  await db.query(`insert into messenger_attachments(widget_site_id,conversation_id,storage_path,mime,bytes,sha256)
    values ($1,$2,$3,'image/png',12,'test')`, [id, chat, `${id}/${chat}/photo.png`]);
  await db.query(`insert into messenger_audit(widget_site_id,action,detail) values
    ($1,'contact_captured',jsonb_build_object('leadId',$2::text)),
    ($1,'internal_note_added',jsonb_build_object('conversationId',$3::text))`, [id, lead, chat]);
  return { visitor, chat, lead };
}

describe('G17 real SQL over current main', () => {
  it('runs the migration twice without deleting existing shopper rows or moving deadlines', async () => {
    await shopper(); await disconnect();
    const deadline = await value('select redact_after::text as value from paste_site_connections where widget_site_id=$1', [site]);
    await db.exec(await read(migration)); await db.exec(await read(migration));
    expect(await count('widget_conversations')).toBe(1);
    expect(await value('select redact_after::text as value from paste_site_connections where widget_site_id=$1', [site])).toBe(deadline);
  });
  it('schedules exactly thirty days and repeated disconnect does not postpone deletion', async () => {
    expect(await disconnect()).toBe(true);
    expect(await value<boolean>(`select redact_after-disconnected_at between interval '30 days -1 second' and interval '30 days 1 second' as value
      from paste_site_connections where widget_site_id=$1`, [site])).toBe(true);
    const before = await value('select redact_after::text as value from paste_site_connections where widget_site_id=$1', [site]);
    expect(await disconnect()).toBe(false);
    expect(await value('select redact_after::text as value from paste_site_connections where widget_site_id=$1', [site])).toBe(before);
  });
  it.each(['website', 'shopify'])('reconnect within thirty days cancels %s removal even for a stale listed task', async platform => {
    if (platform === 'shopify') {
      await db.query(`update paste_site_connections set platform='shopify',shop_domain='reconnect.myshopify.com',status='pending' where widget_site_id=$1`, [site]);
    }
    await shopper(); await disconnect();
    await db.query(`update paste_site_connections set disconnected_at=now()-interval '29 days',redact_after=now()+interval '1 day' where widget_site_id=$1`, [site]);
    expect(await value('select enable_paste_install($1,$2,$3) as value', [site, platform, platform === 'shopify' ? 'reconnect.myshopify.com' : null])).toBe('enabled');
    expect(await value('select redact_after as value from paste_site_connections where widget_site_id=$1', [site])).toBeNull();
    expect(await value('select status as value from widget_sites where id=$1', [site])).toBe('active');
    expect(await due()).not.toContain(site);
    expect(await redact()).toMatchObject({ redacted: false });
    expect(await count('widget_conversations')).toBe(1);
  });
  it.each(['website', 'shopify'])('lets a disabled %s paste site enable another shop through both applied migrations', async platform => {
    if (platform === 'shopify') {
      await disconnect();
      expect(await value('select enable_paste_install($1,$2,$3) as value', [site, 'shopify', 'old.myshopify.com'])).toBe('enabled');
    }
    await shopper();
    await db.exec('set role service_role');
    try {
      expect(await disconnect()).toBe(true);
      expect(await value('select status as value from widget_sites where id=$1', [site])).toBe('disabled');
      expect(await value('select redact_after is not null as value from paste_site_connections where widget_site_id=$1', [site])).toBe(true);
      expect(await value('select enable_paste_install($1,$2,$3) as value', [site, 'shopify', 'another.myshopify.com'])).toBe('enabled');
      expect(await value('select row_to_json(c) as value from paste_site_connections c where widget_site_id=$1', [site]))
        .toMatchObject({ status: 'pending', shop_domain: 'another.myshopify.com', redact_after: null, redacted_at: null });
      expect(await value('select status as value from widget_sites where id=$1', [site])).toBe('active');
      expect(await due()).not.toContain(site);
      expect(await redact()).toMatchObject({ redacted: false });
      expect(await count('widget_conversations')).toBe(1);
    } finally { await db.exec('reset role'); }
  });
  it('does not schedule owner deletion for a shop displaced by another install', async () => {
    await db.query(`update paste_site_connections set status='disconnected',disconnected_reason='displaced',disconnected_at=now() where widget_site_id=$1`, [site]);
    expect(await value('select redact_after as value from paste_site_connections where widget_site_id=$1', [site])).toBeNull();
    expect(await redact()).toMatchObject({ redacted: false });
  });
  it('refuses removal before thirty days and redacts in bounded batches once due, keeping another tenant', async () => {
    const first = await shopper(), second = await shopper(), untouched = await shopper(other);
    expect(await disconnect()).toBe(true);
    // The server action audits after the RPC. Keep merchant history while
    // removing shopper-linked audit entries, just as the applied SQL promises.
    await db.query(`insert into messenger_audit(widget_site_id,actor_clerk_user_id,action,detail)
      values ($1,'clerk_owner','store_disconnected','{"install":"paste"}')`, [site]);
    expect(await value('select status as value from widget_sites where id=$1', [site])).toBe('disabled');
    await db.query(`update paste_site_connections set disconnected_at=now()-interval '29 days',redact_after=now()+interval '1 day' where widget_site_id=$1`, [site]);
    expect(await due()).not.toContain(site);
    expect(await redact()).toMatchObject({ redacted: false });
    expect(await count('widget_conversations')).toBe(2);
    await db.query(`update paste_site_connections set disconnected_at=now()-interval '30 days 1 second',redact_after=now()-interval '1 second' where widget_site_id=$1`, [site]);
    expect(await due()).toContain(site);
    expect(await redact(site, 1)).toMatchObject({ redacted: true, done: false });
    expect(await count('widget_conversations')).toBe(1);
    expect(await redact(site, 1)).toMatchObject({ redacted: true, done: true });
    for (const table of ['widget_conversations','widget_visitors','widget_leads','widget_events','messenger_attachments','messenger_feedback','messenger_unanswered']) {
      expect(await count(table)).toBe(0);
      expect(await count(table, other)).toBe(1);
    }
    expect(await value('select count(*)::int as value from widget_messages where conversation_id=any($1::uuid[])', [[first.chat, second.chat]])).toBe(0);
    expect(await value('select count(*)::int as value from widget_messages where conversation_id=$1', [untouched.chat])).toBe(1);
    expect(await value<number>('select count(*)::int as value from woo_privacy_storage_queue where widget_site_id=$1', [site])).toBe(2);
    expect(await count('woo_privacy_storage_queue', other)).toBe(0);
    expect(await count('messenger_audit', other)).toBe(2);
    expect(await count('messenger_audit')).toBe(1);
    expect(await value('select action as value from messenger_audit where widget_site_id=$1', [site])).toBe('store_disconnected');
    expect(await value('select status as value from widget_sites where id=$1', [other])).toBe('active');
    expect(await redact()).toMatchObject({ redacted: false });
  });
  it('exports current inbox fields, contact, events and audit, then erases every linked shopper table', async () => {
    await shopper(); await shopper(other);
    const payload = await value<Parameters<typeof toWordPressExport>[0]>('select woo_privacy_export($1,$2) as value', [site, 'SHOPPER@example.com']);
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0]).toMatchObject({ inboxUpdatedAt: expect.any(String), inboxHandoffAt: expect.any(String),
      metadata: { tags: ['exchange'], cart: { items: 2 } }, events: [expect.objectContaining({ name: 'contact' })],
      audit: [expect.objectContaining({ action: 'internal_note_added' })] });
    expect(payload.visitors).toHaveLength(1); expect(payload.leads).toHaveLength(1);
    expect(payload.leads[0]).toMatchObject({ audit: [expect.objectContaining({ action: 'contact_captured' })] });
    const exported = JSON.stringify(toWordPressExport(payload));
    expect(exported).toContain('Inbox updated'); expect(exported).toContain('Handoff requested'); expect(exported).toContain('Conversation activity');
    expect(exported).toContain('Contact activity'); expect(exported).toContain('Shopper asked about exchange');
    expect(await value('select woo_privacy_erase($1,$2) as value', [site, 'shopper@example.com'])).toMatchObject({ remaining: 0 });
    for (const table of ['widget_conversations','widget_visitors','widget_leads','widget_events','messenger_attachments','messenger_feedback','messenger_unanswered','messenger_audit']) expect(await count(table)).toBe(0);
    expect(await count('widget_conversations', other)).toBe(1);
    expect(await value<number>('select count(*)::int as value from woo_privacy_storage_queue where widget_site_id=$1', [site])).toBe(1);
  });
  it('matches an email captured only on a lead and removes lead audit aliases', async () => {
    const { visitor } = await shopper();
    await db.query('update widget_visitors set user_email=null where id=$1', [visitor]);
    expect(await value('select woo_privacy_export($1,$2) as value', [site, 'shopper@example.com'])).toMatchObject({ total: 1 });
    expect(await value('select woo_privacy_erase($1,$2) as value', [site, 'shopper@example.com'])).toMatchObject({ remaining: 0, counts: { conversations: 1 } });
    expect(await count('messenger_audit')).toBe(0);
  });
  it('keeps a lead-only email match until every linked conversation batch has been erased', async () => {
    const { visitor } = await shopper();
    await db.query('update widget_visitors set user_email=null where id=$1', [visitor]);
    await db.query(`insert into widget_conversations(widget_site_id,visitor_id) values ($1,$2)`, [site, visitor]);
    expect(await value('select woo_privacy_erase($1,$2,1) as value', [site, 'shopper@example.com']))
      .toMatchObject({ remaining: 1, counts: { conversations: 1, leads: 0 } });
    expect(await count('widget_leads')).toBe(1);
    expect(await value('select woo_privacy_erase($1,$2,1) as value', [site, 'shopper@example.com']))
      .toMatchObject({ remaining: 0, counts: { conversations: 1, leads: 1, visitors: 1 } });
    expect(await count('widget_conversations')).toBe(0);
    expect(await count('messenger_audit')).toBe(0);
  });
  it('exports and erases detached contact audit without requiring a conversation', async () => {
    const lead = randomUUID();
    await db.query(`insert into widget_leads(id,widget_site_id,workspace_id,email) values ($1,$2,$3,'contact@example.com')`, [lead, site, workspace]);
    await db.query(`insert into messenger_audit(widget_site_id,action,detail) values ($1,'contact_captured',jsonb_build_object('lead_id',$2::text))`, [site, lead]);
    const payload = await value<Parameters<typeof toWordPressExport>[0]>('select woo_privacy_export($1,$2) as value', [site, 'contact@example.com']);
    expect(payload).toMatchObject({ total: 0, done: true, leads: [expect.objectContaining({ audit: [expect.objectContaining({ action: 'contact_captured' })] })] });
    expect(JSON.stringify(toWordPressExport(payload))).toContain('Contact activity');
    expect(await value('select woo_privacy_erase($1,$2) as value', [site, 'contact@example.com']))
      .toMatchObject({ remaining: 0, counts: { leads: 1 } });
    expect(await count('messenger_audit')).toBe(0);
  });
  it('keeps merchant product cache and operational health data out of shopper export/erase/redaction', async () => {
    await shopper();
    await db.query(`insert into messenger_knowledge(widget_site_id,title,content,source,product_data)
      values ($1,'Dress','Cotton','manual','{"title":"Dress"}')`, [site]);
    await db.query(`insert into store_health_signals(site_id,day,metric,count) values ($1,current_date,'pills',4)`, [site]);
    await db.query(`insert into store_health_alerts(site_id,problem_key) values ($1,'store_chat_down')`, [site]);
    const exported = await value<Record<string, unknown>>('select woo_privacy_export($1,$2) as value', [site, 'shopper@example.com']);
    expect(exported).not.toHaveProperty('products'); expect(exported).not.toHaveProperty('health');
    await value('select woo_privacy_erase($1,$2) as value', [site, 'shopper@example.com']);
    await disconnect();
    await db.query(`update paste_site_connections set redact_after=now()-interval '1 second' where widget_site_id=$1`, [site]);
    await redact();
    expect(await count('messenger_knowledge')).toBe(1);
    for (const table of ['store_health_signals','store_health_alerts']) expect(await value<number>(`select count(*)::int as value from ${table} where site_id=$1`, [site])).toBe(1);
  });
  it('retains the Woo uninstall grace and does not send plugin sites to the paste worker', async () => {
    await db.query(`insert into woo_site_connections(widget_site_id,status,platform,home_url,plugin_version,redact_after)
      values ($1,'disconnected','woocommerce','https://plugin.example','0.3.5',now()+interval '48 hours')`, [site]);
    expect(await value<boolean>(`select redact_after > now()+interval '47 hours' as value from woo_site_connections where widget_site_id=$1`, [site])).toBe(true);
    expect(await value('select woo_site_redact($1) as value', [site])).toMatchObject({ redacted: false });
    expect(await due()).not.toContain(site);
  });
  it('bounds expired lead cleanup and keeps recent leads even when detached', async () => {
    await shopper();
    await db.query(`update widget_leads set created_at=now()-interval '13 months' where widget_site_id=$1`, [site]);
    for (let i = 0; i < 2; i++) await db.query(`insert into widget_leads(widget_site_id,workspace_id,email,created_at)
      values ($1,$2,'old@example.com',now()-interval '13 months')`, [site, workspace]);
    await db.query(`insert into widget_leads(widget_site_id,workspace_id,email) values ($1,$2,'recent@example.com')`, [site, workspace]);
    await value('select shopify_chat_retention_visitors(1) as value');
    expect(await count('widget_leads')).toBe(3);
    await value('select shopify_chat_retention_visitors(25) as value');
    expect(await count('widget_leads')).toBe(1);
    expect(await count('widget_conversations')).toBe(1);
    expect(await value<number>(`select count(*)::int as value from messenger_audit where widget_site_id=$1 and detail ? 'leadId'`, [site])).toBe(0);
  });
  it('deletes linked leads and both audit key styles before conversation FK links disappear', async () => {
    const { chat } = await shopper();
    await db.query(`insert into messenger_audit(widget_site_id,action,detail)
      values ($1,'internal_note_added',jsonb_build_object('conversationId',$2::text))`, [other, chat]);
    await db.query(`update widget_conversations set status='closed',started_at=now()-interval '13 months',last_message_at=now()-interval '13 months',closed_at=now()-interval '13 months',retention_activity_at=null where id=$1`, [chat]);
    for (const table of ['widget_messages','widget_events','messenger_feedback','messenger_unanswered','messenger_attachments','widget_leads']) {
      await db.query(`update ${table} set created_at=now()-interval '13 months' where conversation_id=$1`, [chat]);
    }
    // Historical data predates the inbox trigger. Avoid inventing a new
    // activity timestamp while restoring that historical fixture.
    await db.exec('alter table widget_conversations disable trigger messenger_inbox_changed');
    try { await db.query('update widget_conversations set retention_activity_at=null where id=$1', [chat]); }
    finally { await db.exec('alter table widget_conversations enable trigger messenger_inbox_changed'); }
    const claim = randomUUID();
    const task = (await db.query<{ conversation_id: string; attachment_paths: string[] }>('select * from shopify_chat_retention_batch(25,$1)', [claim])).rows[0];
    expect(task.conversation_id).toBe(chat);
    await value('select shopify_chat_retention_finish($1,$2,$3) as value', [chat, claim, task.attachment_paths]);
    expect(await count('widget_leads')).toBe(0); expect(await count('messenger_audit')).toBe(0);
    expect(await count('messenger_audit', other)).toBe(1);
  });
  it('allows only service_role to execute every G17 function', async () => {
    for (const signature of ['shopify_chat_retention_finish(uuid,uuid,text[])','shopify_chat_retention_visitors(integer)',
      'woo_privacy_matches(uuid,text)','woo_privacy_export(uuid,text,integer,integer)','woo_privacy_erase(uuid,text,integer)',
      'disconnect_paste_site(uuid,text)','paste_site_redact(uuid,integer)','paste_sites_due_for_redaction(integer)',
      'grindctrl_paste_private.privacy_schedule()']) {
      for (const role of ['anon','authenticated','service_role']) {
        expect(await value<boolean>('select has_function_privilege($1,$2,\'EXECUTE\') as value', [role, signature])).toBe(role === 'service_role');
      }
    }
    await db.exec('set role service_role');
    try { expect(await disconnect()).toBe(true); } finally { await db.exec('reset role'); }
  });
});
