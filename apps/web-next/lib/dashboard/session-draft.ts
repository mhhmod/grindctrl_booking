/* Unsent text kept across a sign-in, in this tab only (sessionStorage), so
   a reply typed while the session ended is still there afterwards. Storage
   can be missing or full (private windows, blocked site data): every call
   is best-effort and never throws. */

const PREFIX = 'gc:draft:';

export function saveDraft(key: string, value: string): void {
  try {
    if (value.trim()) window.sessionStorage.setItem(PREFIX + key, value);
    else window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Storage unavailable: the text stays only in the open page.
  }
}

/** Reads a kept draft and leaves it in place (cleared by saving ''). */
export function peekDraft(key: string): string | null {
  try {
    return window.sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** Reads a kept draft once and forgets it. */
export function takeDraft(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(PREFIX + key);
    if (value !== null) window.sessionStorage.removeItem(PREFIX + key);
    return value;
  } catch {
    return null;
  }
}
