/* Shopper contact capture — the decision and the validation, kept pure so
   both the send route (which decides whether to offer the block) and the
   contact route (which accepts what was typed) agree without either
   importing the other.

   No 'server-only' here: this module touches no secrets and no database,
   and keeping it importable means the rules can be unit-tested directly. */

import type { MessengerContactCapture } from './types';

export const CONTACT_EMAIL_MAX = 200;

/* Same shape rule as notification recipients in config.ts. Deliberately
   permissive about the local part — the address is a reply-to hint typed by
   a shopper, and rejecting a valid-but-unusual address is the worse error
   here. What it must NOT accept is a list. */
const EMAIL_SHAPE_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** Returns the lowercased address, or null if it is not a single address. */
export function normalizeContactEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > CONTACT_EMAIL_MAX) return null;
  // A header-injection attempt and a pasted list look the same from here;
  // both are rejected by refusing anything but one clean address.
  if (/[\r\n<>]/.test(trimmed)) return null;
  return EMAIL_SHAPE_RE.test(trimmed) ? trimmed : null;
}

export interface ContactPromptInput {
  config: MessengerContactCapture;
  /** metadata.contact_prompted_at — asked once per conversation, ever. */
  alreadyPrompted: boolean;
  /** Verified-login or previously captured address; either one ends it. */
  knownEmail: string | null;
  /** This turn moved the conversation into handoff_requested. */
  justEscalated: boolean;
  /** isWithinAvailabilityHours() for the site, evaluated this turn. */
  withinHours: boolean;
}

/** Both triggers are moments where a reply is genuinely owed later. A
 *  shopper the AI answered instantly is never asked — that would be lead
 *  capture wearing a support costume. */
export function shouldAskForContact(input: ContactPromptInput): boolean {
  if (!input.config.enabled) return false;
  if (input.alreadyPrompted) return false;
  if (input.knownEmail) return false;
  if (input.justEscalated) return true;
  return input.config.askOutsideHours && !input.withinHours;
}
