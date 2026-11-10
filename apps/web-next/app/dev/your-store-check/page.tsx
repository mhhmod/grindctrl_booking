import { notFound } from 'next/navigation';
import { YourStoreCheck } from './your-store-check';

/* Dev-only mirror of the Your store page with fixture facts and mock
   actions, so each state can be checked in a browser without the Clerk
   wall, like app/dev/store-domains-check. Hidden outright in production.
   /dev/your-store-check?state=running&locale=ar&role=member */

export default async function YourStoreCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; locale?: string; role?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state, locale, role } = await searchParams;
  return <YourStoreCheck state={state ?? 'running'} locale={locale === 'ar' ? 'ar' : 'en'} member={role === 'member'} />;
}
