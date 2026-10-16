/* Whether someone was really alerted about a handoff (v16 phase zero item 6).

   The shopper's copy depends on it: "The team has your message" only when an
   alert actually went out, and an honest "tell us where to reply" otherwise.
   The outcome lives in the conversation's metadata, so the send route, the
   panel's sync and bootstrap, the retry worker and the dashboard all read
   the same answer.

   No 'server-only' here: the types and readers are shared with tests, and
   the writer takes the database client from its caller's module. */

export type HandoffAlertStatus = 'sent' | 'pending' | 'none';

/** Why an alert did not go out, or is still waiting. */
export type HandoffAlertReason =
  | 'disabled'
  | 'smtp_not_configured'
  | 'no_recipient'
  | 'throttled'
  | 'already_claimed'
  | 'send_failed'
  | 'error'
  | 'after_hours';

export interface HandoffAlert {
  status: HandoffAlertStatus;
  reason: HandoffAlertReason | null;
  channels: Array<'email'>;
  /** When this outcome was reached. */
  at: string;
  /** How many times an alert was tried for this handoff. */
  attempts: number;
  /** A deferred alert (after hours) is not sent before this time. */
  dueAt?: string | null;
}

/** What the shopper's panel is told. Reasons stay server-side: they describe
 *  the merchant's setup, not the shopper's conversation. */
export interface PublicHandoffAlert {
  status: HandoffAlertStatus;
  channels: Array<'email'>;
  at: string;
  /** The team is away, so the alert waits for opening time (n23_after_hours). */
  afterHours: boolean;
}

const STATUSES: readonly HandoffAlertStatus[] = ['sent', 'pending', 'none'];

export function readHandoffAlert(metadata: Record<string, unknown> | null | undefined): HandoffAlert | null {
  const raw = metadata?.handoff_alert;
  if (!raw || typeof raw !== 'object') return null;
  const alert = raw as Partial<HandoffAlert>;
  if (!STATUSES.includes(alert.status as HandoffAlertStatus) || typeof alert.at !== 'string') return null;
  return {
    status: alert.status as HandoffAlertStatus,
    reason: (alert.reason ?? null) as HandoffAlertReason | null,
    channels: Array.isArray(alert.channels) ? alert.channels.filter((c): c is 'email' => c === 'email') : [],
    at: alert.at,
    attempts: typeof alert.attempts === 'number' ? alert.attempts : 0,
    dueAt: typeof alert.dueAt === 'string' ? alert.dueAt : null,
  };
}

export function toPublicHandoffAlert(alert: HandoffAlert | null): PublicHandoffAlert | null {
  return alert
    ? { status: alert.status, channels: alert.channels, at: alert.at, afterHours: alert.reason === 'after_hours' }
    : null;
}

/** The alert for a conversation's current handoff, as the panel should see
 *  it. Only a conversation waiting on, or with, a person has one. */
export function publicAlertFor(conversation: {
  status: string;
  metadata: Record<string, unknown> | null | undefined;
}): PublicHandoffAlert | null {
  if (conversation.status !== 'handoff_requested' && conversation.status !== 'handoff_active') return null;
  return toPublicHandoffAlert(readHandoffAlert(conversation.metadata));
}

/** True when the retry worker should try this alert again now. */
export function alertIsDue(alert: HandoffAlert | null, now: number): boolean {
  if (!alert || alert.status !== 'pending') return false;
  if (alert.dueAt) {
    const due = Date.parse(alert.dueAt);
    return Number.isFinite(due) && due <= now;
  }
  return true;
}
