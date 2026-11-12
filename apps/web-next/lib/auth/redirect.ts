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

export const DEFAULT_SIGNED_IN_PATH = '/dashboard';

/* New accounts always route through onboarding. The onboarding page forwards
   anyone who has already completed it, so this stays correct for a returning
   user who happens to hit the sign-up flow. */
export const POST_SIGN_UP_PATH = '/onboarding';

/* Where signing out lands: sign-in, with a line confirming it worked. Used by
   the dashboard's sign-out and as Clerk's own afterSignOutUrl. */
export const SIGNED_OUT_PATH = '/sign-in?signed_out=1';

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

const AUTH_PATHS = ['/sign-in', '/sign-up', '/login'];

/* Sending someone back to an auth page after they authenticate is a loop:
   Clerk's forced redirect lands a signed-in person on the form again. */
function isAuthPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0].toLowerCase().replace(/\/+$/, '');
  return AUTH_PATHS.some((authPath) => pathname === authPath || pathname.startsWith(`${authPath}/`));
}

/* redirect_url arrives from the query string, so it is attacker-controlled.
   Anything absolute, protocol-relative ("//evil.com", which browsers treat as
   a host), or backslash-prefixed (some parsers normalise "\\" to "/") is an
   open redirect and is rejected. Only same-site absolute paths pass, and
   never an auth page. */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  if (/^\/+[\\/]/.test(trimmed)) return null;

  if (hasControlCharacter(trimmed)) return null;
  if (isAuthPath(trimmed)) return null;

  return trimmed;
}

export function resolveSignInDestination(redirectUrl: unknown): string {
  return safeRedirectPath(redirectUrl) ?? DEFAULT_SIGNED_IN_PATH;
}

/* Where onboarding sends someone when it is done: the page they were on
   their way to, or the store page. Onboarding itself is not a destination. */
export const POST_ONBOARDING_PATH = '/dashboard/store';

export function resolveOnboardingNext(next: unknown): string | null {
  const safe = safeRedirectPath(next);
  if (!safe) return null;
  const pathname = safe.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return pathname === POST_SIGN_UP_PATH ? null : safe;
}

/** Onboarding, carrying the page a new account was on its way to. */
export function onboardingPath(next: unknown): string {
  const safe = resolveOnboardingNext(next);
  if (!safe || safe === DEFAULT_SIGNED_IN_PATH) return POST_SIGN_UP_PATH;
  return `${POST_SIGN_UP_PATH}?${new URLSearchParams({ next: safe }).toString()}`;
}

/* A new account goes through onboarding first, then on to the page it was
   on its way to (a claim link, a dashboard deep link). */
export function resolveSignUpDestination(redirectUrl: unknown): string {
  return onboardingPath(redirectUrl);
}

/** An auth page link that keeps the visitor's destination, so switching
 *  between sign-in and sign-up never drops it. */
export function authPageHref(base: '/sign-in' | '/sign-up', redirectUrl: unknown): string {
  const safe = safeRedirectPath(redirectUrl);
  return safe ? `${base}?${new URLSearchParams({ redirect_url: safe }).toString()}` : base;
}
