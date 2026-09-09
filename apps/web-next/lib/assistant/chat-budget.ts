import { SYSTEM_PROMPT } from './system-prompt';

export const CHAT_MAX_COMPLETION_TOKENS = 1024;

/** Conservative byte-token upper bound, including framing and completion.
 * Do not bill a long history as a flat 800-token turn. This is an operational
 * reservation, not measured usage; no refund is issued without an idempotent
 * settlement ledger. Large contexts may therefore require a new conversation. */
export function chatReservationTokens(messages: ReadonlyArray<{ role: string; content: string }>) {
  return messages.reduce((total, message) =>
    total + Buffer.byteLength(message.role, 'utf8') + Buffer.byteLength(message.content, 'utf8') + 64,
  CHAT_MAX_COMPLETION_TOKENS);
}

export const CHAT_MIN_RESERVATION_TOKENS = chatReservationTokens([
  { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: 'x' },
]);
