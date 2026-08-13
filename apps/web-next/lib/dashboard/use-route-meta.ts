'use client';

import { usePathname } from 'next/navigation';
import { getDashboardRouteMeta, type DashboardRouteMeta } from '@/lib/dashboard/route-meta';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Reads the live client-side pathname rather than trusting a value computed
   once by app/dashboard/layout.tsx from headers().get('x-pathname'). Next.js
   reuses that layout's server render across navigation between routes that
   share it — Overview and Try-On both sit under the same layout segment — so
   anything resolved there from the request headers goes stale the moment a
   visitor clicks a second nav item: the header title and the breadcrumb both
   stayed on whatever loaded first, no matter how many times the page content
   itself correctly changed underneath. usePathname() subscribes to the
   router's own live state, which Next.js updates on every navigation
   regardless of whether the surrounding layout re-executes. */
export function useDashboardRouteMeta(locale: SiteLocale): DashboardRouteMeta {
  const pathname = usePathname();
  return getDashboardRouteMeta(pathname ?? '/dashboard/overview', locale);
}
