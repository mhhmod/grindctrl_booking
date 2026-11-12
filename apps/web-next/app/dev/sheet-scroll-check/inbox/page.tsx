import { notFound } from 'next/navigation';
import { InboxScrollCheck } from './inbox-scroll-check';

/* The merchant Inbox's conversation view inside the dashboard shell's phone
   chrome, with a 30-message thread, so its spacing under the sticky top bar
   and the newest message above the composer can be checked without auth.
   Hidden outright in production. */
export default async function Page({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await searchParams;
  return <InboxScrollCheck locale={locale === 'ar' ? 'ar' : 'en'} />;
}
