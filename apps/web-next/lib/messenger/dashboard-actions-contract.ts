import type { TriageResult } from './attachments';
import type { ActionResult } from './actions-core';
import type { MessengerSection } from './config';

export interface FetchMessagesResult {
  ok: true;
  status: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string; author?: string; internal?: boolean; noteAuthorName?: string; feedback?: 'up' | 'down' }>;
  attachments: Record<string, { url: string; mime: string; triage: TriageResult | null }>;
}

/** What the five host-agnostic editors need from whoever renders them. The
 *  dashboard passes the real server actions (app/dashboard/messenger/actions
 *  already matches this shape field-for-field); the embedded Shopify shell
 *  passes a fetch-backed adapter hitting /api/shopify/store-chat/* instead.
 *  Same components either way — this interface is the only seam. */
export interface MessengerHostActions {
  saveDraftSection(siteId: string, section: MessengerSection, payload: object): Promise<ActionResult>;
  publishConfig(siteId: string): Promise<ActionResult>;
  revertConfigAction(siteId: string): Promise<ActionResult>;
  setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult>;
  addKnowledge(formData: FormData): Promise<ActionResult>;
  updateKnowledgeStatus(siteId: string, entryId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  syncKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  addCannedReply(siteId: string, title: string, content: string): Promise<ActionResult>;
  updateCannedReplyStatus(siteId: string, replyId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteCannedReply(siteId: string, replyId: string): Promise<ActionResult>;
  fetchConversationMessages(siteId: string, conversationId: string): Promise<FetchMessagesResult | { ok: false }>;
  staffReply(siteId: string, conversationId: string, text: string): Promise<ActionResult>;
  /** Ephemeral presence ping while staff type a reply. Debounced client-side
   *  and fired from the reply composer only — never from the note composer,
   *  so a private note can never leak even a "someone is typing" signal to
   *  the shopper. No audit entry, no state refresh: the shopper polls for
   *  the derived boolean on their own cadence. */
  pingStaffTyping(siteId: string, conversationId: string): Promise<ActionResult>;
  /** Staff-only note: visible in the inbox, never to the shopper, and
   *  never part of the conversation turn-taking (no takeover, no status
   *  change, no notification). */
  addInternalNote(siteId: string, conversationId: string, text: string): Promise<ActionResult>;
  takeoverConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  assignConversationAction(siteId: string, conversationId: string, profileId: string): Promise<ActionResult>;
  /** Marks a conversation as seen by the merchant. */
  markConversationRead(siteId: string, conversationId: string): Promise<ActionResult>;
  /** Several sections in one write. Saving them as concurrent single-section
   *  calls loses all but the last — they share one settings_draft object. */
  saveDraftSections(
    siteId: string,
    sections: ReadonlyArray<{ section: MessengerSection; payload: object }>,
  ): Promise<ActionResult>;
  releaseConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  closeConversationAction(siteId: string, conversationId: string): Promise<ActionResult>;
}
