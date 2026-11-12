import { notFound } from 'next/navigation';
import { resolveMessengerConfig } from '@/lib/messenger/config';
import { SetupCheck } from './client';
import { DEV_ICON } from './dev-icon';

/* Dev-only mirror of Store Chat > Set up with mock actions, so the sections
   that replaced "More settings" (opening hours, bubble, saved replies, icon
   upload) can be checked in a browser without the Clerk wall, like
   app/dev/store-chat-check. ?lang=ar for Arabic, ?hours=1 opens on business
   hours, ?icon=1 starts with an uploaded icon. Hidden outright in production. */

export const dynamic = 'force-dynamic';

export default async function StoreChatSetupCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; hours?: string; icon?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { lang, hours, icon } = await searchParams;
  const config = resolveMessengerConfig({
    messenger_appearance: { launcherCustomIconUrl: icon === '1' ? DEV_ICON : null },
    messenger_behaviour: {
      proactiveEnabled: true,
      ...(hours === '1'
        ? {
            availabilityMode: 'hours',
            availabilityTimezone: 'Africa/Cairo',
            availabilityHours: [0, 1, 2, 3, 4, 6].map((day) => ({ day, startMinute: 600, endMinute: 1320 })),
          }
        : {}),
    },
  });
  return <SetupCheck locale={lang === 'ar' ? 'ar' : 'en'} config={config} />;
}
