// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.hoisted(() => vi.fn(async (_message: Record<string, unknown>): Promise<{ messageId: string; rejected?: string[] }> => ({ messageId: 'mid-1' })));
const createTransport = vi.hoisted(() => vi.fn((_options: Record<string, unknown>) => ({ sendMail })));
vi.mock('nodemailer', () => ({ default: { createTransport } }));

import { sendShopifyDataRequest, sendShopifyPrivacyAlert } from './shopify-privacy-sender';

const DATA = { webhookId: 'delivery-1', shopDomain: 'demo.myshopify.com', customerEmail: 'customer@example.com', customerId: 123, visitors: [] };
const ALERT = { webhookId: 'delivery-1', shopDomain: 'demo.myshopify.com', topic: 'shop/redact' as const, reason: 'disabled' as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TRYON_EMAIL_SMTP_USER', 'bot@grindctrl.cloud');
  vi.stubEnv('TRYON_EMAIL_SMTP_APP_PASSWORD', 'app-password');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Shopify privacy senders', () => {
  it('sends customer records only to the merchant contact', async () => {
    await expect(sendShopifyDataRequest({ ...DATA, to: ['merchant@example.com'] })).resolves.toEqual({ sent: true });
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'bot@grindctrl.cloud', bcc: ['merchant@example.com'], textEncoding: 'base64',
      subject: 'Shopify customer data request — demo.myshopify.com',
    });
    expect(sendMail.mock.calls[0][0].bcc).not.toContain(DATA.customerEmail);
  });

  it('falls back to the existing notification mailbox when the merchant is unknown', async () => {
    await sendShopifyDataRequest({ ...DATA, to: [] });
    expect(sendMail.mock.calls[0][0].bcc).toEqual(['bot@grindctrl.cloud']);
  });

  it('sends manual alerts to the existing mailbox and the merchant, deduplicated', async () => {
    await sendShopifyPrivacyAlert({ ...ALERT, to: ['merchant@example.com', 'bot@grindctrl.cloud'] });
    expect(sendMail.mock.calls[0][0].bcc).toEqual(['bot@grindctrl.cloud', 'merchant@example.com']);
  });

  it('sends processing failures to the existing mailbox', async () => {
    await sendShopifyPrivacyAlert({ ...ALERT, reason: 'failed', error: 'Storage unavailable', to: [] });
    expect(sendMail.mock.calls[0][0].bcc).toEqual(['bot@grindctrl.cloud']);
    expect(sendMail.mock.calls[0][0].text).toContain('Storage unavailable');
  });

  it.each(['data', 'alert'] as const)('%s sender never throws on transport errors or missing config', async (kind) => {
    const send = () => kind === 'data'
      ? sendShopifyDataRequest({ ...DATA, to: [] })
      : sendShopifyPrivacyAlert({ ...ALERT, to: [] });
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(send()).resolves.toEqual({ sent: false });
    vi.stubEnv('TRYON_EMAIL_SMTP_USER', '');
    await expect(send()).resolves.toEqual({ sent: false });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('also catches transport setup and malformed template input errors', async () => {
    createTransport.mockImplementationOnce(() => { throw new Error('setup failed'); });
    await expect(sendShopifyPrivacyAlert({ ...ALERT, to: [] })).resolves.toEqual({ sent: false });
    await expect(sendShopifyDataRequest({ ...DATA, visitors: undefined, to: [] } as unknown as Parameters<typeof sendShopifyDataRequest>[0])).resolves.toEqual({ sent: false });
  });

  it('does not report fulfillment when SMTP rejects the merchant but accepts the sending mailbox', async () => {
    sendMail.mockResolvedValueOnce({ messageId: 'partial', rejected: ['merchant@example.com'] });
    await expect(sendShopifyDataRequest({ ...DATA, to: ['merchant@example.com'] })).resolves.toEqual({ sent: false });
  });
});
