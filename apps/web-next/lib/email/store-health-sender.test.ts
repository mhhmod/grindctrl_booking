// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ send: vi.fn(), close: vi.fn(), configured: true }));
vi.mock('./transport', () => ({ getSmtpFrom: () => ({ name: 'GRINDCTRL Store Chat', address: 'alerts@example.com' }), getSmtpTransport: () => mocks.configured ? { sendMail: mocks.send, close: mocks.close } : null }));
import { healthSmtpFailure, sendStoreHealthEmail } from './store-health-sender';
const input = { problem: 'code_gone' as const, recovery: false, storeName: 'Lulu', address: 'lulu.example', sinceDay: 'Monday', locale: 'en' as const, to: 'owner@example.com', deliveryId: 'period-problem' };
beforeEach(() => { vi.clearAllMocks(); mocks.configured = true; mocks.send.mockResolvedValue({ accepted: ['owner@example.com'], rejected: [] }); });
describe('store health shared SMTP sender', () => {
  it('reuses from/transport and sends text plus HTML with a stable message ID', async () => {
    expect(await sendStoreHealthEmail(input)).toBe('sent');
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: { name: 'GRINDCTRL Store Chat', address: 'alerts@example.com' }, to: 'owner@example.com', messageId: '<store-health-period-problem@grindctrl.cloud>', text: expect.stringContaining('#check-code_gone'), html: expect.stringContaining('GRINDCTRL') }));
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it.each([{ code: 'ECONNECTION' }, { code: 'ETIMEDOUT', command: 'CONN' }, { responseCode: 451, command: 'DATA' }, { code: 'EAUTH' }])('retries only definite non-delivery %j', async (error) => {
    mocks.send.mockRejectedValue(error); expect(await sendStoreHealthEmail(input)).toBe('retry');
  });
  it.each([{ code: 'ETIMEDOUT', command: 'DATA' }, { code: 'ECONNRESET' }, new Error('unknown')])('keeps ambiguous results %j claimed', (error) => { expect(healthSmtpFailure(error)).toBe('unknown'); });
  it('keeps an explicit rejection or missing config pending', async () => {
    mocks.send.mockResolvedValue({ rejected: ['owner@example.com'] }); expect(await sendStoreHealthEmail(input)).toBe('retry');
    mocks.configured = false; expect(await sendStoreHealthEmail(input)).toBe('retry');
  });
  it('does not call a missing acceptance receipt delivered', async () => {
    mocks.send.mockResolvedValue({}); expect(await sendStoreHealthEmail(input)).toBe('unknown');
    mocks.send.mockResolvedValue({ pending: ['owner@example.com'] }); expect(await sendStoreHealthEmail(input)).toBe('retry');
  });
});
