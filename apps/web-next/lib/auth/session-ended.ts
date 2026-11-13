/* The one way a dashboard server action says "nobody is signed in": a
   failure carrying `signedOut: true`. It is a separate flag rather than a
   new error code so every existing `{ ok: false, error }` caller keeps
   working; callers that know about it show the sign-in-again prompt
   instead of an error. Shared by server actions and client components. */

export type SignedOutFailure = { ok: false; signedOut: true };

export const SIGNED_OUT_MESSAGE = 'Your session ended. Sign in again to continue.';

export function isSignedOutResult(value: unknown): value is SignedOutFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    (value as { signedOut?: unknown }).signedOut === true
  );
}

/* Client-side signal from a component that got a signed-out result to the
   dashboard's SessionGuard (components/auth/session-guard.tsx). A plain
   window event, so components outside the dashboard (the Shopify embed
   shares the Inbox panel) can call it without depending on Clerk. */
export const SESSION_ENDED_EVENT = 'gc:session-ended';

let signingOutHere = false;

/** Called right before this tab signs out on purpose: not an ending to report. */
export function beginSignOut(): void {
  signingOutHere = true;
}

/** The sign-out failed: report endings again. */
export function cancelSignOut(): void {
  signingOutHere = false;
}

export function isSigningOutHere(): boolean {
  return signingOutHere;
}

/** A server action found no session: show the sign-in-again prompt. */
export function announceSessionEnded(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

/** The sign-in page, returning to this exact page afterwards. */
export function signInAgainHref(pathAndSearch: string): string {
  return `/sign-in?${new URLSearchParams({ redirect_url: pathAndSearch }).toString()}`;
}
