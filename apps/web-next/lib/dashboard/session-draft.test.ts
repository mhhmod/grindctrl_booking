import { afterEach, describe, expect, it, vi } from 'vitest';
import { peekDraft, saveDraft, takeDraft } from './session-draft';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('session drafts', () => {
  it('keeps text for this tab and hands it back once', () => {
    saveDraft('inbox:site-1', 'Hello, your order shipped');
    expect(peekDraft('inbox:site-1')).toBe('Hello, your order shipped');
    expect(takeDraft('inbox:site-1')).toBe('Hello, your order shipped');
    expect(takeDraft('inbox:site-1')).toBeNull();
  });

  it('forgets a draft saved as empty', () => {
    saveDraft('team-invite', 'a@b.co');
    saveDraft('team-invite', '   ');
    expect(peekDraft('team-invite')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveDraft('k', 'v')).not.toThrow();
    expect(takeDraft('k')).toBeNull();
    expect(peekDraft('k')).toBeNull();
  });
});
