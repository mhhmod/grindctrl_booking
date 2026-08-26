import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* Browsers, crawlers, and old bookmarks request /favicon.ico directly even
   though the site declares an SVG icon via metadata. Redirect them to the
   real asset instead of answering 404.

   The target origin comes from proxy headers first because request.url's
   authority inside the container is HOSTNAME=0.0.0.0:3000 — redirecting to
   that would leak an internal address to visitors. */
export function GET(request: NextRequest) {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    '';
  const usableHost = host && !host.startsWith('0.0.0.0') ? host : null;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin =
    usableHost !== null
      ? `${proto}://${usableHost}`
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://grindctrl.cloud';

  return NextResponse.redirect(new URL('/icon.svg', origin), 308);
}
