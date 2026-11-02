import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { hasSmtpConfigured } from '@/lib/email/transport';
import { PRIVACY_OPERATOR_MAILBOX, privacyMessageId, sendShopifyDataRequest, sendShopifyPrivacyAlert } from '@/lib/email/shopify-privacy-sender';
import type { ShopifyCustomerRecords } from '@/lib/email/shopify-privacy';
import { recordInstallationEvent, installationEventClient, type InstallationEvent } from './installation-events';

const DAY = 86_400_000;
const BATCH_LIMIT = 25;
type Client = ReturnType<typeof installationEventClient>;
type Topic = 'customers/data_request' | 'customers/redact' | 'shop/redact';
interface PrivacyTask {
  id: string; case_source: 'installation' | 'legacy'; shop_domain: string;
  app_client_id?: string; webhook_id: string; topic: Topic; received_at: string;
  alert_sent_at: string | null; reminder_sent_at: string | null; status: string;
}
interface StorageObject { bucket: string; path: string }
type Prepared =
  | { kind: 'manual'; reason: string }
  | { kind: 'exported_pending_delivery' }
  | { kind: 'export'; visitors: ShopifyCustomerRecords[]; customerId: string | null; customerEmail: string | null }
  | { kind: 'redact'; storage: StorageObject[] };
