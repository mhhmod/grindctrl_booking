import type { Metadata } from 'next';
import { loadPublicSite, originAllowed, toPublicPayload } from '@/lib/messenger/public-api';
import { MessengerPanel } from '@/components/messenger/MessengerPanel';

/* The GRINDCTRL Support Messenger, embedded via iframe from merchant stores.
   Loaded lazily by /widget/v1/messenger.js only when the shopper opens the
   launcher (or a configured greeting/proactive rule warrants it).

   Query params:
     key     embed key (public identifier)
     locale  en | ar | auto (default)
     origin  merchant page origin — re-verified server-side against the
             site's verified domain patterns before anything loads */

export const metadata: Metadata = {
  title: 'Support',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function EmbedMessengerPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; locale?: string; origin?: string }>;
}) {
  const params = await searchParams;
  const key = typeof params.key === 'string' ? params.key : '';

  let payload = null;
  if (/^[a-z0-9_]{6,80}$/i.test(key)) {
    try {
      const site = await loadPublicSite(key);
      if (site && site.status === 'active' && originAllowed(site, params.origin ?? null)) {
        payload = toPublicPayload(site, new Date());
      }
    } catch (error) {
      console.error('[messenger] embed load failed:', error instanceof Error ? error.message : error);
    }
  }

  if (!payload) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-1 bg-background p-6 text-center text-foreground">
        <p className="text-sm font-semibold">Support is unavailable</p>
        <p className="text-xs text-muted-foreground">Please check back a little later.</p>
      </main>
    );
  }

  return (
    <MessengerPanel config={payload} />
  );
}
