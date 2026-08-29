import 'server-only';

import { requestHandoff } from './conversations';
import { notifyHandoff, type NotifyHandoffInput } from './notify';
import type { ConversationRecord } from './types';

/* requestHandoff stays a pure data function; the notification hangs off the
   one place that knows the transition was actually won. A null return means
   somebody else already moved the conversation — no transition, no email. */
export async function escalateAndNotify(
  conversationId: string,
  reason: string,
  summary: string,
  site: NotifyHandoffInput['site'],
): Promise<ConversationRecord | null> {
  const transitioned = await requestHandoff(conversationId, reason, summary);
  if (!transitioned) return null;

  // Fire-and-forget: the shopper's HTTP response must not wait on SMTP.
  void notifyHandoff({
    site,
    conversation: {
      id: transitioned.id,
      handoff_reason: transitioned.handoff_reason,
      handoff_summary: transitioned.handoff_summary,
      metadata: transitioned.metadata as Record<string, unknown>,
    },
  }).catch(() => {});

  return transitioned;
}
