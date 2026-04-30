import { redirect } from 'next/navigation';
import type { SearchParams } from '@/lib/types';

type Props = { searchParams?: Promise<SearchParams> };

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export default async function DashboardDomainsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const next = new URLSearchParams();
  if (typeof params.site === 'string' && params.site) next.set('site', params.site);
  if (typeof params.q === 'string' && params.q) next.set('q', params.q);
  if (typeof params.status === 'string' && params.status) next.set('status', params.status);
  if (typeof params.sort === 'string' && params.sort) next.set('sort', params.sort);
  if (typeof params.page === 'string' && params.page) next.set('page', params.page);
  if (typeof params.pageSize === 'string' && params.pageSize) next.set('pageSize', params.pageSize);
  next.set('tab', 'domains');
  redirect(`/dashboard/sites?${next.toString()}`);
}
