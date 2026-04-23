'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WidgetSite } from '@/lib/types';

export function SiteSelector({ sites, selectedSiteId }: { sites: WidgetSite[]; selectedSiteId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (sites.length === 0) {
    return null;
  }

  return (
    <label className="flex flex-col gap-2 text-sm text-zinc-400 sm:items-end">
      <span>Widget site</span>
      <select
        aria-label="Widget site"
        className="min-w-56 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
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
    </label>
  );
}
