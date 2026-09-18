import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

/* Same flag app/layout.tsx already uses to skip ClerkProvider when Clerk
   isn't configured. Without this guard, clerkMiddleware() throws
   throwMissingSecretKeyError before this file's own callback ever runs —
   which 500s every route this matcher covers, marketing pages included,
   not just the dashboard/onboarding routes that actually need auth.
   Verified: the release-check Docker candidate (built without production
   credentials, by design — see next-release-check.yml) 500s on "/" without
   this guard, which is exactly what let e2e/golden-standard-*.spec.ts
   catch it — nothing had ever requested a page route from that specific
   candidate before those specs existed. */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function withPathname(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isDashboardRoute(req)) {
        const { userId } = await auth();
        if (!userId) {
          const signInUrl = new URL('/sign-in', req.url);
          signInUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
          return NextResponse.redirect(signInUrl);
        }
      }

      return withPathname(req);
    })
  : function proxy(req: NextRequest) {
      // Dashboard/onboarding can't authenticate anyone without Clerk
      // either way; requireDashboardUser (app/dashboard/layout.tsx) is
      // what surfaces that clearly, the same way sign-in/sign-up already
      // show a "Clerk environment variables are missing" alert rather than
      // silently pretending to work. This branch's job is narrower: keep
      // public marketing pages, which need none of that, from 500ing.
      return withPathname(req);
    };

export const config = {
  /* Embed, the embedded Shopify admin app, and storefront-facing APIs are
     cookie-less third-party contexts: Clerk's handshake can redirect them
     (blank iframes, or Shopify's admin refusing the resulting navigation).
     Keep them out. `shopify` covers the app page tree
     (app/shopify/app/[[...rest]]); `api/shopify` covers its route handlers
     — two different prefixes, both needed. The exact, secret-free health
     endpoint must remain available even when Clerk is unconfigured/down. */
  matcher: ['/((?!_next|embed|shopify|api/try-on|api/shopify|api/health$|.*\\..*).*)', '/'],
};
