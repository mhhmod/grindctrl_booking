import { TryOnPage } from '../try-on-page';

export const dynamic = 'force-dynamic';

export default async function DashboardTryOnSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  return TryOnPage({ params: await searchParams, tab: 'setup' });
}
