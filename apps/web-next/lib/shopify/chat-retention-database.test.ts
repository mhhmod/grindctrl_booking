// @vitest-environment node
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrivacyDatabase } from './privacy-database-fixture';

type RetentionTask = { conversation_id: string; attachment_paths: string[] };
type Counts = Record<'conversations' | 'messages' | 'attachments' | 'events' | 'feedback' | 'unanswered' | 'pending', number>;

describe('Store Chat retention database contracts', () => {
  let db: PGlite;
  let site: string;
  let visitor: string;

  beforeAll(async () => { db = await createPrivacyDatabase(); }, 60_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec('truncate public.widget_sites cascade');
    site = randomUUID();
    visitor = randomUUID();
    await db.query('insert into public.widget_sites(id,domain) values ($1,$2)', [site, 'retention.myshopify.com']);
    await db.query(`insert into public.widget_visitors(id,widget_site_id,anonymous_id,first_seen_at,last_seen_at)
      values ($1,$2,$3,clock_timestamp()-interval '13 months',clock_timestamp()-interval '13 months')`, [visitor, site, visitor]);
  });

  async function conversation(age = '13 months', owner = visitor) {
    const id = randomUUID();
    await db.query(`insert into public.widget_conversations(id,widget_site_id,visitor_id,started_at,last_message_at)
      values ($1,$2,$3,clock_timestamp()-$4::interval,clock_timestamp()-$4::interval)`, [id, site, owner, age]);
    return id;
  }

  async function batch(claim = randomUUID(), limit = 25) {
    const result = await db.query<RetentionTask>('select * from public.shopify_chat_retention_batch($1,$2)', [limit, claim]);
    return { claim, tasks: result.rows };
  }

  async function finish(task: RetentionTask, claim: string) {
    const result = await db.query<{ counts: Counts }>('select public.shopify_chat_retention_finish($1,$2,$3) as counts',
      [task.conversation_id, claim, task.attachment_paths]);
    return result.rows[0].counts;
  }

  async function resetHistoricalActivity(id: string) {
    // Historical rows predate the trigger. Restore only the explicit retention
    // timestamp, leaving each child's own timestamp available to the recheck.
    await db.query(`update public.widget_conversations set retention_activity_at = null where id=$1`, [id]);
  }

  it('uses twelve calendar months and limits each claim to 25 conversations', async () => {
    const expired: string[] = [];
    for (let index = 0; index < 26; index += 1) expired.push(await conversation('12 months 1 day'));
    const recent = await conversation('12 months -1 day');
    const first = await batch(randomUUID(), 1_000);
    expect(first.tasks).toHaveLength(25);
    expect(first.tasks.every((task) => expired.includes(task.conversation_id))).toBe(true);
    const second = await batch();
    expect(second.tasks).toHaveLength(1);
    expect(second.tasks[0].conversation_id).not.toBe(recent);
    expect((await batch()).tasks).toEqual([]);
    expect((await db.query<{ frozen: null }>('select retention_started_at as frozen from public.widget_conversations where id=$1', [recent])).rows[0].frozen).toBeNull();
  });

  it('rechecks historical child timestamps and preserves a conversation with recent activity', async () => {
    const id = await conversation();
    await db.query(`insert into public.widget_messages(conversation_id,role,content,created_at)
      values ($1,'user','A recent message',clock_timestamp()-interval '1 day')`, [id]);
    await resetHistoricalActivity(id);
    expect((await batch()).tasks).toEqual([]);
    const state = await db.query<{ recent: boolean; frozen: null }>(`select retention_activity_at > clock_timestamp()-interval '2 days' as recent,
      retention_started_at as frozen from public.widget_conversations where id=$1`, [id]);
    expect(state.rows[0]).toEqual({ recent: true, frozen: null });
  });

  it('caps object manifests at 100 and counts only rows actually removed across retries', async () => {
    const id = await conversation();
    await db.query(`insert into public.widget_messages(conversation_id,role,content,created_at)
      values ($1,'user','Expired message',clock_timestamp()-interval '13 months')`, [id]);
    await db.query(`insert into public.messenger_attachments(widget_site_id,conversation_id,storage_path,mime,bytes,sha256,created_at)
      select $1,$2,'retention/' || number || '.jpg','image/jpeg',100,'test-hash',clock_timestamp()-interval '13 months'
      from generate_series(1,101) number`, [site, id]);
    await db.query(`insert into public.widget_events(widget_site_id,conversation_id,event_name,created_at)
      values ($1,$2,'expired-event',clock_timestamp()-interval '13 months')`, [site, id]);
    await db.query(`insert into public.messenger_feedback(widget_site_id,conversation_id,visitor_id,rating,created_at)
      values ($1,$2,$3,'up',clock_timestamp()-interval '13 months')`, [site, id, visitor]);
    await db.query(`insert into public.messenger_unanswered(widget_site_id,conversation_id,question,language,created_at)
      values ($1,$2,'Expired question','en',clock_timestamp()-interval '13 months')`, [site, id]);
    await resetHistoricalActivity(id);

    const first = await batch();
    expect(first.tasks[0].attachment_paths).toHaveLength(100);
    await expect(finish({ ...first.tasks[0], attachment_paths: [] }, first.claim)).rejects.toThrow('chat_retention_claim_lost');
    await expect(finish(first.tasks[0], randomUUID())).rejects.toThrow('chat_retention_claim_lost');
    expect(await finish(first.tasks[0], first.claim)).toEqual({
      conversations: 0, messages: 0, attachments: 100, events: 0, feedback: 0, unanswered: 0, pending: 1,
    });
    await expect(finish(first.tasks[0], first.claim)).rejects.toThrow('chat_retention_claim_lost');
    const second = await batch();
    expect(second.tasks[0].attachment_paths).toHaveLength(1);
    expect(first.tasks[0].attachment_paths).not.toContain(second.tasks[0].attachment_paths[0]);
    expect(await finish(second.tasks[0], second.claim)).toEqual({
      conversations: 1, messages: 1, attachments: 1, events: 1, feedback: 1, unanswered: 1, pending: 0,
    });
    await expect(finish(second.tasks[0], second.claim)).rejects.toThrow('chat_retention_claim_lost');
    expect((await batch()).tasks).toEqual([]);
    expect((await db.query<{ count: number }>('select count(*)::integer as count from public.shopify_chat_retention_tasks')).rows[0].count).toBe(0);
  });

  it('only allows the current unexpired claim to finalize an abandoned task', async () => {
    await conversation();
    const first = await batch();
    await db.exec(`update public.shopify_chat_retention_tasks set claim_until=clock_timestamp()-interval '1 second'`);
    await expect(finish(first.tasks[0], first.claim)).rejects.toThrow('chat_retention_claim_lost');
    const retry = await batch();
    expect(retry.tasks).toEqual(first.tasks);
    await expect(finish(first.tasks[0], first.claim)).rejects.toThrow('chat_retention_claim_lost');
    expect(await finish(retry.tasks[0], retry.claim)).toMatchObject({ conversations: 1, pending: 0 });
  });

  it('renews activity on writes and rejects new or changed activity after a deletion claim', async () => {
    const active = await conversation();
    await db.query(`insert into public.widget_messages(conversation_id,role,content) values ($1,'user','New activity')`, [active]);
    expect((await batch()).tasks).toEqual([]);

    const expired = await conversation();
    const message = randomUUID();
    await db.query(`insert into public.widget_messages(id,conversation_id,role,content,created_at)
      values ($1,$2,'user','Old activity',clock_timestamp()-interval '13 months')`, [message, expired]);
    await resetHistoricalActivity(expired);
    expect((await batch()).tasks.map((task) => task.conversation_id)).toEqual([expired]);
    await expect(db.query(`update public.widget_conversations set last_message_at=clock_timestamp() where id=$1`, [expired])).rejects.toThrow('chat_retention_in_progress');
    await expect(db.query(`update public.widget_messages set content='Changed' where id=$1`, [message])).rejects.toThrow('chat_retention_in_progress');
    await expect(db.query(`insert into public.widget_messages(conversation_id,role,content) values ($1,'user','Too late')`, [expired])).rejects.toThrow('chat_retention_in_progress');
    await expect(db.query(`insert into public.messenger_attachments(widget_site_id,conversation_id,storage_path,mime,bytes,sha256)
      values ($1,$2,'late.jpg','image/jpeg',100,'hash')`, [site, expired])).rejects.toThrow('chat_retention_in_progress');
  });

  it('deletes at most 25 old orphan visitors and preserves visitors with a remaining conversation', async () => {
    const held = visitor;
    const heldConversation = await conversation('1 day');
    const recent = randomUUID();
    await db.query('insert into public.widget_visitors(id,widget_site_id,anonymous_id) values ($1,$2,$3)', [recent, site, recent]);
    await db.query(`insert into public.widget_visitors(widget_site_id,anonymous_id,first_seen_at,last_seen_at)
      select $1,'old-orphan-'||number,clock_timestamp()-interval '13 months',clock_timestamp()-interval '13 months'
      from generate_series(1,26) number`, [site]);
    const sweep = () => db.query<{ count: number }>('select public.shopify_chat_retention_visitors(1000) as count');
    expect((await sweep()).rows[0].count).toBe(25);
    expect((await sweep()).rows[0].count).toBe(1);
    expect((await sweep()).rows[0].count).toBe(0);
    expect((await db.query<{ id: string }>('select id from public.widget_visitors order by id')).rows.map(({ id }) => id).sort()).toEqual([held, recent].sort());
    await db.query('delete from public.widget_conversations where id=$1', [heldConversation]);
    expect((await sweep()).rows[0].count).toBe(1);
    expect((await db.query<{ id: string }>('select id from public.widget_visitors')).rows).toEqual([{ id: recent }]);
  });

  it.each(['anon', 'authenticated'])('denies %s direct access and RPC execution', async (role) => {
    const functions = [
      'shopify_chat_retention_batch(integer,uuid)',
      'shopify_chat_retention_finish(uuid,uuid,text[])',
      'shopify_chat_retention_visitors(integer)',
    ];
    for (const signature of functions) {
      const privileges = await db.query<{ browser: boolean; service: boolean }>(`select
        has_function_privilege($1,$2,'execute') as browser,
        has_function_privilege('service_role',$2,'execute') as service`, [role, `public.${signature}`]);
      expect(privileges.rows[0]).toEqual({ browser: false, service: true });
    }
    const table = await db.query<{ rls: boolean }>(`select relrowsecurity as rls from pg_class where oid='public.shopify_chat_retention_tasks'::regclass`);
    expect(table.rows[0].rls).toBe(true);
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query('select * from public.shopify_chat_retention_tasks')).rejects.toThrow('permission denied');
      await expect(db.query('select public.shopify_chat_retention_visitors(25)')).rejects.toThrow('permission denied');
    } finally {
      await db.exec('reset role');
    }
  });
});
