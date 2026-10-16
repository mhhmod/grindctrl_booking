import 'server-only';

import { patchConversationMetadata, requestHandoff } from './conversations';
import { notifyHandoff, type NotifyHandoffInput } from './notify';
import type { HandoffAlert } from './handoff-alert';
import type { ConversationRecord } from './types';

/* How long the shopper's answer waits for the alert to go out. The alert
   keeps going after this; its outcome reaches the panel through sync. */
export const ALERT_WAIT_MS = 4_000;

export interface Escalation {
  conversation: ConversationRecord;
  alert: HandoffAlert;
}

export interface EscalateOptions {
  /** After hours (n23_after_hours): nobody is alerted now. The alert waits
   *  for this instant, when the team is next in; null means the team has no
   *  hours at all, so nobody will be alerted. */
  deferUntil?: string | null;
  waitMs?: number;
}

function pendingAlert(attempts = 0): HandoffAlert {
  return { status: 'pending', reason: null, channels: [], at: new Date().toISOString(), attempts };
}

/* requestHandoff stays a pure data function; the notification hangs off the
   one place that knows the transition was actually won. A null return means
   somebody else already moved the conversation — no transition, no email.

   The caller learns whether someone was really alerted (phase zero item 6),
   so the shopper reads "The team has your message" only when it is true. */
export async function escalateAndNotify(
  conversationId: string,
  reason: string,
  summary: string,
  site: NotifyHandoffInput['site'],
  options: EscalateOptions = {},
): Promise<Escalation | null> {
  const transitioned = await requestHandoff(conversationId, reason, summary);
  if (!transitioned) return null;

  if (options.deferUntil !== undefined) {
    const alert: HandoffAlert = {
      status: options.deferUntil ? 'pending' : 'none',
      reason: 'after_hours',
      channels: [],
      at: new Date().toISOString(),
      attempts: 0,
      dueAt: options.deferUntil,
    };
    await patchConversationMetadata(transitioned.id, { handoff_alert: alert }).catch(() => {});
    return { conversation: transitioned, alert };
  }

  const notifying = notifyHandoff({
    site,
    conversation: {
      id: transitioned.id,
      handoff_reason: transitioned.handoff_reason,
      handoff_summary: transitioned.handoff_summary,
      metadata: transitioned.metadata as Record<string, unknown>,
    },
  }).catch(() => pendingAlert());

  // The shopper's HTTP response waits a little for SMTP, never long.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<HandoffAlert>((resolve) => {
    timer = setTimeout(() => resolve(pendingAlert()), options.waitMs ?? ALERT_WAIT_MS);
  });
  const alert = await Promise.race([notifying, waited]);
  if (timer) clearTimeout(timer);
  return { conversation: transitioned, alert };
}
