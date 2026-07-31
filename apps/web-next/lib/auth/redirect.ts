/* Where to send someone after they authenticate.

   Clerk's `fallbackRedirectUrl` only applies when the flow carries no
   redirect_url of its own, and otherwise defaults to "/". An OAuth callback
   supplies its own value, so the fallback never fired and users landed on
   the marketing home page after signing in with Google or GitHub. The fix is
   `forceRedirectUrl`, which always wins.

   But forcing a single destination would discard the page someone was
   actually trying to reach, which the middleware puts in redirect_url when it
   bounces them to sign-in. So the destination is computed here instead:
   honour redirect_url when it is safe, fall back to the dashboard otherwise. */

export const DEFAULT_SIGNED_IN_PATH = '/dashboard/overview';

/* New accounts always route through onboarding. The onboarding page forwards
   anyone who has already completed it, so this stays correct for a returning
   user who happens to hit the sign-up flow. */
export const POST_SIGN_UP_PATH = '/onboarding';

/* Checked by character code rather than a regex on purpose. A character class
   of literal control bytes is invisible in an editor and can be stripped by
   tooling without producing any visible diff, silently disabling the guard. */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/* redirect_url arrives from the query string, so it is attacker-controlled.
   Anything absolute, protocol-relative ("//evil.com", which browsers treat as
   a host), or backslash-prefixed (some parsers normalise "\\" to "/") is an
   open redirect and is rejected. Only same-site absolute paths pass. */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  if (/^\/+[\\/]/.test(trimmed)) return null;

  if (hasControlCharacter(trimmed)) return null;

  return trimmed;
}

export function resolveSignInDestination(redirectUrl: unknown): string {
  return safeRedirectPath(redirectUrl) ?? DEFAULT_SIGNED_IN_PATH;
}
