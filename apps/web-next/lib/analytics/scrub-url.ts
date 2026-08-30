/* The claim flow (app/api/shopify/claim/start/route.ts mints, app/claim/page.tsx
   redeems) carries its 5-minute bearer token as a `token` query param, and
   round-trips it a second time through `/sign-in?redirect_url=%2Fclaim%3Ftoken%3D...`
   when the merchant isn't signed in yet. Both params must never reach an
   analytics or error-tracking vendor as a first-party payload — used by
   instrumentation-client.ts (PostHog's before_send, Sentry's beforeSend /
   beforeSendTransaction) and sentry.server.config.ts.

   Isomorphic (no 'server-only'): instrumentation-client.ts runs in the
   browser. */

const SCRUBBED_PARAMS = ['token', 'redirect_url'];

// Only used to parse a relative string (e.g. a bare pathname) through the
// same URL API as an absolute one; never appears in the returned value.
const RELATIVE_BASE = 'http://scrub.invalid';

export function scrubUrl(input: string): string {
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);

  let url: URL;
  try {
    url = new URL(input, isAbsolute ? undefined : RELATIVE_BASE);
  } catch {
    return input;
  }

  let changed = false;
  for (const param of SCRUBBED_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  if (!changed) return input;

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}
