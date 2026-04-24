'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WidgetSite } from '@/lib/types';
import { Label } from '@/components/ui/label';

const selectClassName = 'h-9 w-full max-w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-w-56';

export function SiteSelector({ sites, selectedSiteId }: { sites: WidgetSite[]; selectedSiteId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (sites.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:items-end">
      <Label htmlFor="site-selector">Widget site</Label>
      <select
        id="site-selector"
        aria-label="Widget site"
        dir="auto"
        className={selectClassName}
        value={selectedSiteId ?? sites[0]?.id ?? ''}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set('site', event.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
