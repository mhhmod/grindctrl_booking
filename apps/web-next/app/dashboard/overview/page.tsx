import { getRequestLocale } from '@/lib/auth/locale';
import { getTryOnOverview } from '@/lib/dashboard/overview-data';
import { TryOnOverviewView } from '@/components/dashboard/tryon-overview-view';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const [locale, overview] = await Promise.all([getRequestLocale(), getTryOnOverview()]);

  return <TryOnOverviewView overview={overview} locale={locale} />;
}
