import 'server-only';

import { getMessengerServiceClient } from './db';
import type {
  ConversationRecord,
  ConversationStatus,
  MessageRecord,
  MessageRole,
  MessengerLocale,
} from './types';

/* Conversation data access. All queries run as the trusted server client and
   are scoped by widget_site_id — the caller (API routes) is responsible for
   resolving site context from an authorized embed key, never from client
   input alone. */

export const MESSAGE_MAX_LENGTH = 2000;
export const CONTACT_FIELD_MAX = 200;

/** Postgres foreign_key_violation. */
const FOREIGN_KEY_VIOLATION = '23503';

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    id: row.id as string,
    widget_site_id: row.widget_site_id as string,
    visitor_id: row.visitor_id as string,
    status: row.status as ConversationStatus,
    started_at: row.started_at as string,
    last_message_at: isoOrNull(row.last_message_at),
    assigned_profile_id: (row.assigned_profile_id as string | null) ?? null,
    handoff_reason: (row.handoff_reason as string | null) ?? null,
    handoff_summary: (row.handoff_summary as string | null) ?? null,
    metadata: (row.metadata as ConversationRecord['metadata']) ?? {},
  };
}

function mapMessage(row: Record<string, unknown>): MessageRecord {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as MessageRole,
    content: row.content as string,
    content_type: (row.content_type as MessageRecord['content_type']) ?? 'text',
    created_at: row.created_at as string,
    metadata: (row.metadata as MessageRecord['metadata']) ?? {},
  };
}

/* ── Visitors ─────────────────────────────────────────────────────────── */

export async function upsertVisitor(input: {
  siteId: string;
  anonymousId: string;
  identity?: { customerId: string; email: string; name: string } | null;
}): Promise<{ id: string }> {
  const supabase = getMessengerServiceClient();
  const metadata = input.identity ? { shopify_customer_id: input.identity.customerId } : {};
  const payload: Record<string, unknown> = {
    widget_site_id: input.siteId,
    anonymous_id: input.anonymousId,
    last_seen_at: new Date().toISOString(),
    ...(input.identity ? { user_email: input.identity.email, user_name: input.identity.name } : {}),
  };
  const res = await supabase
    .from('widget_visitors')
    .upsert(payload, {
      onConflict: 'widget_site_id,anonymous_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();
  if (res.error) throw new Error(`visitor upsert failed: ${res.error.message}`);
  void metadata;
  return { id: res.data.id as string };
}

export async function getVisitor(siteId: string, anonymousId: string): Promise<{ id: string } | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_visitors')
    .select('id')
    .eq('widget_site_id', siteId)
    .eq('anonymous_id', anonymousId)
    .maybeSingle();
  if (res.error) throw new Error(`visitor lookup failed: ${res.error.message}`);
  return res.data ? { id: res.data.id as string } : null;
}

/* ── Conversations ────────────────────────────────────────────────────── */

/** Returns the shopper's active conversation or creates one. Active means
 *  not closed — handoff states continue in the same thread so shoppers
 *  never lose history across a takeover. */
export async function ensureOpenConversation(siteId: string, visitorId: string): Promise<ConversationRecord> {
  const supabase = getMessengerServiceClient();
  const existing = await supabase
    .from('widget_conversations')
    .select('*')
    .eq('visitor_id', visitorId)
    .in('status', ['open', 'handoff_requested', 'handoff_active'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`conversation lookup failed: ${existing.error.message}`);
  if (existing.data) return mapConversation(existing.data as Record<string, unknown>);

  const inserted = await supabase
    .from('widget_conversations')
    .insert({ widget_site_id: siteId, visitor_id: visitorId, status: 'open' })
    .select('*')
    .single();
  if (inserted.error) throw new Error(`conversation create failed: ${inserted.error.message}`);
  return mapConversation(inserted.data as unknown as Record<string, unknown>);
}

export async function getConversationForSite(
  conversationId: string,
  siteId: string,
): Promise<ConversationRecord | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('widget_site_id', siteId)
    .maybeSingle();
  if (res.error) throw new Error(`conversation lookup failed: ${res.error.message}`);
  return res.data ? mapConversation(res.data as Record<string, unknown>) : null;
}

export async function getConversationForVisitor(
  conversationId: string,
  visitorId: string,
): Promise<ConversationRecord | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('visitor_id', visitorId)
    .maybeSingle();
  if (res.error) throw new Error(`conversation lookup failed: ${res.error.message}`);
  return res.data ? mapConversation(res.data as Record<string, unknown>) : null;
}

