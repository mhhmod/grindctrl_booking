/* Who finished a chat: the assistant, or a person. Pure, so the rule that
   the Store Chat head and Today quote ("answered 86% of 140 chats on its
   own") has one definition and one test.

   A chat counts as answered by the assistant when the assistant replied and
   no person ever took it over. A conversation is not "closed" when the
   shopper leaves, so the status alone says nothing about who answered it. */

export type OutcomeConversation = {
  id: string;
  status: string;
  handoff_reason: string | null;
  assigned_profile_id: string | null;
};

export type OutcomeMessage = {
  conversation_id: string;
  role: string;
  metadata: { author?: string; internal?: boolean } | null;
};

export type ChatOutcomes = { answered: number; handedOff: number };

export function tallyChatOutcomes(conversations: OutcomeConversation[], messages: OutcomeMessage[]): ChatOutcomes {
  const assistantReplied = new Set<string>();
  const personReplied = new Set<string>();
  for (const message of messages) {
    if (message.role !== 'assistant' || message.metadata?.internal) continue;
    if (message.metadata?.author === 'ai') assistantReplied.add(message.conversation_id);
    if (message.metadata?.author === 'human') personReplied.add(message.conversation_id);
  }
  let answered = 0;
  let handedOff = 0;
  for (const chat of conversations) {
    const tookOver = chat.status === 'handoff_active' || Boolean(chat.assigned_profile_id) || personReplied.has(chat.id);
    if (assistantReplied.has(chat.id) && !tookOver) answered += 1;
    // Asked for a person and nobody has answered: still handed on to the team.
    else if (tookOver || chat.handoff_reason || chat.status === 'handoff_requested') handedOff += 1;
  }
  return { answered, handedOff };
}
