// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ mail: vi.fn(), close: vi.fn(), upsert: vi.fn(), select: vi.fn(), delete: vi.fn(), eq: vi.fn(), after: vi.fn(), owner: vi.fn(), records: new Map<string, string>() }));
vi.mock('next/server', () => ({ after: m.after }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => m }) }));
vi.mock('@/lib/store-health/owner', () => ({ storeHealthOwner: m.owner }));
vi.mock('./transport', () => ({ getSmtpFrom: () => ({ address: 'from@example.com' }), getSmtpTransport: () => ({ sendMail: m.mail, close: m.close }) }));
import { sendStoreJourneyEmail, notifyStoreJourneyHealth, scheduleStoreDisconnectedEmail } from './store-journey-sender';
import { healthyFacts } from '@/lib/store-health/test-fixtures';
const input = { event: 'daily_limit' as const, locale: 'en' as const, storeName: 'Store', address: 'shop.example', resetTime: '2:00' };
const site = { id: 's1', name: 'Store', workspace_id: 'w1', domain: null, settings_json: {} };
beforeEach(() => {
  vi.clearAllMocks(); m.records.clear();
  m.owner.mockResolvedValue({ locale: 'ar', email: 'owner@example.com' });
  m.mail.mockResolvedValue({ accepted: ['owner@example.com'] });
  m.upsert.mockImplementation((row: { site_id: string; event_key: string; claim_token: string }) => {
    const key = row.site_id + ':' + row.event_key;
    const claimed = m.records.has(key);
    if (!claimed) m.records.set(key, row.claim_token);
    m.select.mockResolvedValue({ data: claimed ? [] : [{ claim_token: row.claim_token }], error: null }); return m;
  });
  m.delete.mockReturnValue(m); m.eq.mockReturnValue(m);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it('M12/M13: recurring claims are once per site, event and day', async () => {
  await sendStoreJourneyEmail('s1', 'daily_limit:2026-11-11', 'owner@example.com', input);
  await sendStoreJourneyEmail('s1', 'daily_limit:2026-11-11', 'owner@example.com', input);
  await sendStoreJourneyEmail('s2', 'daily_limit:2026-11-11', 'owner@example.com', input);
  await sendStoreJourneyEmail('s1', 'daily_limit:2026-11-12', 'owner@example.com', input);
  expect(m.mail).toHaveBeenCalledTimes(3);
  expect(m.mail.mock.calls[0][0]).toMatchObject({ to: 'owner@example.com', html: expect.any(String), text: expect.any(String) });
});
it('M10: keeps an uncertain SMTP claim and logs failure without throwing', async () => {
  m.mail.mockRejectedValueOnce({ code: 'ETIMEDOUT', command: 'DATA' });
  await expect(sendStoreJourneyEmail('s1', 'signature:2026-11-11', 'owner@example.com', { ...input, event: 'signature' })).resolves.toBeUndefined();
  expect(m.delete).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalled();
  await sendStoreJourneyEmail('s1', 'signature:2026-11-11', 'owner@example.com', { ...input, event: 'signature' });
  expect(m.mail).toHaveBeenCalledTimes(1);
});
it('never sends without a durable claim', async () => {
  m.upsert.mockImplementation(() => { m.select.mockResolvedValue({ data: null, error: { code: '42P01' } }); return m; });
  await sendStoreJourneyEmail('s1', 'signature:2026-11-11', 'owner@example.com', input);
  expect(m.mail).not.toHaveBeenCalled(); expect(console.error).toHaveBeenCalled();
});
it('M12/M13: notifies at exactly 20% and 100%, using owner locale and local reset', async () => {
  const facts = healthyFacts();
  facts.timeZone = 'Africa/Cairo';
  facts.tryOn = { ...facts.tryOn!, looksLeft: 4, dailyLimitReached: true, dailyResetAt: '2026-11-12T00:00:00Z', dailyLimitCause: 'global' };
  await notifyStoreJourneyHealth(site, facts);
  expect(m.mail).toHaveBeenCalledTimes(2);
  expect(m.mail.mock.calls[0][0].text).toContain('2:00');
  expect(m.mail.mock.calls[0][0].html).toContain('dir="rtl"');
  await notifyStoreJourneyHealth(site, facts);
  expect(m.mail).toHaveBeenCalledTimes(2);
});
it('does not warn above 20% or call an unknown daily limit reached', async () => {
  const facts = healthyFacts(); facts.tryOn = { ...facts.tryOn!, looksLeft: 5, dailyLimitUnreadable: true };
  await notifyStoreJourneyHealth(site, facts); expect(m.mail).not.toHaveBeenCalled();
});
it('M14: schedules once per disconnect event using the owner captured before transfer', async () => {
  scheduleStoreDisconnectedEmail('s1', 'event-one', 'previous-owner@example.com', input);
  await m.after.mock.calls[0][0]();
  await m.after.mock.calls[0][0]();
  expect(m.mail).toHaveBeenCalledTimes(1);
  expect(m.mail.mock.calls[0][0]).toMatchObject({ to: 'previous-owner@example.com' });
  expect(m.owner).not.toHaveBeenCalled();
});
