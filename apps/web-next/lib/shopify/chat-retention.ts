import 'server-only';

import { randomUUID } from 'node:crypto';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { ATTACHMENT_BUCKET } from '@/lib/messenger/attachments';

export const CHAT_RETENTION_BATCH_LIMIT = 25;
export const CHAT_RETENTION_STORAGE_BATCH_LIMIT = 100;

export interface ChatRetentionSummary {
  scanned: number;
  conversations: number;
  messages: number;
  attachments: number;
  storageObjects: number;
  visitors: number;
  events: number;
  feedback: number;
  unanswered: number;
  pending: number;
  failed: number;
}

interface RetentionTask {
  conversation_id: string;
  attachment_paths: string[];
}

const ROW_COUNTS = ['conversations', 'messages', 'attachments', 'events', 'feedback', 'unanswered', 'pending'] as const;

/** The database computes a calendar-month cutoff and claims expired records
 * under row locks. Claimed conversations cannot accept new activity. Storage
 * is removed first, then the matching rows; failures keep the durable task for
 * a later run. Each invocation has fixed conversation, visitor and object caps. */
export async function cleanupInactiveStoreChat(limit = CHAT_RETENTION_BATCH_LIMIT): Promise<ChatRetentionSummary> {
  const batchLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(CHAT_RETENTION_BATCH_LIMIT, Math.floor(limit)))
    : CHAT_RETENTION_BATCH_LIMIT;
  const client = getMessengerServiceClient();
  const claim = randomUUID();
  const summary: ChatRetentionSummary = {
    scanned: 0, conversations: 0, messages: 0, attachments: 0, storageObjects: 0,
    visitors: 0, events: 0, feedback: 0, unanswered: 0, pending: 0, failed: 0,
  };
  const batch = await client.rpc('shopify_chat_retention_batch', { p_limit: batchLimit, p_claim: claim });
  if (batch.error || !Array.isArray(batch.data) || batch.data.length > batchLimit) {
    throw new Error('chat_retention_claim_failed');
  }

  for (const task of batch.data as RetentionTask[]) {
    summary.scanned += 1;
    try {
      if (
        typeof task.conversation_id !== 'string' || !Array.isArray(task.attachment_paths) ||
        task.attachment_paths.length > CHAT_RETENTION_STORAGE_BATCH_LIMIT ||
        !task.attachment_paths.every((path) => typeof path === 'string' && path.length > 0)
      ) throw new Error('chat_retention_task_invalid');

      if (task.attachment_paths.length > 0) {
        const removal = await client.storage.from(ATTACHMENT_BUCKET).remove(task.attachment_paths);
        if (removal.error) throw new Error('chat_retention_storage_failed');
        // Missing objects are already removed, so Storage's successful empty
        // result is safe to acknowledge on a retried deletion.
        summary.storageObjects += Array.isArray(removal.data) ? removal.data.length : 0;
      }
      const finished = await client.rpc('shopify_chat_retention_finish', {
        p_conversation: task.conversation_id, p_claim: claim, p_paths: task.attachment_paths,
      });
      if (finished.error || !finished.data || typeof finished.data !== 'object') {
        throw new Error('chat_retention_finalize_failed');
      }
      const counts = finished.data as Record<string, unknown>;
      for (const key of ROW_COUNTS) {
        if (!Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0) {
          throw new Error('chat_retention_counts_invalid');
        }
      }
      for (const key of ROW_COUNTS) summary[key] += counts[key] as number;
    } catch {
      // Do not log provider errors: they can contain paths or shopper data.
      // A failed task retains its objects/rows and becomes retryable in 15m.
      summary.failed += 1;
    }
  }

  try {
    const visitors = await client.rpc('shopify_chat_retention_visitors', { p_limit: batchLimit });
    if (visitors.error || !Number.isSafeInteger(visitors.data) || visitors.data < 0 || visitors.data > batchLimit) {
      throw new Error('chat_retention_visitors_failed');
    }
    summary.visitors = visitors.data;
  } catch {
    summary.failed += 1;
  }
  return summary;
}
