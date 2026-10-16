/* Whether Store Chat is showing on the store right now. Phase zero item 5.

   The only signal is the loader's own `loader_initialized` event, recorded
   each time it boots on a storefront page. "Live" used to mean that event
   existed at any time in the past, so a store whose theme dropped the block
   months ago still read as live. Now it means seen within a window; after
   that the state is quiet, which the dashboard shows in amber. Forty-eight
   hours keeps a small store's quiet night or weekend from raising an alarm. */

export const STORE_CHAT_QUIET_AFTER_MS = 48 * 60 * 60 * 1000;

export type StoreChatPresence = 'live' | 'quiet' | 'never';

export function storeChatPresence(lastSeenAt: string | null, now: number = Date.now()): StoreChatPresence {
  if (!lastSeenAt) return 'never';
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return 'never';
  return now - seen <= STORE_CHAT_QUIET_AFTER_MS ? 'live' : 'quiet';
}
