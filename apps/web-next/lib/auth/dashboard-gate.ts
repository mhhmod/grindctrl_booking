/* What proxy.ts does with a signed-out request to a protected route, and
   with a signed-in request to an auth page, kept free of Clerk so it can be
   tested directly. */

import { resolveSignInDestination } from './redirect';

type GateRequest = { method: string; headers: Headers; url: string; nextUrl: { pathname: string; search: string } };

/* A server action is a POST carrying Next's action header. Redirecting it
   to sign-in does not work: the browser's fetch follows the redirect and
   replays the POST against the sign-in page, so the dashboard got an
   unexpected response, a generic error, and lost what the merchant typed.
   Letting it through is safe because every action checks the session
   itself (an action ID can be posted to any route, so the proxy was never
   its guard) and now answers "signed out" in a form the page can act on. */
export function isServerActionRequest(req: Pick<GateRequest, 'method' | 'headers'>): boolean {
  return req.method === 'POST' && req.headers.has('next-action');
}

/** The sign-in page, returning to the exact page (path and query) afterwards. */
export function signInRedirectUrl(req: Pick<GateRequest, 'url' | 'nextUrl'>): URL {
  const signInUrl = new URL('/sign-in', req.url);
  signInUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return signInUrl;
}

/** Signed out on a protected route: redirect pages, let actions answer for themselves. */
export function shouldRedirectSignedOut(req: Pick<GateRequest, 'method' | 'headers'>): boolean {
  return !isServerActionRequest(req);
}

/* The entry pages only. Clerk's own steps live under them
   (/sign-in/factor-one, /sign-in/sso-callback, /sign-up/verify-email-address,
   /sign-up/continue) and must finish even once a session exists, so they are
   left to Clerk. */
const AUTH_ENTRY_PATHS = new Set(['/sign-in', '/sign-up', '/login']);

/** Signed in and opening sign-in, sign-up or the /login alias: where to go
 *  instead, decided before any of the auth page is drawn. The page's
 *  redirect_url when it is a safe same-site path (never an auth page, so this
 *  cannot loop), else the dashboard. Null for anything else. */
export function signedInAuthPageRedirect(req: Pick<GateRequest, 'method' | 'url' | 'nextUrl'>): URL | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '').toLowerCase();
  if (!AUTH_ENTRY_PATHS.has(pathname)) return null;
  const redirectUrl = new URLSearchParams(req.nextUrl.search).get('redirect_url');
  return new URL(resolveSignInDestination(redirectUrl), req.url);
}
