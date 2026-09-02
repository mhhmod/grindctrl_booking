import { NextResponse } from 'next/server';

/* Deploy verification, not monitoring. SENTRY_RELEASE is baked into the image
   at build time as the commit SHA (see apps/web-next/Dockerfile), so the
   running container is the only thing that can honestly report which code is
   actually serving. The deploy workflow asserts this equals the SHA it just
   pushed — without that, a container that silently failed to restart still
   answers 200 on every smoke-checked route and the deploy looks green while
   production runs the previous build.

   Deliberately public and secret-free: it exposes a commit SHA that is already
   public in the repository, and nothing else. No database, no auth, no config
   values — it must stay cheap enough to poll and impossible to misuse. */

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      release: process.env.SENTRY_RELEASE ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