export interface ShopifyPrivacySummary {
  processed: number; completed: number; exportedPendingDelivery: number; manualRequired: number; failed: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTask(value: unknown): value is PrivacyTask {
  return record(value) && typeof value.id === 'string' && typeof value.shop_domain === 'string' &&
    typeof value.webhook_id === 'string' && typeof value.received_at === 'string' &&
    Number.isFinite(Date.parse(value.received_at)) && typeof value.status === 'string' &&
    ['installation', 'legacy'].includes(String(value.case_source)) &&
    ['customers/data_request', 'customers/redact', 'shop/redact'].includes(String(value.topic)) &&
    (value.alert_sent_at === null || typeof value.alert_sent_at === 'string') &&
    (value.reminder_sent_at === null || typeof value.reminder_sent_at === 'string');
}

function isPrepared(value: unknown): value is Prepared {
  if (!record(value)) return false;
  if (value.kind === 'manual') return typeof value.reason === 'string';
  if (value.kind === 'exported_pending_delivery') return true;
  if (value.kind === 'redact') return Array.isArray(value.storage) && value.storage.every((item) =>
    record(item) && ['messenger-attachments', 'tryon-results'].includes(String(item.bucket)) &&
    typeof item.path === 'string' && item.path.length > 0);
  return value.kind === 'export' && (value.customerId === null || typeof value.customerId === 'string') &&
    (value.customerEmail === null || typeof value.customerEmail === 'string') &&
    Array.isArray(value.visitors) && value.visitors.every((item) => record(item) && record(item.visitor) &&
      Array.isArray(item.conversations) && item.conversations.every((conversation) =>
        record(conversation) && record(conversation.conversation) && Array.isArray(conversation.messages) &&
        conversation.messages.every((message) => record(message) && typeof message.role === 'string' &&
          typeof message.content === 'string' && typeof message.created_at === 'string') &&
        Array.isArray(conversation.feedback)));
}

async function rpc(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error('privacy_database_unavailable');
  return result.data;
}

async function work(client: Client, task: PrivacyTask, claim: string): Promise<keyof Omit<ShopifyPrivacySummary, 'processed' | 'failed'>> {
  const args = { p_source: task.case_source, p_case: task.id, p_claim: claim };
  const identity = `${task.case_source}:${task.id}`;
  const finish = async (outcome: string, evidence: Record<string, unknown>) => {
    const result = await rpc(client, 'shopify_privacy_finish', { ...args, p_outcome: outcome, p_evidence: evidence });
    if (!record(result) || typeof result.status !== 'string') throw new Error('privacy_finish_invalid');
    if (outcome === 'completed' && result.status !== 'completed') throw new Error('privacy_not_completed');
    if (outcome === 'exported' && result.status !== 'exported_pending_delivery') throw new Error('privacy_export_not_recorded');
  };
  try {
    // This also applies after a receipt was sent. Missing configuration must
    // never permit destructive work or claim completion.
    if (!hasSmtpConfigured()) {
      console.error('[shopify-privacy] SMTP is not configured; request remains pending');
      throw new Error('privacy_smtp_unconfigured');
    }
    const alert = async (kind: 'receipt' | 'reminder') => {
      const sent = await sendShopifyPrivacyAlert({
        webhookId: task.webhook_id, shopDomain: task.shop_domain, topic: task.topic,
        reason: kind, receivedAt: task.received_at, caseId: task.id, caseSource: task.case_source,
        messageId: privacyMessageId(identity, kind),
      });
      if (!sent.sent) throw new Error('privacy_alert_unavailable');
      if (await rpc(client, 'shopify_privacy_alert_ack', { ...args, p_kind: kind }) !== true) {
        throw new Error('privacy_alert_ack_failed');
      }
    };
    if (!task.alert_sent_at) await alert('receipt');
    if (!task.reminder_sent_at && Date.now() - Date.parse(task.received_at) >= 21 * DAY) await alert('reminder');
    const prepared = await rpc(client, 'shopify_privacy_prepare', args);
    if (!isPrepared(prepared)) throw new Error('privacy_scope_invalid');
    if (prepared.kind === 'manual') {
      await finish('manual', { reason: prepared.reason });
      return 'manualRequired';
    }
    if (prepared.kind === 'exported_pending_delivery') {
      // Preserve export evidence. Only the restricted operator RPC completes
      // a data request after recording delivery to the merchant.
      await finish('retry', { reason: 'operator_delivery_pending' });
      return 'exportedPendingDelivery';
    }
    if (prepared.kind === 'export') {
      if (task.topic !== 'customers/data_request') throw new Error('privacy_scope_topic_mismatch');
      const input = {
        webhookId: task.webhook_id, shopDomain: task.shop_domain,
        customerId: prepared.customerId, customerEmail: prepared.customerEmail ?? '', visitors: prepared.visitors,
      };
      const messageId = privacyMessageId(identity, 'export');
      const sent = await sendShopifyDataRequest({ ...input, messageId });
      if (!sent.sent) throw new Error('privacy_export_unavailable');
      const conversations = prepared.visitors.flatMap((visitor) => visitor.conversations);
      await finish('exported', {
        exportSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        counts: { widget_visitors: prepared.visitors.length, widget_conversations: conversations.length,
          widget_messages: conversations.reduce((count, conversation) => count + conversation.messages.length, 0) },
        recipient: PRIVACY_OPERATOR_MAILBOX, messageId,
      });
      return 'exportedPendingDelivery';
    }
    if (task.topic === 'customers/data_request') throw new Error('privacy_scope_topic_mismatch');
    let storageObjectsRemoved = 0;
    for (const bucket of ['messenger-attachments', 'tryon-results']) {
      const paths = prepared.storage.filter((item) => item.bucket === bucket).map((item) => item.path);
      for (let offset = 0; offset < paths.length; offset += 100) {
        const batch = paths.slice(offset, offset + 100);
        const removed = await client.storage.from(bucket).remove(batch);
        if (removed.error) throw new Error('privacy_storage_unavailable');
        // Successful retries can return no rows for already removed objects.
        storageObjectsRemoved += batch.length;
      }
    }
    await finish('completed', { storageObjectsRemoved });
    return 'completed';
  } catch {
    // No raw payloads, email addresses, paths or provider errors in logs.
    console.error('[shopify-privacy] fulfilment failed; request remains pending');
    try { await finish('retry', { reason: 'privacy_fulfilment_failed' }); } catch {
      console.error('[shopify-privacy] retry could not be recorded; claim will expire');
    }
    throw new Error('privacy_fulfilment_unavailable');
  }
}

async function run(limit: number, caseId?: string): Promise<ShopifyPrivacySummary> {
  const client = installationEventClient();
  const claim = randomUUID();
  const size = Number.isFinite(limit) ? Math.min(BATCH_LIMIT, Math.max(1, Math.floor(limit))) : BATCH_LIMIT;
  const tasks = await rpc(client, 'shopify_privacy_claim', { p_limit: size, p_claim: claim, p_case: caseId ?? null });
  if (!Array.isArray(tasks) || tasks.length > size || !tasks.every(isTask)) throw new Error('privacy_claim_invalid');
  const summary: ShopifyPrivacySummary = { processed: 0, completed: 0, exportedPendingDelivery: 0, manualRequired: 0, failed: 0 };
  for (const task of tasks) {
    summary.processed += 1;
    try { summary[await work(client, task, claim)] += 1; } catch { summary.failed += 1; }
  }
  return summary;
}

export async function runPendingShopifyPrivacyRequests({ limit = BATCH_LIMIT }: { limit?: number } = {}): Promise<ShopifyPrivacySummary> {
  return run(limit);
}

/** Persist verified app identity before any email or deletion. Redeliveries
 * share a durable claim with the scheduled worker. Only a failed receipt
 * throws: once recorded, Shopify gets its 200 within the 5 s window and the
 * scheduled worker owns retries (fulfilment may wait on SMTP and Storage). */
export async function processShopifyPrivacyRequest(input: Omit<InstallationEvent, 'topic'> & { topic: Topic }): Promise<void> {
  const receipt = await recordInstallationEvent(input);
  if (receipt.status === 'completed') return;
  try {
    const summary = await run(1, receipt.id);
    if (summary.failed) console.error('[shopify-privacy] inline fulfilment deferred to the scheduled worker');
  } catch {
    console.error('[shopify-privacy] inline fulfilment deferred to the scheduled worker');
  }
}
