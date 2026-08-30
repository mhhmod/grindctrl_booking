import type { TriageResult } from './attachments';
import type { ActionResult } from './actions-core';
import type { MessengerSection } from './config';

export interface FetchMessagesResult {
  ok: true;
  status: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string; author?: string }>;
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
  setMessengerEnabled(siteId: string, enabled: boolean): Promise<ActionResult>;
  addKnowledge(formData: FormData): Promise<ActionResult>;
  updateKnowledgeStatus(siteId: string, entryId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  syncKnowledge(siteId: string, entryId: string): Promise<ActionResult>;
  fetchConversationMessages(siteId: string, conversationId: string): Promise<FetchMessagesResult | { ok: false }>;
  staffReply(siteId: string, conversationId: string, text: string): Promise<ActionResult>;
  takeoverConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  releaseConversation(siteId: string, conversationId: string): Promise<ActionResult>;
  closeConversationAction(siteId: string, conversationId: string): Promise<ActionResult>;
}
