// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ record: vi.fn(), send: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('./installation-events', () => ({ recordInstallationEvent: mocks.record,
  installationEventClient: () => ({ from: mocks.from }) }));
vi.mock('@/lib/email/shopify-privacy-sender', () => ({ sendShopifyPrivacyAlert: mocks.send }));
import { processShopifyPrivacyRequest } from './privacy';
const input = { appClientId: 'app-a', shopDomain: 'demo.myshopify.com', webhookId: 'event-1',
  topic: 'shop/redact' as const, payload: { shop_domain: 'demo.myshopify.com' }, triggeredAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.record.mockResolvedValue({ id: 'receipt', status: 'manual_required', alertSent: false });
  mocks.send.mockResolvedValue({ sent: true });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});
describe('privacy requests remain durably pending until scope is established', () => {
  it.each(['shop/redact', 'customers/redact', 'customers/data_request'] as const)(
    'records %s with app identity and never marks recording as fulfillment', async topic => {
      await processShopifyPrivacyRequest({ ...input, topic });
      expect(mocks.record).toHaveBeenCalledWith({ ...input, topic });
      expect(mocks.update).toHaveBeenCalledWith({ alert_sent_at: expect.any(String) });
      expect(JSON.stringify(mocks.update.mock.calls)).not.toContain('completed');
      expect(mocks.from).toHaveBeenCalledWith('shopify_installation_events');
    });
  it('never deletes shared records even when legacy automatic processing is enabled', async () => {
    vi.stubEnv('SHOPIFY_PRIVACY_PROCESSING_ENABLED', 'true');
    try {
      await processShopifyPrivacyRequest(input);
      expect(mocks.from.mock.calls.every(([table]) => table === 'shopify_installation_events')).toBe(true);
    } finally { vi.unstubAllEnvs(); }
  });
  it('retries alert delivery after durable recording instead of claiming completion', async () => {
    mocks.send.mockResolvedValueOnce({ sent: false });
    await expect(processShopifyPrivacyRequest(input)).rejects.toThrow('privacy_manual_alert_unavailable');
    expect(mocks.update).not.toHaveBeenCalled();
    await processShopifyPrivacyRequest(input);
    expect(mocks.record).toHaveBeenCalledTimes(2);
  });
  it('does not repeat an already-recorded successful alert', async () => {
    mocks.record.mockResolvedValue({ id: 'receipt', status: 'manual_required', alertSent: true, duplicate: true });
    await processShopifyPrivacyRequest(input);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('does not send before durable recording succeeds', async () => {
    mocks.record.mockRejectedValue(new Error('storage unavailable'));
    await expect(processShopifyPrivacyRequest(input)).rejects.toThrow('storage unavailable');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
