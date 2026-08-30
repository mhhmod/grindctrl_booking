'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import {
  requireOwnedSite,
  getProfileId,
  UnauthorizedError,
} from '@/lib/messenger/provisioning';
import {
  appendMessage,
  recordAudit,
  returnConversationToAi,
  takeOverConversation,
  closeConversation,
  getConversationForSite,
} from '@/lib/messenger/conversations';
import {
  addManualKnowledge,
  addUrlKnowledge,
  removeKnowledge,
  setKnowledgeStatus,
  reSyncKnowledge,
} from '@/lib/messenger/knowledge';
import {
  listConversationAttachments,
  signAttachmentUrls,
  type TriageResult,
} from '@/lib/messenger/attachments';
import type { MessengerSection } from '@/lib/messenger/config';
import type { MessengerConfig } from '@/lib/messenger/types';
import { saveDraftSectionForSite, publishConfigForSite, setMessengerEnabledForSite } from '@/lib/messenger/actions-core';
import type { ActionResult } from '@/lib/messenger/actions-core';

export type { ActionResult };

async function currentUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  if (error instanceof UnauthorizedError) return { ok: false, error: message };
  console.error('[messenger action]', message);
  // Never surface raw internals to the dashboard.
  return { ok: false, error: 'Action failed. Please try again.' };
}

/* ── Configuration draft / publish ───────────────────────────────────── */

/** Drafts are stored as a partial settings_json patch under the same
 *  messenger_* keys; publish merges over published and bumps the version
 *  atomically in one UPDATE. */
export async function saveDraftSection(
  siteId: string,
  section: MessengerSection,
  payload: object,
): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await saveDraftSectionForSite(site, section, payload);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}

export async function publishConfig(siteId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await publishConfigForSite(site, userId);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}

export async function discardDraft(siteId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const supabase = getMessengerServiceClient();
    const res = await supabase.from('widget_sites').update({ settings_draft: null }).eq('id', site.id);
    if (res.error) throw new Error(res.error.message);
    await recordAudit({ siteId, actorClerkUserId: userId, action: 'draft_discarded' });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    const result = await setMessengerEnabledForSite(site, userId, enabled);
    if (result.ok) revalidatePath('/dashboard/messenger');
    return result;
  } catch (error) {
    return fail(error);
  }
}

/* ── Knowledge ───────────────────────────────────────────────────────── */

export async function addKnowledge(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const siteId = String(formData.get('siteId') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim();

    if (!siteId) return { ok: false, error: 'Missing site.' };
    const site = await requireOwnedSite(userId, siteId);
    if (url) {
      await addUrlKnowledge({ site, actorClerkUserId: userId, url });
      revalidatePath('/dashboard/messenger');
      return { ok: true, message: 'Page added to knowledge.' };
    }
    if (!title || !content) return { ok: false, error: 'Title and content are required.' };
    await addManualKnowledge({ site, actorClerkUserId: userId, title, content });
    revalidatePath('/dashboard/messenger');
    return { ok: true, message: 'Added to knowledge.' };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    // Friendly copy for expected fetch failures surfaced by URL import.
    // Word-boundary match: a plain substring test would let a raw Postgres
    // error through whenever a column or constraint name merely contains
    // "url" as part of a longer identifier (e.g. "source_url").
    const friendly = /\b(https?|url|page|readable)\b/i.test(raw) ? raw : undefined;
    return fail(friendly ? new Error(friendly) : error);
  }
}

export async function updateKnowledgeStatus(
  siteId: string,
  entryId: string,
  status: 'active' | 'disabled',
): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await setKnowledgeStatus({ site, entryId, status });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await removeKnowledge({ site, actorClerkUserId: userId, entryId });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function syncKnowledge(siteId: string, entryId: string): Promise<ActionResult> {
  try {
    const userId = await currentUser();
    const site = await requireOwnedSite(userId, siteId);
    await reSyncKnowledge({ site, entryId });
    revalidatePath('/dashboard/messenger');
    return { ok: true, message: 'Re-synced.' };
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    // Word-boundary match: a plain substring test would let a raw Postgres
    // error through whenever a column or constraint name merely contains
    // "url" as part of a longer identifier (e.g. "source_url").
    const friendly = /\b(https?|url|page|readable)\b/i.test(raw) ? raw : undefined;
    return fail(friendly ? new Error(friendly) : error);
  }
}

