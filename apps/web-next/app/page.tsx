import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LandingStory } from '@/components/landing/story/landing-story';
import { getRequestLocale } from '@/lib/auth/locale';

export const metadata: Metadata = {
  title: 'GRINDCTRL | AI try-on and store chat for Shopify fashion stores',
  description:
    'Shoppers see your clothes on themselves from one photo and get answers from your store in Arabic or English. AI try-on and Store Chat for Shopify fashion stores.',
};

/** The story has a desktop and a phone layout. The server picks the likely
 *  one from the request so the first paint is right on most devices; the
 *  client corrects it after hydration when the viewport says otherwise. */
function guessLayout(headerList: Headers): 'desk' | 'phone' {
  if (headerList.get('sec-ch-ua-mobile') === '?1') return 'phone';
  const ua = headerList.get('user-agent') ?? '';
  return /Mobi|Android|iPhone|iPod|iPad/i.test(ua) ? 'phone' : 'desk';
}

export default async function LandingPage() {
  /* Resolved centrally so this page adapts to the browser's language on a
     first visit, rather than defaulting every new visitor to English.

     No catalog fetch: the landing page quotes no prices, so it has no
     reason to hit the plan tables on every request. */
  const [initialLocale, headerList] = await Promise.all([getRequestLocale(), headers()]);

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <LandingStory initialLayout={guessLayout(headerList)} />
    </LandingLocaleProvider>
  );
}
