import { getRequestLocale } from '@/lib/auth/locale';
import { getTryOnOverview } from '@/lib/dashboard/overview-data';
import { getActiveStore, getActiveStoreTimeZone } from '@/lib/dashboard/active-store-server';
import { TryOnOverviewView } from '@/components/dashboard/tryon-overview-view';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  // Days follow the active store's calendar, not UTC's (item 32).
  const timeZone = await getActiveStoreTimeZone(await getActiveStore());
  const [locale, overview] = await Promise.all([getRequestLocale(), getTryOnOverview({ timeZone })]);

  return <TryOnOverviewView overview={overview} locale={locale} />;
}
