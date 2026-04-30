import { redirect } from 'next/navigation';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardInstallPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const next = new URLSearchParams();
  if (typeof params.site === 'string' && params.site) next.set('site', params.site);
  if (typeof params.window === 'string' && params.window) next.set('window', params.window);
  next.set('tab', 'install');
  redirect(`/dashboard/sites?${next.toString()}`);
}
