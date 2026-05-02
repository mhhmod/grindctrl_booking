import { redirect } from 'next/navigation';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardBrandingPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const next = new URLSearchParams();
  if (typeof params.site === 'string' && params.site) next.set('site', params.site);
  redirect(`/dashboard/install${next.toString() ? `?${next.toString()}` : ''}`);
}
