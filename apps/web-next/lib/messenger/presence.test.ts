import { describe, expect, it } from 'vitest';
import { STORE_CHAT_QUIET_AFTER_MS, storeChatPresence } from './presence';

describe('storeChatPresence', () => {
  const now = Date.parse('2026-10-16T12:00:00.000Z');

  it('is live when the loader booted within the window', () => {
    expect(storeChatPresence('2026-10-16T11:58:00.000Z', now)).toBe('live');
    expect(storeChatPresence(new Date(now - STORE_CHAT_QUIET_AFTER_MS).toISOString(), now)).toBe('live');
  });

  it('is quiet once the window has passed, however long ago it was seen', () => {
    expect(storeChatPresence(new Date(now - STORE_CHAT_QUIET_AFTER_MS - 1).toISOString(), now)).toBe('quiet');
    expect(storeChatPresence('2026-07-01T00:00:00.000Z', now)).toBe('quiet');
  });

  it('is never when there is no sighting or it cannot be read', () => {
    expect(storeChatPresence(null, now)).toBe('never');
    expect(storeChatPresence('not a date', now)).toBe('never');
  });
});