/* ── Staff conversation actions (human side of handoff) ──────────────── */

async function ownedConversation(siteId: string, conversationId: string) {
  const userId = await currentUser();
  const site = await requireOwnedSite(userId, siteId);
  const conversation = await getConversationForSite(conversationId, site.id);
  if (!conversation) throw new UnauthorizedError();
  return { userId, site, conversation };
}

/** Read model for the conversations panel. */
export async function fetchConversationMessages(
  siteId: string,
  conversationId: string,
): Promise<
  | {
      ok: true;
      status: string;
      messages: Array<{ id: string; role: string; content: string; createdAt: string; author?: string }>;
      /** messageId -> viewable image. URLs expire in five minutes and are
       *  minted per request, after ownedConversation() proved this staff
       *  member owns the site the attachment belongs to. */
      attachments: Record<string, { url: string; mime: string; triage: TriageResult | null }>;
    }
  | { ok: false }
> {
  try {
    const { conversation } = await ownedConversation(siteId, conversationId);
    const { listMessages } = await import('@/lib/messenger/conversations');
    const [messages, rows] = await Promise.all([
      listMessages(conversation.id, { limit: 200 }),
      listConversationAttachments(conversation.id),
    ]);

    const linked = rows.filter((row) => row.message_id);
    const signed = await signAttachmentUrls(linked.map((row) => row.storage_path));
    const attachments: Record<string, { url: string; mime: string; triage: TriageResult | null }> = {};
    for (const row of linked) {
      const url = signed[row.storage_path];
      if (url) attachments[row.message_id as string] = { url, mime: row.mime, triage: row.triage };
    }

    return {
      ok: true,
      status: conversation.status,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        author: m.metadata.author ?? (m.role === 'assistant' ? 'ai' : undefined),
      })),
      attachments,
    };
  } catch (error) {
    console.error('[messenger] fetchConversationMessages:', error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

export async function staffReply(
  siteId: string,
  conversationId: string,
  text: string,
): Promise<ActionResult> {
  try {
    const { userId, conversation } = await ownedConversation(siteId, conversationId);
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed) return { ok: false, error: 'Message is empty.' };

    // Replying IS taking ownership when the thread is still queued for AI.
    let current = conversation;
    if (current.status === 'open') {
      const taken = await takeOverConversation(conversationId, await getProfileId(userId));
      if (!taken) return { ok: false, error: 'Conversation state changed. Refresh and retry.' };
      current = taken;
    }

    const saved = await appendMessage({
      conversationId,
      role: 'assistant',
      content: trimmed,
      metadata: { author: 'human' },
    });
    void saved;
    await recordAudit({
      siteId,
      actorClerkUserId: userId,
      action: 'conversation_taken_over',
      detail: { conversationId },
    });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function takeoverConversation(siteId: string, conversationId: string): Promise<ActionResult> {
  try {
    const { userId } = await ownedConversation(siteId, conversationId);
    const taken = await takeOverConversation(conversationId, await getProfileId(userId));
    if (!taken) return { ok: false, error: 'Conversation is no longer available for takeover.' };
    await recordAudit({
      siteId,
      actorClerkUserId: userId,
      action: 'conversation_taken_over',
      detail: { conversationId },
    });
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function releaseConversation(siteId: string, conversationId: string): Promise<ActionResult> {
  try {
    await ownedConversation(siteId, conversationId);
    const released = await returnConversationToAi(conversationId);
    if (!released) return { ok: false, error: 'Only an active human conversation can be returned to AI.' };
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function closeConversationAction(siteId: string, conversationId: string): Promise<ActionResult> {
  try {
    await ownedConversation(siteId, conversationId);
    const closed = await closeConversation(conversationId);
    if (!closed) return { ok: false, error: 'Conversation already closed.' };
    revalidatePath('/dashboard/messenger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
