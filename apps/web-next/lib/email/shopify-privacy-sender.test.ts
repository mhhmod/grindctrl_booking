// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sendMail = vi.hoisted(() => vi.fn());
const createTransport = vi.hoisted(() => vi.fn((_options: Record<string, unknown>) => ({ sendMail })));
vi.mock('nodemailer', () => ({ default: { createTransport } }));
import { privacyMessageId, sendShopifyDataRequest, sendShopifyPrivacyAlert } from './shopify-privacy-sender';
const DATA = { webhookId: 'delivery-1', shopDomain: 'demo.myshopify.com', customerEmail: 'customer@example.com',
  customerId: 123, visitors: [], messageId: '<case-export@grindctrl.com>' };
const ALERT = { webhookId: 'delivery-1', shopDomain: 'demo.myshopify.com', topic: 'shop/redact', reason: 'receipt' as const,
  receivedAt: '2026-11-01T00:00:00Z', caseId: 'case-1', caseSource: 'installation' as const, messageId: '<case-receipt@grindctrl.com>' };
beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue({ messageId: 'smtp-id', accepted: ['grindctrlnow@gmail.com'], rejected: [] });
  vi.stubEnv('TRYON_EMAIL_SMTP_USER', 'bot@grindctrl.cloud');
  vi.stubEnv('TRYON_EMAIL_SMTP_APP_PASSWORD', 'app-password');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Shopify privacy senders', () => {
  it.each(['data', 'alert'] as const)('%s sends only to the approved operator mailbox', async (kind) => {
    const result = kind === 'data' ? await sendShopifyDataRequest(DATA) : await sendShopifyPrivacyAlert(ALERT);
    expect(result).toEqual({ sent: true });
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'grindctrlnow@gmail.com', textEncoding: 'base64', messageId: kind === 'data' ? DATA.messageId : ALERT.messageId,
    });
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty('bcc');
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty('cc');
  });
  it('explains that forwarding and evidence are still required', async () => {
    await sendShopifyDataRequest(DATA);
    expect(sendMail.mock.calls[0][0].text).toContain('not proof of merchant delivery');
    expect(sendMail.mock.calls[0][0].text).toContain('within 30 days');
  });
  it.each(['data', 'alert'] as const)('%s never throws on SMTP errors or missing config', async (kind) => {
    const send = () => kind === 'data' ? sendShopifyDataRequest(DATA) : sendShopifyPrivacyAlert(ALERT);
    sendMail.mockRejectedValueOnce(new Error('private SMTP details'));
    await expect(send()).resolves.toEqual({ sent: false });
    vi.stubEnv('TRYON_EMAIL_SMTP_USER', '');
    await expect(send()).resolves.toEqual({ sent: false });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SMTP is not configured'));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private SMTP details');
  });
  it('catches transport setup and template construction failures', async () => {
    createTransport.mockImplementationOnce(() => { throw new Error('setup failed'); });
    await expect(sendShopifyPrivacyAlert(ALERT)).resolves.toEqual({ sent: false });
    await expect(sendShopifyDataRequest({ ...DATA, visitors: undefined } as unknown as Parameters<typeof sendShopifyDataRequest>[0])).resolves.toEqual({ sent: false });
  });
  it.each([
    { accepted: [], rejected: ['grindctrlnow@gmail.com'] },
    { accepted: ['bot@grindctrl.cloud'], rejected: [] },
    { accepted: undefined, rejected: [] },
  ])('does not acknowledge SMTP without operator acceptance: %j', async result => {
    sendMail.mockResolvedValueOnce(result);
    await expect(sendShopifyDataRequest(DATA)).resolves.toEqual({ sent: false });
  });
  it('assigns stable IDs without mixing apps, request kinds or exposing input', () => {
    const first = privacyMessageId('installation:private-case-a', 'receipt');
    expect(first).toBe(privacyMessageId('installation:private-case-a', 'receipt'));
    expect(first).not.toBe(privacyMessageId('installation:private-case-a', 'reminder'));
    expect(first).not.toBe(privacyMessageId('installation:private-case-b', 'receipt'));
    expect(first).toMatch(/^<privacy-[0-9a-f]{64}@grindctrl.com>$/);
  });
});
