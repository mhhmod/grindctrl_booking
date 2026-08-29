import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { countAwaitingHandoff } from '@/lib/messenger/conversations';
import { listMessengerSiteIdsReadOnly } from '@/lib/messenger/provisioning';

/* GET /api/dashboard/store-chat-waiting
   Client-side refresh for the sidebar badge. app/dashboard/layout.tsx only
   computes this once per full page load — Next.js reuses that layout's
   server render across client-side navigation between routes that share it
   (see lib/dashboard/use-route-meta.ts) — so a merchant who clears the queue
   or gets a new handoff mid-session would otherwise see a stale number for
   the rest of the visit. Same helpers, same fail-quiet contract: a badge
   must never take the dashboard down. */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ count: 0 });

    const siteIds = await listMessengerSiteIdsReadOnly(userId);
    const count = await countAwaitingHandoff(siteIds);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