export async function listConversationsForSite(
  siteId: string,
  options?: { limit?: number },
): Promise<Array<ConversationRecord & { visitor_email: string | null; visitor_name: string | null }>> {
  const supabase = getMessengerServiceClient();
  const limit = Math.min(options?.limit ?? 30, 100);
  const rows = await supabase
    .from('widget_conversations')
    .select('*, widget_visitors(user_email, user_name)')
    .eq('widget_site_id', siteId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (rows.error) throw new Error(`conversation list failed: ${rows.error.message}`);
  return ((rows.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const visitor = (row.widget_visitors as Array<Record<string, unknown>> | null)?.[0];
    return {
      ...mapConversation(row),
      visitor_email: (visitor?.user_email as string | undefined) ?? null,
      visitor_name: (visitor?.user_name as string | undefined) ?? null,
    };
  });
}

/* ── Messages ─────────────────────────────────────────────────────────── */

/** Idempotent append: a repeated client_key for the same conversation
 *  returns the ORIGINAL message instead of creating a duplicate. */
export async function appendMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
  clientKey?: string | null;
  contentType?: MessageRecord['content_type'];
  metadata?: MessageRecord['metadata'];
}): Promise<{ message: MessageRecord; replayed: boolean }> {
  const supabase = getMessengerServiceClient();
  const insert = await supabase
    .from('widget_messages')
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content.slice(0, MESSAGE_MAX_LENGTH),
      content_type: input.contentType ?? 'text',
      client_key: input.clientKey ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (!insert.error) {
    await touchConversation(input.conversationId);
    return { message: mapMessage(insert.data as unknown as Record<string, unknown>), replayed: false };
  }

  // Unique-violation on the partial index → this exact client_key already
  // landed (network retry / double tap). Serve the original row.
  if ((insert.error as { code?: string }).code === '23505' && input.clientKey) {
    const existing = await supabase
      .from('widget_messages')
      .select('*')
      .eq('conversation_id', input.conversationId)
      .eq('client_key', input.clientKey)
      .maybeSingle();
    if (existing.data) {
      return { message: mapMessage(existing.data as Record<string, unknown>), replayed: true };
    }
  }
  throw new Error(`message append failed: ${insert.error.message}`);
}

