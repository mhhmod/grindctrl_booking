/* The line stored in the transcript when a conversation is handed to the
   team (phase zero item 6), a short record next to the panel's card, which
   says the rest. It says only what is true: sent once an alert really went
   out, saved otherwise. It replaces "You are being connected with our team,
   we will reply here shortly", which was shown whatever happened to the
   alert.

   Arabic uses neutral forms until a store chooses how to address shoppers
   (N26); these are drafts for the owner to check. */

import type { HandoffAlertStatus } from './handoff-alert';

export const HANDOFF_LINES = {
  sent: { en: 'Sent to the team.', ar: 'أُرسلت إلى الفريق.' },
  saved: { en: 'Saved for the team.', ar: 'حُفظت لدى الفريق.' },
} as const;

export function handoffLine(status: HandoffAlertStatus): { en: string; ar: string } {
  return status === 'sent' ? HANDOFF_LINES.sent : HANDOFF_LINES.saved;
}
