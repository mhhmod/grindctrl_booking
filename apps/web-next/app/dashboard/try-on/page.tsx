import { TryOnPage } from './try-on-page';

export const dynamic = 'force-dynamic';

export default async function DashboardTryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; period?: string }>;
}) {
  return TryOnPage({ params: await searchParams, tab: 'results' });
}
