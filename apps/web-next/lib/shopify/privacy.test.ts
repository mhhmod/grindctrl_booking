// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ record: vi.fn(), alert: vi.fn(), export: vi.fn(), rpc: vi.fn(), remove: vi.fn(), storage: vi.fn(), configured: vi.fn() }));
vi.mock('./installation-events', () => ({ recordInstallationEvent: mocks.record,
  installationEventClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.storage } }) }));
vi.mock('@/lib/email/transport', () => ({ hasSmtpConfigured: mocks.configured }));
vi.mock('@/lib/email/shopify-privacy-sender', () => ({
  PRIVACY_OPERATOR_MAILBOX: 'grindctrlnow@gmail.com', privacyMessageId: (identity: string, kind: string) => `${identity}:${kind}`,
  sendShopifyPrivacyAlert: mocks.alert, sendShopifyDataRequest: mocks.export,
}));
import { processShopifyPrivacyRequest, runPendingShopifyPrivacyRequests } from './privacy';
const input = { appClientId: 'app-a', shopDomain: 'demo.myshopify.com', webhookId: 'event-1',
  topic: 'shop/redact' as const, payload: { shop_domain: 'demo.myshopify.com' }, triggeredAt: null };
const now = Date.parse('2026-11-01T00:00:00Z');
let task: Record<string, unknown>;
let prepared: Record<string, unknown>;
const finishes = () => mocks.rpc.mock.calls.filter(([name]) => name === 'shopify_privacy_finish').map(([, args]) => args);
const prepares = () => mocks.rpc.mock.calls.filter(([name]) => name === 'shopify_privacy_prepare');
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  task = { id: 'case-1', case_source: 'installation', app_client_id: 'app-a', shop_domain: input.shopDomain,
    topic: input.topic, webhook_id: input.webhookId, received_at: '2026-11-01T00:00:00Z',
    alert_sent_at: null, reminder_sent_at: null, status: 'manual_required' };
  prepared = { kind: 'redact', storage: [] };
  mocks.record.mockImplementation(async () => ({ id: task.id, status: task.status }));
  mocks.configured.mockReturnValue(true);
  mocks.alert.mockResolvedValue({ sent: true });
  mocks.export.mockResolvedValue({ sent: true });
  mocks.storage.mockReturnValue({ remove: mocks.remove });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'shopify_privacy_claim') return { data: task.status === 'completed' ? [] : [{ ...task }], error: null };
    if (name === 'shopify_privacy_prepare') return { data: task.status === 'exported_pending_delivery' ? { kind: 'exported_pending_delivery' } : prepared, error: null };
    if (name === 'shopify_privacy_alert_ack') {
      task[args.p_kind === 'receipt' ? 'alert_sent_at' : 'reminder_sent_at'] = new Date(now).toISOString();
      return { data: true, error: null };
    }
    if (name === 'shopify_privacy_finish') {
      if (args.p_outcome === 'completed') task.status = 'completed';
      if (args.p_outcome === 'exported') task.status = 'exported_pending_delivery';
      return { data: { status: task.status }, error: null };
    }
    throw new Error('Unexpected RPC');
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Shopify privacy fulfilment', () => {
  it('persists app identity before claiming the specific receipt', async () => {
    await processShopifyPrivacyRequest(input);
    expect(mocks.record).toHaveBeenCalledWith(input);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'shopify_privacy_claim', {
      p_limit: 1, p_case: 'case-1', p_claim: expect.any(String),
    });
    expect(mocks.record.mock.invocationCallOrder[0]).toBeLessThan(mocks.alert.mock.invocationCallOrder[0]);
    expect(finishes()).toEqual([expect.objectContaining({ p_outcome: 'completed', p_evidence: { storageObjectsRemoved: 0 } })]);
  });
  it('sends and acknowledges the receipt exactly once across ordinary retries', async () => {
    prepared = { kind: 'manual', reason: 'ambiguous_installation_ownership' };
    await processShopifyPrivacyRequest(input);
    await processShopifyPrivacyRequest(input);
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'receipt', caseId: 'case-1' }));
    expect(finishes()).toHaveLength(2);
    expect(finishes().every((args) => args.p_outcome === 'manual')).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('leaves ambiguous ownership as manual casework with a receipt alert', async () => {
    prepared = { kind: 'manual', reason: 'ambiguous_installation_ownership' };
    expect(await runPendingShopifyPrivacyRequests({ limit: 100 })).toMatchObject({ processed: 1, manualRequired: 1, completed: 0, failed: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith('shopify_privacy_claim', expect.objectContaining({ p_limit: 25 }));
    expect(finishes()[0]).toMatchObject({ p_outcome: 'manual', p_evidence: { reason: 'ambiguous_installation_ownership' } });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
  });
  it.each([21, 30])('sends one reminder for an incomplete %i-day-old request', async (days) => {
    task.received_at = new Date(now - days * 86_400_000).toISOString();
    task.alert_sent_at = task.received_at;
    prepared = { kind: 'manual', reason: 'operator_retention_hold' };
    await runPendingShopifyPrivacyRequests({});
    await runPendingShopifyPrivacyRequests({});
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'reminder' }));
    expect(task.reminder_sent_at).toBeTruthy();
  });
  it('does not remind before 21 days or after completion', async () => {
    task.received_at = new Date(now - 21 * 86_400_000 + 1).toISOString();
    task.alert_sent_at = task.received_at;
    await runPendingShopifyPrivacyRequests({});
    await runPendingShopifyPrivacyRequests({});
    expect(mocks.alert).not.toHaveBeenCalled();
  });
  it('does not resend an exported case while waiting for restricted operator delivery', async () => {
    task.status = 'exported_pending_delivery';
    task.alert_sent_at = task.received_at;
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ exportedPendingDelivery: 1, completed: 0 });
    expect(mocks.export).not.toHaveBeenCalled();
    expect(finishes()[0]).toMatchObject({ p_outcome: 'retry', p_evidence: { reason: 'operator_delivery_pending' } });
  });
  it('emails only the database-scoped export and records counts/hash without claiming delivery', async () => {
    task.topic = 'customers/data_request';
    prepared = { kind: 'export', customerId: '123', customerEmail: 'customer@example.com', visitors: [{
      visitor: { id: 'visitor-a', user_email: 'customer@example.com' }, conversations: [{
        conversation: { id: 'conversation-a' }, messages: [{ role: 'user', content: 'private', created_at: '2026-10-31T00:00:00Z' }], feedback: [],
      }],
    }] };
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ exportedPendingDelivery: 1, completed: 0, failed: 0 });
    expect(mocks.export).toHaveBeenCalledWith(expect.objectContaining({
      shopDomain: input.shopDomain, customerId: '123', customerEmail: 'customer@example.com', visitors: prepared.visitors,
    }));
    expect(finishes()[0]).toMatchObject({ p_outcome: 'exported', p_evidence: {
      exportSha256: expect.stringMatching(/^[0-9a-f]{64}$/), recipient: 'grindctrlnow@gmail.com',
      counts: { widget_visitors: 1, widget_conversations: 1, widget_messages: 1 },
    } });
    expect(JSON.stringify(finishes())).not.toContain('private');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('exports a verified email-only customer identity without inventing a Shopify ID', async () => {
    task.topic = 'customers/data_request';
    prepared = { kind: 'export', customerId: null, customerEmail: 'customer@example.com', visitors: [] };
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ exportedPendingDelivery: 1, failed: 0 });
    expect(mocks.export).toHaveBeenCalledWith(expect.objectContaining({ customerId: null, customerEmail: 'customer@example.com', visitors: [] }));
  });
  it.each([null, '2026-11-01T00:00:00Z'])('missing SMTP keeps pending even if alert marker is %s', async marker => {
    task.alert_sent_at = marker;
    mocks.configured.mockReturnValue(false);
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ completed: 0, failed: 1 });
    expect(prepares()).toHaveLength(0);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(finishes()[0]).toMatchObject({ p_outcome: 'retry' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SMTP is not configured'));
  });
  it('retains the receipt and retries alert failure without acknowledging or deleting', async () => {
    mocks.alert.mockResolvedValueOnce({ sent: false });
    await expect(processShopifyPrivacyRequest(input)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('deferred to the scheduled worker'));
    expect(task.alert_sent_at).toBeNull();
    expect(prepares()).toHaveLength(0);
    await processShopifyPrivacyRequest(input);
    expect(mocks.alert).toHaveBeenCalledTimes(2);
    expect(mocks.alert.mock.calls[0][0].messageId).toBe(mocks.alert.mock.calls[1][0].messageId);
  });
  it('removes storage in bounded batches before completing database deletion', async () => {
    prepared.storage = Array.from({ length: 201 }, (_, index) => ({ bucket: 'messenger-attachments', path: `store/${index}` }));
    await runPendingShopifyPrivacyRequests({});
    expect(mocks.remove.mock.calls.map(([paths]) => paths.length)).toEqual([100, 100, 1]);
    expect(finishes()[0]).toMatchObject({ p_outcome: 'completed', p_evidence: { storageObjectsRemoved: 201 } });
    const finishIndex = mocks.rpc.mock.calls.findIndex(([name]) => name === 'shopify_privacy_finish');
    expect(mocks.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.rpc.mock.invocationCallOrder[finishIndex]);
  });
  it('never completes partial storage deletion', async () => {
    prepared.storage = [{ bucket: 'messenger-attachments', path: 'private/file' }];
    mocks.remove.mockResolvedValueOnce({ error: new Error('private/file failure') });
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ failed: 1, completed: 0 });
    expect(finishes().every((args) => args.p_outcome === 'retry')).toBe(true);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private/file');
  });
  it('does not send or delete before durable recording succeeds', async () => {
    mocks.record.mockRejectedValueOnce(new Error('record failed'));
    await expect(processShopifyPrivacyRequest(input)).rejects.toThrow('record failed');
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does no work when another worker holds the claim', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    await processShopifyPrivacyRequest(input);
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('refuses malformed or mismatched destructive scopes', async () => {
    task.topic = 'customers/data_request';
    expect(await runPendingShopifyPrivacyRequests({})).toMatchObject({ failed: 1, completed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
