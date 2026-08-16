import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { AssistantLocaleProvider } from '@/components/assistant/locale-provider';
import { ChatWindow } from '@/components/assistant/chat-window';
import { localeFromAcceptLanguage } from '@/lib/landing/accept-language';
import { DEFAULT_SITE_LOCALE, isSiteLocale, SITE_LOCALE_COOKIE, type SiteLocale } from '@/lib/landing/landing-i18n';

export const metadata: Metadata = {
  title: 'AI Assistant — GRINDCTRL',
  description: 'Talk to the GrindCTRL AI assistant by text or voice — ask questions, get help, in English or Arabic.',
};

export default async function AssistantPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(SITE_LOCALE_COOKIE)?.value;
  const acceptLanguage = (await headers()).get('accept-language');
  const browserLocale: SiteLocale = localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_SITE_LOCALE;
  const initialLocale: SiteLocale = isSiteLocale(cookieLocale) ? cookieLocale : browserLocale;

  return (
    <AssistantLocaleProvider initialLocale={initialLocale}>
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6 sm:py-10">
        <div className="min-h-0 flex-1" style={{ height: 'calc(100dvh - 3rem)' }}>
          <ChatWindow redirectPath="/assistant" className="h-full" />
        </div>
      </main>
    </AssistantLocaleProvider>
  );
}
