import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { INTEGRATION_CATALOG, INTEGRATION_CATEGORIES, type IntegrationCategory, type IntegrationItem } from '@/lib/dashboard/integration-catalog';
import type { SearchParams } from '@/lib/types';

type Props = {
  searchParams?: Promise<SearchParams>;
};

async function resolveSearchParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

const STATUS_VARIANT: Record<IntegrationItem['status'], 'default' | 'secondary' | 'outline'> = {
  'Available by implementation': 'default',
  Planned: 'outline',
  'Needs credentials': 'secondary',
};

function resolveCategory(value: string | string[] | undefined): IntegrationCategory | 'All' {
  if (typeof value !== 'string') return 'All';
  if (INTEGRATION_CATEGORIES.includes(value as IntegrationCategory)) {
    return value as IntegrationCategory;
  }
  return 'All';
}

export default async function DashboardIntegrationsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const selectedCategory = resolveCategory(params.category);
  const items = selectedCategory === 'All'
    ? INTEGRATION_CATALOG
    : INTEGRATION_CATALOG.filter((item) => item.category === selectedCategory);

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Integrations and Channels Center</CardTitle>
          <CardDescription>Preview provider catalog. Request connection starts implementation flow.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter by category</CardTitle>
        </CardHeader>
        <CardContent className="-mx-2 overflow-x-auto px-2 pb-1">
          <div className="flex w-max min-w-full items-center gap-2">
            {(['All', ...INTEGRATION_CATEGORIES] as const).map((category) => {
              const isActive = category === selectedCategory;
              const href = category === 'All'
                ? '/dashboard/integrations'
                : `/dashboard/integrations?category=${encodeURIComponent(category)}`;

              return (
                <Button key={category} asChild size="sm" variant={isActive ? 'default' : 'outline'}>
                  <Link href={href}>{category}</Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Preview catalog</Badge>
          <CardTitle className="text-base">{selectedCategory === 'All' ? 'All categories' : selectedCategory}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{item.provider}</h3>
                <Badge variant="outline">{item.category}</Badge>
                <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.enables}</p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link href="/dashboard/implementation">Request connection</Link>
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
