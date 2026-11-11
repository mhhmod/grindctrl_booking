// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
type Row = { id: string; name: string | null; workspace_id: string; domain: string | null; connected_email_at: string | null };
const m = vi.hoisted(() => ({
  row: null as Row | null, readError: null as null | { code: string; message: string },
  send: vi.fn(), close: vi.fn(), configured: true, owner: vi.fn(), connection: vi.fn(), after: vi.fn(),
}));
vi.mock('next/server', () => ({ after: m.after }));
vi.mock('./transport', () => ({
  hasSmtpConfigured: () => m.configured,
  getSmtpFrom: () => ({ name: 'GRINDCTRL Store Chat', address: 'hello@example.com' }),
  getSmtpTransport: () => (m.configured ? { sendMail: m.send, close: m.close } : null),
}));
vi.mock('@/lib/store-health/owner', () => ({ storeHealthOwner: m.owner }));
vi.mock('@/lib/paste/store', () => ({ getPasteConnection: m.connection }));
/* widget_sites with real conditional-update semantics: a filter that does
   not match the stored row changes nothing and returns no rows. */
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({
    from: (table: string) => {
      if (table !== 'widget_sites') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: m.row ? { ...m.row } : null, error: m.readError }) }) }),
        update: (values: Partial<Row>) => {
          const filters: Array<(row: Row) => boolean> = [];
          const apply = () => {
            if (!m.row || !filters.every((match) => match(m.row!))) return { data: [], error: null };
            Object.assign(m.row, values);
            return { data: [{ id: m.row.id }], error: null };
          };
          const chain = {
            eq: (column: keyof Row, value: unknown) => { filters.push((row) => row[column] === value); return chain; },
            is: (column: keyof Row, value: unknown) => { filters.push((row) => row[column] === value); return chain; },
            select: async () => apply(),
            then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(apply).then(resolve, reject),
          };
          return chain;
        },
      };
    },
  }),
}));

import { scheduleStoreConnectedEmail, sendStoreConnectedEmail, type StoreConnectPath } from './store-connected-sender';

const SITE = '11111111-1111-4111-8111-111111111111';
const PATHS: Array<[StoreConnectPath, string]> = [
  ['shopify_paste', 'harmong-eg.myshopify.com'], ['website_paste', 'shop.example'],
  ['woocommerce', 'wp.example'], ['shopify_app', 'app-store.myshopify.com'],
];

beforeEach(() => {
  vi.clearAllMocks();
  m.row = { id: SITE, name: 'Harmony', workspace_id: 'ws-1', domain: null, connected_email_at: null };
  m.readError = null;
  m.configured = true;
  m.send.mockResolvedValue({ accepted: ['owner@example.com'], rejected: [] });
  m.owner.mockResolvedValue({ email: 'owner@example.com', locale: 'en' });
  m.connection.mockResolvedValue({ platform: 'website' });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the connected email is sent once per store', () => {
  it.each(PATHS)('sends once for %s and never again', async (path, host) => {
    expect(await sendStoreConnectedEmail(SITE, { path, host })).toBe('sent');
    expect(await sendStoreConnectedEmail(SITE, { path, host })).toBe('already_sent');
    expect(m.send).toHaveBeenCalledOnce();
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com', messageId: `<store-connected-${SITE}@grindctrl.cloud>`,
      subject: `Your store is connected: ${host}`, text: expect.stringContaining('https://grindctrl.cloud/dashboard/store') }));
    expect(m.row?.connected_email_at).not.toBeNull();
  });

  it('sends once across different paths for the same store, and when two triggers race', async () => {
    const results = await Promise.all([
      sendStoreConnectedEmail(SITE, { path: 'shopify_paste', host: 'a.myshopify.com' }),
      sendStoreConnectedEmail(SITE, { path: 'shopify_app', host: 'a.myshopify.com' }),
    ]);
    expect(results.sort()).toEqual(['already_sent', 'sent']);
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('already_sent');
    expect(m.send).toHaveBeenCalledOnce();
  });

  it('writes in the workspace owner’s language', async () => {
    m.owner.mockResolvedValue({ email: 'owner@example.com', locale: 'ar' });
    await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' });
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('dir="rtl"') }));
  });

  it('gives the claim back only after a definite non-delivery', async () => {
    m.send.mockRejectedValueOnce({ code: 'ECONNECTION' });
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('retry');
    expect(m.row?.connected_email_at).toBeNull();
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('sent');

    m.row!.connected_email_at = null;
    m.send.mockRejectedValueOnce({ code: 'ETIMEDOUT', command: 'DATA' });
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('unknown');
    // SMTP may have accepted it: keep the claim rather than risk a second email.
    expect(m.row?.connected_email_at).not.toBeNull();
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('already_sent');
  });

  it.each([
    ['no owner email is known yet', () => m.owner.mockResolvedValue(null)],
    ['SMTP is not configured', () => { m.configured = false; }],
  ])('keeps the claim for a later trigger when %s', async (_name, arrange) => {
    arrange();
    expect(await sendStoreConnectedEmail(SITE, { path: 'shopify_app', host: 'a.myshopify.com' })).toBe('skipped');
    expect(m.row?.connected_email_at).toBeNull();
    expect(m.send).not.toHaveBeenCalled();
  });

  it('does not call a Shopify paste store connected because its custom domain was verified', async () => {
    m.connection.mockResolvedValue({ platform: 'shopify' });
    expect(await sendStoreConnectedEmail(SITE, { path: 'website_paste', host: 'shop.example' })).toBe('skipped');
    expect(m.row?.connected_email_at).toBeNull();
  });

  it('sends nothing before its migration added the marker', async () => {
    m.readError = { code: '42703', message: 'column widget_sites.connected_email_at does not exist' };
    expect(await sendStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).toBe('skipped');
    expect(m.send).not.toHaveBeenCalled();
  });
});

describe('scheduling never breaks the connect path', () => {
  it('runs after the response and logs a failure instead of throwing', async () => {
    let run: () => Promise<void> = async () => {};
    m.after.mockImplementation((callback: () => Promise<void>) => { run = callback; });
    m.readError = { code: 'XX000', message: 'database down' };
    expect(() => scheduleStoreConnectedEmail(SITE, { path: 'woocommerce', host: 'wp.example' })).not.toThrow();
    await run();
    expect(console.error).toHaveBeenCalledWith('[store-connected] email failed', expect.objectContaining({ site: SITE, path: 'woocommerce' }));
  });

  it('logs when it cannot be scheduled at all', () => {
    m.after.mockImplementation(() => { throw new Error('outside a request'); });
    expect(() => scheduleStoreConnectedEmail(SITE, { path: 'shopify_paste', host: 'a.myshopify.com' })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('[store-connected] email not scheduled', expect.objectContaining({ path: 'shopify_paste' }));
  });

  it('resolves a Shopify app site by its shop, and does nothing for a shop without one', async () => {
    let run: () => Promise<void> = async () => {};
    m.after.mockImplementation((callback: () => Promise<void>) => { run = callback; });
    scheduleStoreConnectedEmail(async () => null, { path: 'shopify_app', host: 'a.myshopify.com' });
    await run();
    expect(m.send).not.toHaveBeenCalled();
    scheduleStoreConnectedEmail(async () => SITE, { path: 'shopify_app', host: 'a.myshopify.com' });
    await run();
    expect(m.send).toHaveBeenCalledOnce();
  });
});
