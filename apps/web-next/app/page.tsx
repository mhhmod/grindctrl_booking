import type { Metadata } from 'next';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LandingStory } from '@/components/landing/story/landing-story';
import { getRequestLocale } from '@/lib/auth/locale';
import { socialMetadata } from '@/lib/site-metadata';

const title = 'GRINDCTRL | AI try-on and Store Chat for fashion stores';
const description =
  'Shoppers see your clothes on themselves from one photo and get answers from your store in Arabic or English. AI try-on and Store Chat, live on Shopify and WooCommerce.';

export const metadata: Metadata = {
  title,
  description,
  ...socialMetadata({ title, description, path: '/' }),
};

export default async function LandingPage() {
  /* Resolved centrally so this page adapts to the browser's language on a
     first visit, rather than defaulting every new visitor to English.

     No catalog fetch: the landing page quotes no prices, so it has no
     reason to hit the plan tables on every request. */
  const initialLocale = await getRequestLocale();

  return (
    <LandingLocaleProvider
      initialLocale={initialLocale}
      className="gc-landing-root gc-animated min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <LandingStory />
    </LandingLocaleProvider>
  );
}
