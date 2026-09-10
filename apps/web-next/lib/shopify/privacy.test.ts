// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const { from, remove, storageFrom, sendData, sendAlert } = vi.hoisted(() => ({
  from: vi.fn(), remove: vi.fn(), storageFrom: vi.fn(), sendData: vi.fn(), sendAlert: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from, storage: { from: storageFrom } })) }));
vi.mock('@/lib/email/shopify-privacy-sender', () => ({ sendShopifyDataRequest: sendData, sendShopifyPrivacyAlert: sendAlert }));

import { createClient } from '@supabase/supabase-js';
import { processShopifyPrivacyRequest } from './privacy';

const SHOP = 'demo.myshopify.com';
const INPUT = {
  webhookId: 'delivery-1', topic: 'customers/redact' as const, shopDomain: SHOP,
  payload: { shop_domain: SHOP, customer: { email: 'Customer@example.com', id: 123 } },
};
let tables: Record<string, Row[]>;
let events: string[];
let errors: Record<string, string[]>;
let selections: Array<{ table: string; columns: string }>;

// A small in-memory Supabase boundary: preserves rows, uniqueness, filters,
// and a two-row server cap so incomplete pagination cannot silently pass.
function query(table: string) {
  let action = 'select';
  let values: Row = {};
  let columns = '*';
  const filters: Array<(row: Row) => boolean> = [];
  let start = 0;
  let end = 1;
  let single = false;
  const builder = {
    select: vi.fn((value = '*') => { columns = value; return builder; }),
    upsert: vi.fn((value: Row, options: unknown) => {
      expect(options).toEqual({ onConflict: 'webhook_id', ignoreDuplicates: true });
      action = 'upsert'; values = value; return builder;
    }),
    update: vi.fn((value: Row) => { action = 'update'; values = value; return builder; }),
    delete: vi.fn(() => { action = 'delete'; return builder; }),
    eq: vi.fn((key: string, value: unknown) => { filters.push((row) => row[key] === value); return builder; }),
    ilike: vi.fn((key: string, pattern: string) => {
      let source = '';
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '\\') source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        else if (char === '%' || char === '*') source += '.*';
        else if (char === '_') source += '.';
        else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      const re = new RegExp(`^${source}$`, 'i');
      filters.push((row) => typeof row[key] === 'string' && re.test(row[key] as string));
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn((a: number, b: number) => { start = a; end = Math.min(b, a + 1); return builder; }),
    returns: vi.fn(() => builder),
    maybeSingle: vi.fn(() => { single = true; return builder; }),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
      events.push(`${table}:${action}`);
      const error = errors[`${table}:${action}`]?.shift();
      if (error) return { data: null, error: { message: error } };
      const rows = tables[table] ??= [];
      let matches = rows.filter((row) => filters.every((filter) => filter(row)));
      if (action === 'upsert') {
        if (rows.some((row) => row.webhook_id === values.webhook_id)) matches = [];
        else {
          const row = { id: 'request-1', attempts: 0, status: 'received', processed_at: null, ...values };
          rows.push(row); matches = [row];
        }
      } else if (action === 'update') matches.forEach((row) => Object.assign(row, values));
      else if (action === 'delete') {
        // Match tryon_credit_ledger.job_id's ON DELETE RESTRICT FK.
        if (table === 'tryon_jobs' && (tables.tryon_credit_ledger ?? []).some((entry) =>
          entry.job_id != null && matches.some((job) => job.id === entry.job_id))) {
          return { data: null, error: { code: '23503', message: 'tryon_credit_ledger.job_id still references tryon_jobs.id' } };
        }
        tables[table] = rows.filter((row) => !matches.includes(row));
      }
      else {
        selections.push({ table, columns });
        matches = matches.slice(start, end + 1);
      }
      const data = matches.map((row) => columns === '*' ? { ...row }
        : Object.fromEntries(columns.split(',').map((key) => [key.trim(), row[key.trim()]])));
      return { data: single ? data[0] ?? null : data, error: null };
    }).then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('SHOPIFY_PRIVACY_PROCESSING_ENABLED', 'true');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  tables = {
    widget_sites: [{ id: 'site-1', domain: SHOP }, { id: 'site-other', domain: 'other.myshopify.com' }],
    widget_visitors: [
      { id: 'visitor-1', widget_site_id: 'site-1', anonymous_id: 'anon-1', user_email: 'customer@example.com', user_name: 'Sara' },
      { id: 'visitor-2', widget_site_id: 'site-1', user_email: 'CUSTOMER@EXAMPLE.COM' },
      { id: 'visitor-other', widget_site_id: 'site-other', user_email: 'customer@example.com' },
      { id: 'visitor-unrelated', widget_site_id: 'site-1', user_email: 'unrelated@example.com' },
    ],
    widget_conversations: [{ id: 'conversation-1', widget_site_id: 'site-1', visitor_id: 'visitor-1', status: 'closed' }],
    widget_messages: [{ id: 'message-1', conversation_id: 'conversation-1', role: 'user', content: 'hello', created_at: '2026-09-09' }],
    messenger_feedback: [{ id: 'feedback-1', conversation_id: 'conversation-1', rating: 5, comment: 'helpful' }],
    messenger_attachments: [{ id: 'attachment-1', widget_site_id: 'site-1', conversation_id: 'conversation-1', storage_path: 'site-1/photo.png' }],
    tryon_shops: [{ shop_domain: SHOP, owner_clerk_user_id: 'user-owner' }],
    profiles: [{ clerk_user_id: 'user-owner', email: 'merchant@example.com' }],
  };
  errors = {}; events = []; selections = [];
  from.mockImplementation(query);
  storageFrom.mockReturnValue({ remove });
  remove.mockImplementation(async () => { events.push('storage:remove'); return { data: [], error: null }; });
  sendData.mockResolvedValue({ sent: true });
  sendAlert.mockResolvedValue({ sent: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function recorded() { return tables.shopify_privacy_requests[0]; }

describe('durable Shopify privacy requests', () => {
  it.each([undefined, '', 'false', 'TRUE', ' true ', '1'])(
    'records without compiling or deleting when the flag is %s', async (flag) => {
      vi.stubEnv('SHOPIFY_PRIVACY_PROCESSING_ENABLED', flag);
      await processShopifyPrivacyRequest(INPUT);
      expect(recorded()).toMatchObject({ webhook_id: INPUT.webhookId, payload: INPUT.payload, status: 'received', attempts: 0, processed_at: null });
      expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'disabled', to: ['merchant@example.com'] }));
      expect(events.filter((event) => event.endsWith(':delete'))).toEqual([]);
      expect(from).not.toHaveBeenCalledWith('widget_visitors');
      expect(remove).not.toHaveBeenCalled();
      expect(sendData).not.toHaveBeenCalled();
      expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key', { auth: { persistSession: false } });
    },
  );

  it.each(['received', 'completed', 'failed'])('does nothing on a redelivery of a %s request', async (status) => {
    tables.shopify_privacy_requests = [{ webhook_id: INPUT.webhookId, status, payload: { original: true }, attempts: 1 }];
    await processShopifyPrivacyRequest(INPUT);
    expect(tables.shopify_privacy_requests).toEqual([{ webhook_id: INPUT.webhookId, status, payload: { original: true }, attempts: 1 }]);
    expect(events).toEqual(['shopify_privacy_requests:upsert']);
    expect(sendAlert).not.toHaveBeenCalled();
    expect(sendData).not.toHaveBeenCalled();
  });

  it('claims simultaneous deliveries only once', async () => {
    await Promise.all([processShopifyPrivacyRequest({ ...INPUT, topic: 'customers/data_request' }), processShopifyPrivacyRequest({ ...INPUT, topic: 'customers/data_request' })]);
    expect(tables.shopify_privacy_requests).toHaveLength(1);
    expect(sendData).toHaveBeenCalledTimes(1);
  });

  it('throws before any side effect if durable recording fails', async () => {
    errors['shopify_privacy_requests:upsert'] = ['database unavailable'];
    await expect(processShopifyPrivacyRequest(INPUT)).rejects.toThrow('database unavailable');
    expect(events).toEqual(['shopify_privacy_requests:upsert']);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('requires service-role configuration', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(processShopifyPrivacyRequest(INPUT)).rejects.toThrow('Supabase service configuration is missing');
    expect(from).not.toHaveBeenCalled();
  });

  it('normalizes the shop and deletes only matching visitors after removing their files', async () => {
    await processShopifyPrivacyRequest({ ...INPUT, shopDomain: ' DEMO.myshopify.com ' });
    expect(recorded()).toMatchObject({ shop_domain: SHOP, status: 'completed', attempts: 1, processed_at: expect.any(String), last_error: null });
    expect(tables.widget_visitors.map((row) => row.id)).toEqual(['visitor-other', 'visitor-unrelated']);
    expect(storageFrom).toHaveBeenCalledWith('messenger-attachments');
    expect(remove).toHaveBeenCalledWith(['site-1/photo.png']);
    expect(events.indexOf('storage:remove')).toBeLessThan(events.indexOf('widget_visitors:delete'));
    expect(tables.widget_sites).toHaveLength(2);
  });

  it.each(['%', '_', '*', '\\'])('matches %s in an email literally, never as a wildcard', async (character) => {
    tables.widget_visitors = [
      { id: 'literal', widget_site_id: 'site-1', user_email: `a${character}b@example.com` },
      { id: 'different', widget_site_id: 'site-1', user_email: 'axb@example.com' },
    ];
    await processShopifyPrivacyRequest({ ...INPUT, payload: { customer: { id: 123, email: `a${character}b@example.com` } } });
    expect(tables.widget_visitors.map((row) => row.id)).toEqual(['different']);
  });

  it('removes every shop attachment before deleting the site and cleans separate shop tables', async () => {
    tables.messenger_attachments = Array.from({ length: 5 }, (_, i) => ({ id: `attachment-${i}`, widget_site_id: 'site-1', storage_path: `site-1/${i}.png` }));
    for (const table of ['tryon_jobs', 'tryon_credit_ledger', 'tryon_subscriptions', 'shopify_shop_tokens', 'tryon_shops']) {
      const column = table === 'tryon_jobs' ? 'shop' : 'shop_domain';
      tables[table] = [{ [column]: SHOP }, { [column]: 'other.myshopify.com' }];
    }
    await processShopifyPrivacyRequest({ ...INPUT, topic: 'shop/redact' });
    expect(remove.mock.calls.flatMap(([paths]) => paths)).toEqual(Array.from({ length: 5 }, (_, i) => `site-1/${i}.png`));
    expect(events.lastIndexOf('storage:remove')).toBeLessThan(events.indexOf('widget_sites:delete'));
    expect(tables.widget_sites).toEqual([{ id: 'site-other', domain: 'other.myshopify.com' }]);
    for (const table of ['tryon_jobs', 'tryon_credit_ledger', 'tryon_subscriptions', 'shopify_shop_tokens', 'tryon_shops']) expect(tables[table]).toHaveLength(1);
    expect(recorded().status).toBe('completed');
  });

  it('completes shop/redact when debit and refund ledger rows reference the shop jobs', async () => {
    const otherJob = { id: 'job-other', shop: 'other.myshopify.com' };
    const otherDebit = { id: 'debit-other', shop_domain: 'other.myshopify.com', job_id: otherJob.id, entry_type: 'debit' };
    tables.tryon_jobs = [{ id: 'job-1', shop: SHOP }, otherJob];
    tables.tryon_credit_ledger = [
      { id: 'debit-1', shop_domain: SHOP, job_id: 'job-1', entry_type: 'debit' },
      { id: 'refund-1', shop_domain: SHOP, job_id: 'job-1', entry_type: 'refund', reverses_entry_id: 'debit-1' },
      otherDebit,
    ];

    await processShopifyPrivacyRequest({ ...INPUT, topic: 'shop/redact' });

    expect(recorded()).toMatchObject({ status: 'completed', attempts: 1, processed_at: expect.any(String), last_error: null });
    expect(tables.tryon_jobs).toEqual([otherJob]);
    expect(tables.tryon_credit_ledger).toEqual([otherDebit]);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('deletes only the redacted shop settings, even without a widget site', async () => {
    tables.widget_sites = [];
    const defaults = { shop: 'default', button_label: 'Try it on' };
    const otherSettings = { shop: 'other.myshopify.com', button_label: 'Other shop' };
    tables.tryon_settings = [defaults, { shop: SHOP, button_label: 'Demo shop' }, otherSettings];

    await processShopifyPrivacyRequest({ ...INPUT, topic: 'shop/redact' });

    expect(recorded().status).toBe('completed');
    expect(tables.tryon_settings).toEqual([defaults, otherSettings]);
  });

  it.each(['customers/redact', 'shop/redact'] as const)('treats an already-absent %s target as success', async (topic) => {
    tables = {};
    await processShopifyPrivacyRequest({ ...INPUT, topic });
    expect(recorded().status).toBe('completed');
    expect(remove).not.toHaveBeenCalled();
  });

  it('treats an unmatched customer in an existing shop as success', async () => {
    tables.widget_visitors = [];
    await processShopifyPrivacyRequest(INPUT);
    expect(recorded().status).toBe('completed');
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['customers/redact', 'shop/redact'] as const)('preserves owning rows when %s Storage cleanup fails', async (topic) => {
    remove.mockResolvedValue({ data: null, error: { message: 'Storage unavailable' } });
    await expect(processShopifyPrivacyRequest({ ...INPUT, topic })).resolves.toBeUndefined();
    expect(recorded()).toMatchObject({ status: 'failed', attempts: 1, last_error: 'Storage unavailable', processed_at: null });
    expect(events.filter((event) => event.endsWith(':delete'))).toEqual([]);
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'failed', error: 'Storage unavailable' }));
  });

  it('exports complete paginated records to the merchant without mutating them', async () => {
    tables.widget_messages = Array.from({ length: 5 }, (_, i) => ({ id: `message-${i}`, conversation_id: 'conversation-1', role: 'user', content: `message ${i}`, created_at: '2026-09-09' }));
    await processShopifyPrivacyRequest({ ...INPUT, topic: 'customers/data_request' });
    const email = sendData.mock.calls[0][0];
    expect(email.to).toEqual(['merchant@example.com']);
    expect(email.customerId).toBe(123);
    expect(email.visitors).toHaveLength(2);
    expect(email.visitors[0]).toMatchObject({ visitor: { anonymous_id: 'anon-1', user_name: 'Sara' }, conversations: [{ conversation: { id: 'conversation-1' }, feedback: [{ rating: 5, comment: 'helpful' }] }] });
    expect(email.visitors[0].conversations[0].messages).toHaveLength(5);
    expect(selections).toContainEqual({ table: 'widget_messages', columns: 'role, content, created_at' });
    expect(events.filter((event) => event.endsWith(':delete'))).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
    expect(recorded().status).toBe('completed');
  });

  it.each(['shop', 'profile', 'email'])('falls back to the alert mailbox when merchant %s is absent', async (missing) => {
    if (missing === 'shop') tables.tryon_shops = [];
    if (missing === 'profile') tables.profiles = [];
    if (missing === 'email') tables.profiles[0].email = ' ';
    tables.widget_visitors = [];
    await processShopifyPrivacyRequest({ ...INPUT, topic: 'customers/data_request' });
    expect(sendData).toHaveBeenCalledWith(expect.objectContaining({ to: [], visitors: [] }));
    expect(recorded().status).toBe('completed');
  });

  it('records an undelivered compilation as failed and alerts', async () => {
    sendData.mockResolvedValue({ sent: false });
    await processShopifyPrivacyRequest({ ...INPUT, topic: 'customers/data_request' });
    expect(recorded()).toMatchObject({ status: 'failed', attempts: 1, last_error: expect.stringContaining('email') });
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'failed' }));
  });

  it('records undelivered disabled alerts as failures instead of completing the privacy request', async () => {
    vi.stubEnv('SHOPIFY_PRIVACY_PROCESSING_ENABLED', 'false');
    sendAlert.mockResolvedValue({ sent: false });
    await processShopifyPrivacyRequest(INPUT);
    expect(recorded()).toMatchObject({ status: 'failed', attempts: 1, last_error: expect.stringContaining('email') });
    expect(remove).not.toHaveBeenCalled();
  });

  it('retains malformed customer requests for manual attention without broadening deletion', async () => {
    await processShopifyPrivacyRequest({ ...INPUT, payload: { customer: { id: 123 } } });
    expect(recorded().status).toBe('failed');
    expect(events.filter((event) => event.endsWith(':delete'))).toEqual([]);
  });

  it.each(['widget_sites:select', 'messenger_attachments:select', 'widget_visitors:delete', 'shopify_privacy_requests:update'])(
    'records and alerts a %s database failure without rejecting a durable request', async (operation) => {
      errors[operation] = ['database failed'];
      await expect(processShopifyPrivacyRequest(INPUT)).resolves.toBeUndefined();
      expect(recorded()).toMatchObject({ status: 'failed', last_error: 'database failed', attempts: 1 });
      expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'failed' }));
    },
  );

  it('still alerts and acknowledges if the database becomes unavailable after recording', async () => {
    errors['shopify_privacy_requests:update'] = ['database failed', 'still unavailable'];
    await expect(processShopifyPrivacyRequest(INPUT)).resolves.toBeUndefined();
    expect(recorded().status).toBe('received');
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'failed', error: expect.stringContaining('still unavailable') }));
  });
});
