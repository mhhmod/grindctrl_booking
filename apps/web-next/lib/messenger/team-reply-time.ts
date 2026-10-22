import 'server-only';

import { getMessengerServiceClient } from './db';
import { readHandoffAlert } from './handoff-alert';

/* How long the team usually takes to reply after a real alert (Chat-States:
   "The team usually replies in about 10 minutes"). Measured, never assumed:
   the median time from an alert going out to the first reply a person
   wrote, over the store's handoffs in the last 30 days. Too few handoffs,
   or a median over two hours, and there is no time to promise, so the panel
   drops it. Read for the v16 panel's config, cached for ten minutes per
   store, and never fatal. */

const WINDOW_DAYS = 30;
/** Fewer handoffs than this and one slow or quick reply decides the line. */
export const MIN_SAMPLES = 5;
/** Beyond this, "usually in about N minutes" stops being the right sentence. */
export const MAX_MINUTES = 120;
const CACHE_TTL_MS = 10 * 60_000;

const cache = new Map<string, { minutes: number | null; expiresAt: number }>();

/** Minutes from each alert to the first human reply after it. */
export function replySamples(
  conversations: Array<{ id: string; metadata: Record<string, unknown> | null }>,
  humanReplies: Array<{ conversation_id: string; created_at: string }>,
): number[] {
  const alertedAt = new Map<string, number>();
  for (const conversation of conversations) {
    const alert = readHandoffAlert(conversation.metadata);
    if (alert?.status !== 'sent') continue;
    const at = Date.parse(alert.at);
    if (Number.isFinite(at)) alertedAt.set(conversation.id, at);
  }
  const first = new Map<string, number>();
  for (const reply of humanReplies) {
    const alertAt = alertedAt.get(reply.conversation_id);
    const at = Date.parse(reply.created_at);
    if (alertAt === undefined || !Number.isFinite(at) || at < alertAt) continue;
    const seen = first.get(reply.conversation_id);
    if (seen === undefined || at < seen) first.set(reply.conversation_id, at);
  }
  return [...first].map(([id, at]) => (at - alertedAt.get(id)!) / 60_000);
}

/** The median in whole minutes, at least one, or null when it would not be
 *  an honest promise. */
export function typicalReplyMinutes(samples: readonly number[]): number | null {
  if (samples.length < MIN_SAMPLES) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2;
  if (median > MAX_MINUTES) return null;
  return Math.max(1, Math.round(median));
}

export async function teamReplyMinutes(siteId: string, now: number = Date.now()): Promise<number | null> {
  const cached = cache.get(siteId);
  if (cached && cached.expiresAt > now) return cached.minutes;
  let minutes: number | null = null;
  try {
    const supabase = getMessengerServiceClient();
    const since = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
    const conversations = await supabase
      .from('widget_conversations')
      .select('id, metadata')
      .eq('widget_site_id', siteId)
      .gte('started_at', since)
      .not('handoff_reason', 'is', null)
      .order('started_at', { ascending: false })
      .limit(300);
    if (conversations.error) throw new Error(conversations.error.message);
    const rows = (conversations.data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>;
    const alerted = rows.filter((row) => readHandoffAlert(row.metadata)?.status === 'sent');
    if (alerted.length >= MIN_SAMPLES) {
      const replies = await supabase
        .from('widget_messages')
        .select('conversation_id, created_at, metadata')
        .in(
          'conversation_id',
          alerted.map((row) => row.id),
        )
        .eq('role', 'assistant')
        .order('created_at', { ascending: true })
        .limit(5000);
      if (replies.error) throw new Error(replies.error.message);
      const human = ((replies.data ?? []) as Array<{
        conversation_id: string;
        created_at: string;
        metadata: { author?: string; internal?: boolean } | null;
      }>).filter((row) => row.metadata?.author === 'human' && !row.metadata?.internal);
      minutes = typicalReplyMinutes(replySamples(alerted, human));
    }
  } catch (error) {
    console.error('[messenger] team reply time failed:', error instanceof Error ? error.message : error);
    // Not cached: the next read can recover.
    return null;
  }
  cache.set(siteId, { minutes, expiresAt: now + CACHE_TTL_MS });
  return minutes;
}

/** Test seam. */
export function clearTeamReplyTimeCache(): void {
  cache.clear();
}