export async function listMessages(
  conversationId: string,
  options?: { afterIso?: string | null; limit?: number },
): Promise<MessageRecord[]> {
  const supabase = getMessengerServiceClient();
  let query = supabase
    .from('widget_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(Math.min(options?.limit ?? 100, 200));
  if (options?.afterIso) query = query.gt('created_at', options.afterIso);
  const rows = await query;
  if (rows.error) throw new Error(`messages query failed: ${rows.error.message}`);
  return ((rows.data ?? []) as Array<Record<string, unknown>>).map(mapMessage);
}

async function touchConversation(conversationId: string): Promise<void> {
  const supabase = getMessengerServiceClient();
  await supabase
    .from('widget_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

/* ── Ownership transitions (guarded, optimistic) ──────────────────────── */

async function guardedTransition(
  conversationId: string,
  expectedStatuses: ConversationStatus[],
  patch: Partial<{
    status: ConversationStatus;
    assigned_profile_id: string | null;
    handoff_reason: string | null;
    handoff_summary: string | null;
  }>,
): Promise<ConversationRecord | null> {
  const supabase = getMessengerServiceClient();
  const res = await supabase
    .from('widget_conversations')
    .update(patch)
    .eq('id', conversationId)
    .in('status', expectedStatuses)
    .select('*');
  if (res.error) throw new Error(`transition failed: ${res.error.message}`);
  const row = (res.data ?? [])[0] as Record<string, unknown> | undefined;
  return row ? mapConversation(row) : null;
}

/** Re-asserts, atomically, that the AI still owns the mic — the status read
 *  at the start of a turn is stale by the time the model answers, and a staff
 *  takeover lands in exactly that window. False means a human (or a close)
 *  won the race and the generated reply must be discarded, not stored on top
 *  of them. The no-op status write is the guard; only the WHERE matters. */
export async function claimAiTurn(conversationId: string): Promise<boolean> {
  const kept = await guardedTransition(conversationId, ['open'], { status: 'open' });
  return kept !== null;
}

/** Shopper asked for a human (or AI decided to escalate). AI loses the mic
 *  the instant this lands: aiMayAnswer checks status === 'open'. */
export async function requestHandoff(
  conversationId: string,
  reason: string,
  summary: string,
): Promise<ConversationRecord | null> {
  return guardedTransition(conversationId, ['open'], {
    status: 'handoff_requested',
    handoff_reason: reason.slice(0, 500),
    handoff_summary: summary.slice(0, 2000),
  });
}

export async function takeOverConversation(
  conversationId: string,
  profileId: string,
): Promise<ConversationRecord | null> {
  return guardedTransition(conversationId, ['open', 'handoff_requested'], {
    status: 'handoff_active',
    assigned_profile_id: profileId,
  });
}

export async function returnConversationToAi(conversationId: string): Promise<ConversationRecord | null> {
  return guardedTransition(conversationId, ['handoff_active'], {
    status: 'open',
    assigned_profile_id: null,
  });
}

export async function closeConversation(conversationId: string): Promise<ConversationRecord | null> {
  return guardedTransition(
    conversationId,
    ['open', 'handoff_requested', 'handoff_active'],
    { status: 'closed' },
  );
}

export function aiMayAnswer(conversation: ConversationRecord): boolean {
  return conversation.status === 'open';
}

/* ── Events / feedback / audit ────────────────────────────────────────── */

export async function recordEvent(input: {
  siteId: string;
  conversationId?: string | null;
  eventName: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  const row = {
    widget_site_id: input.siteId,
    conversation_id: input.conversationId ?? null,
    event_name: input.eventName,
    payload: input.payload ?? {},
  };
  const res = await supabase.from('widget_events').insert(row);
  if (!res.error) return;

  /* A shopper's browser can hold a conversation id that no longer exists
     (conversation deleted, store swapped, storage restored onto another
     site). That must cost us the association, not the whole event — else
     analytics goes quietly blank for exactly the visitors having trouble. */
  if (res.error.code === FOREIGN_KEY_VIOLATION && row.conversation_id) {
    const retry = await supabase.from('widget_events').insert({ ...row, conversation_id: null });
    if (!retry.error) return;
    console.error('[messenger] event insert failed:', retry.error.message);
    return;
  }
  console.error('[messenger] event insert failed:', res.error.message);
}

export async function recordFeedback(input: {
  siteId: string;
  conversationId: string;
  visitorId: string | null;
  rating: 'up' | 'down';
  comment?: string | null;
}): Promise<boolean> {
  const supabase = getMessengerServiceClient();
  const res = await supabase.from('messenger_feedback').upsert(
    {
      widget_site_id: input.siteId,
      conversation_id: input.conversationId,
      visitor_id: input.visitorId,
      rating: input.rating,
      comment: input.comment?.slice(0, 1000) || null,
    },
    { onConflict: 'conversation_id', ignoreDuplicates: true },
  );
  if (res.error) {
    console.error('[messenger] feedback insert failed:', res.error.message);
    return false;
  }
  return true;
}

export async function recordAudit(input: {
  siteId: string;
  actorProfileId?: string | null;
  actorClerkUserId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getMessengerServiceClient();
  const res = await supabase.from('messenger_audit').insert({
    widget_site_id: input.siteId,
    actor_profile_id: input.actorProfileId ?? null,
    actor_clerk_user_id: input.actorClerkUserId ?? null,
    action: input.action,
    detail: input.detail ?? {},
  });
  if (res.error) console.error('[messenger] audit insert failed:', res.error.message);
}

/* ── Overview aggregates ─────────────────────────────────────────────── */

export interface MessengerOverviewStats {
  conversations7d: number;
  aiResolved7d: number;
  handedOff7d: number;
  openNow: number;
  medianFirstResponseSeconds7d: number | null;
  feedbackUp30d: number;
  feedbackDown30d: number;
}

export async function getOverviewStats(siteId: string): Promise<MessengerOverviewStats> {
  const supabase = getMessengerServiceClient();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const convRows = await supabase
    .from('widget_conversations')
    .select('id, status, started_at, handoff_reason')
    .eq('widget_site_id', siteId)
    .gte('started_at', since7d)
    .order('started_at', { ascending: false })
    .limit(500);
  if (convRows.error) throw new Error(`overview conversations failed: ${convRows.error.message}`);

  const conversations = (convRows.data ?? []) as Array<Record<string, unknown>>;
  const ids = conversations.map((c) => c.id as string);

  let aiResolved7d = 0;
  let handedOff7d = 0;
  let openNow = 0;

  for (const c of conversations) {
    const status = c.status as ConversationStatus;
    if (status === 'open' || status === 'handoff_requested' || status === 'handoff_active') openNow += 1;
    if (status === 'closed') {
      // A handoff reason on a closed conversation means a human finished it.
      if (c.handoff_reason) handedOff7d += 1;
      else aiResolved7d += 1;
    }
    if (status === 'handoff_requested' || status === 'handoff_active') handedOff7d += 1;
  }

  let medianFirstResponseSeconds7d: number | null = null;
  let feedbackUp30d = 0;
  let feedbackDown30d = 0;

  if (ids.length > 0) {
    const msgRows = await supabase
      .from('widget_messages')
      .select('conversation_id, role, metadata, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (!msgRows.error) {
      const firstUserAt = new Map<string, number>();
      const firstAiAt = new Map<string, number>();
      for (const raw of (msgRows.data ?? []) as Array<Record<string, unknown>>) {
        const cid = raw.conversation_id as string;
        const at = new Date(raw.created_at as string).getTime();
        const meta = (raw.metadata ?? {}) as MessageRecord['metadata'];
        if (raw.role === 'user' && !firstUserAt.has(cid)) firstUserAt.set(cid, at);
        if (raw.role === 'assistant' && meta.author === 'ai' && !firstAiAt.has(cid)) {
          firstAiAt.set(cid, at);
        }
      }
      const samples: number[] = [];
      for (const [cid, userAt] of firstUserAt) {
        const aiAt = firstAiAt.get(cid);
        if (aiAt !== undefined && aiAt >= userAt) samples.push((aiAt - userAt) / 1000);
      }
      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        medianFirstResponseSeconds7d = Math.round(samples[Math.floor(samples.length / 2)]);
      }
    }

    const feedbackRows = await supabase
      .from('messenger_feedback')
      .select('rating')
      .eq('widget_site_id', siteId)
      .gte('created_at', since30d);
    if (!feedbackRows.error) {
      for (const row of (feedbackRows.data ?? []) as Array<{ rating: string }>) {
        if (row.rating === 'up') feedbackUp30d += 1;
        else feedbackDown30d += 1;
      }
    }
  }

  return {
    conversations7d: conversations.length,
    aiResolved7d,
    handedOff7d,
    openNow,
    medianFirstResponseSeconds7d,
    feedbackUp30d,
    feedbackDown30d,
  };
}
