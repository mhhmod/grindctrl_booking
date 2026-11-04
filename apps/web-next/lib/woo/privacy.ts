import 'server-only';

import { createHmac } from 'node:crypto';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { normalizeContactEmail } from '@/lib/messenger/contact';
import { coreCapabilitySecret } from '@/lib/security/capability-key';

export const WOO_PRIVACY_PAGE_SIZE = 10;
export const WOO_PRIVACY_MAX_PAGE = 100_000;
const STORAGE_BUCKETS = new Set(['messenger-attachments', 'tryon-results']);
const STORAGE_REMOVE_CHUNK = 100;
const REDACT_SITES_PER_RUN = 5;
const REDACT_BATCHES_PER_SITE = 10;

/** A short salted digest for audit logs. The address itself is never logged;
 * the digest lets support match a request to a log line without exposing it. */
export function wooPrivacyEmailHash(siteId: string, email: string): string | null {
  const secret = coreCapabilitySecret();
  if (!secret) return null;
  return createHmac('sha256', secret)
    .update(`woo-privacy:${siteId}:${email}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

export type PrivacyRequest = { email: string; page: number };

export function parsePrivacyRequest(raw: unknown): PrivacyRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const email = normalizeContactEmail(body.email);
  const page = body.page === undefined ? 1 : body.page;
  if (
    !email
    || typeof page !== 'number'
    || !Number.isSafeInteger(page)
    || page < 1
    || page > WOO_PRIVACY_MAX_PAGE
  ) {
    return null;
  }
  return { email, page };
}

export type WpExportItem = {
  group_id: string;
  group_label: string;
  item_id: string;
  data: Array<{ name: string; value: string }>;
};

type ExportMessage = { role: string; content: string; createdAt: string };
type ExportConversation = {
  id: string;
  startedAt: string;
  status: string;
  lastPageUrl: string | null;
  messages: ExportMessage[];
  attachments: Array<{ id: string; mime: string; bytes: number; createdAt: string }>;
  feedback: Array<{ rating: string; comment: string | null }>;
  questions: string[];
};
type ExportPayload = {
  conversations: ExportConversation[];
  visitors: Array<{ name: string | null; email: string | null; firstSeenAt: string; lastSeenAt: string }>;
  leads: Array<{ name: string | null; email: string | null; phone: string | null; company: string | null; createdAt: string }>;
  total: number;
  done: boolean;
};

const CONVERSATIONS_GROUP = { group_id: 'grindctrl-store-chat', group_label: 'GRINDCTRL Store Chat conversations' };
const PROFILE_GROUP = { group_id: 'grindctrl-store-chat-profile', group_label: 'GRINDCTRL Store Chat contact details' };

function field(name: string, value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? [] : [{ name, value: String(value) }];
}

/** Map the SQL export to the item shape WordPress's exporter contract expects. */
export function toWordPressExport(payload: ExportPayload): { items: WpExportItem[]; done: boolean } {
  const items: WpExportItem[] = [];
  payload.visitors.forEach((visitor, index) => {
    items.push({
      ...PROFILE_GROUP,
      item_id: `visitor-${index + 1}`,
      data: [
        ...field('Name', visitor.name),
        ...field('Email', visitor.email),
        ...field('First seen', visitor.firstSeenAt),
        ...field('Last seen', visitor.lastSeenAt),
      ],
    });
  });
  payload.leads.forEach((lead, index) => {
    items.push({
      ...PROFILE_GROUP,
      item_id: `lead-${index + 1}`,
      data: [
        ...field('Name', lead.name),
        ...field('Email', lead.email),
        ...field('Phone', lead.phone),
        ...field('Company', lead.company),
        ...field('Captured', lead.createdAt),
      ],
    });
  });
  for (const conversation of payload.conversations) {
    items.push({
      ...CONVERSATIONS_GROUP,
      item_id: `conversation-${conversation.id}`,
      data: [
        ...field('Started', conversation.startedAt),
        ...field('Status', conversation.status),
        ...field('Last page', conversation.lastPageUrl),
        {
          name: 'Messages',
          value: conversation.messages
            .map((message) => `[${message.createdAt}] ${message.role}: ${message.content}`)
            .join('\n'),
        },
        ...field(
          'Attachments',
          conversation.attachments
            .map((a) => `${a.mime}, ${a.bytes} bytes, ${a.createdAt}`)
            .join('\n'),
        ),
        ...field('Rating', conversation.feedback.map((f) => `${f.rating}${f.comment ? `: ${f.comment}` : ''}`).join('\n')),
        ...field('Questions the assistant could not answer', conversation.questions.join('\n')),
      ],
    });
  }
  return { items, done: payload.done };
}

export async function exportShopperData(siteId: string, email: string, page: number) {
  const { data, error } = await getMessengerServiceClient().rpc('woo_privacy_export', {
    p_site: siteId,
    p_email: email,
    p_page: page,
    p_page_size: WOO_PRIVACY_PAGE_SIZE,
  });
  if (error || !data || typeof data !== 'object') throw new Error('woo_privacy_export_failed');
  return toWordPressExport(data as ExportPayload);
}

export type EraseSummary = { removed: number; done: boolean; counts: Record<string, number> };

export async function eraseShopperData(siteId: string, email: string): Promise<EraseSummary> {
  const { data, error } = await getMessengerServiceClient().rpc('woo_privacy_erase', {
    p_site: siteId,
    p_email: email,
    p_batch: WOO_PRIVACY_PAGE_SIZE,
  });
  const result = data as { counts?: Record<string, unknown>; remaining?: unknown } | null;
  if (error || !result || typeof result.remaining !== 'number' || !result.counts) {
    throw new Error('woo_privacy_erase_failed');
  }
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(result.counts)) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) counts[key] = value;
  }
  const removed = (counts.conversations ?? 0) + (counts.leads ?? 0) + (counts.visitors ?? 0);
  return { removed, done: result.remaining === 0, counts };
}

/** Remove queued storage objects. A row leaves the queue only after Storage
 * confirms removal, so a failure here is retried by the next run. Never logs
 * paths (they include conversation ids). */
export async function drainWooPrivacyStorageQueue(limit = 100): Promise<{ removed: number; failed: number }> {
  const client = getMessengerServiceClient();
  const queued = await client
    .from('woo_privacy_storage_queue')
    .select('bucket, path')
    .order('queued_at', { ascending: true })
    .limit(limit);
  if (queued.error || !Array.isArray(queued.data)) return { removed: 0, failed: 1 };

  const byBucket = new Map<string, string[]>();
  for (const row of queued.data as Array<{ bucket: string; path: string }>) {
    if (!STORAGE_BUCKETS.has(row.bucket) || !row.path) continue;
    byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.path]);
  }

  let removed = 0;
  let failed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
      const chunk = paths.slice(i, i + STORAGE_REMOVE_CHUNK);
      try {
        const removal = await client.storage.from(bucket).remove(chunk);
        if (removal.error) throw new Error('woo_privacy_storage_failed');
        const cleared = await client
          .from('woo_privacy_storage_queue')
          .delete()
          .eq('bucket', bucket)
          .in('path', chunk);
        if (cleared.error) throw new Error('woo_privacy_queue_failed');
        removed += chunk.length;
      } catch {
        failed += 1;
      }
    }
  }
  return { removed, failed };
}

export type WooRedactionSummary = { sites: number; completed: number; pending: number; storageRemoved: number; failed: number };

/** Redact the shopper data of sites whose uninstall grace period has passed.
 * Idempotent: the SQL function re-checks the due condition under a row lock
 * and a finished site clears redact_after. */
export async function redactDueWooSites(): Promise<WooRedactionSummary> {
  const client = getMessengerServiceClient();
  const summary: WooRedactionSummary = { sites: 0, completed: 0, pending: 0, storageRemoved: 0, failed: 0 };

  const due = await client.rpc('woo_sites_due_for_redaction', { p_limit: REDACT_SITES_PER_RUN });
  if (due.error || !Array.isArray(due.data)) {
    summary.failed += 1;
  } else {
    for (const siteId of due.data as unknown[]) {
      if (typeof siteId !== 'string') {
        summary.failed += 1;
        continue;
      }
      summary.sites += 1;
      try {
        let done = false;
        for (let batch = 0; batch < REDACT_BATCHES_PER_SITE && !done; batch += 1) {
          const result = await client.rpc('woo_site_redact', { p_site: siteId });
          const data = result.data as { done?: unknown; redacted?: unknown } | null;
          if (result.error || !data || typeof data.done !== 'boolean') throw new Error('woo_site_redact_failed');
          // redacted:false means the site was re-paired or already handled
          // between listing and locking: nothing to do, not a failure.
          done = data.done || data.redacted === false;
        }
        if (done) summary.completed += 1;
        else summary.pending += 1;
      } catch {
        summary.failed += 1;
      }
    }
  }

  // Also retries objects left behind by earlier erase requests.
  const storage = await drainWooPrivacyStorageQueue();
  summary.storageRemoved = storage.removed;
  summary.failed += storage.failed;
  return summary;
}
