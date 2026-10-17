/* What the v16 dashboard shell shows, worked out from data the app already
   has, so the rules can be tested without rendering. Every value has a
   source or is left out: the looks meter has no run-out date until the
   projection exists (phase zero items 4 and 21), and there is no bell or
   search until their panels do. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import {
  type ActiveStore,
  type StoreCandidateShop,
  type StoreChoice,
} from './active-store';
import type { ShellCopy, ShellRole } from './shell-copy';

export type ShellStore = {
  key: string;
  label: string;
  domain: string | null;
  initials: string;
  choice: StoreChoice;
  current: boolean;
};

export type ShellSite = { id: string; name: string; domain: string | null };

const MYSHOPIFY = '.myshopify.com';

export function storeInitials(label: string): string {
  const words = label
    .replace(/\.myshopify\.com$/i, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/** The stores the person can see: every shop they own, named after its
 *  Store Chat site when it has one, then their Store Chat sites on other
 *  websites. The active store is marked current. */
export function buildShellStores(
  shops: readonly StoreCandidateShop[],
  sites: readonly ShellSite[],
  active: ActiveStore,
): ShellStore[] {
  const siteOnShop = (domain: string) => sites.find((site) => site.domain?.trim().toLowerCase() === domain);
  const fromShops = shops.map((shop): ShellStore => {
    const label = siteOnShop(shop.domain)?.name.trim() || shop.domain.replace(MYSHOPIFY, '');
    return {
      key: `shop:${shop.domain}`,
      label,
      domain: shop.domain,
      initials: storeInitials(label),
      choice: { shop: shop.domain },
      current: active.shopDomain === shop.domain,
    };
  });
  const shopDomains = new Set(shops.map((shop) => shop.domain));
  const fromSites = sites
    .filter((site) => !shopDomains.has(site.domain?.trim().toLowerCase() ?? ''))
    .map((site): ShellStore => {
      const label = site.name.trim() || site.domain || site.id.slice(0, 8);
      return {
        key: `site:${site.id}`,
        label,
        domain: site.domain,
        initials: storeInitials(label),
        choice: { site: site.id },
        current: !active.shopDomain && active.siteId === site.id,
      };
    });
  return [...fromShops, ...fromSites];
}

/** The address that switches to a store on the page the person is on. The
 *  proxy remembers the choice (lib/dashboard/forward-request.ts). */
export function storeSwitchHref(pathname: string, choice: StoreChoice): string {
  const query = 'shop' in choice ? `shop=${encodeURIComponent(choice.shop)}` : `site=${encodeURIComponent(choice.site)}`;
  return `${pathname}?${query}`;
}

export type LooksMeter = { title: string; value: string; percent: number; low: boolean };

export type MeterEntitlement = {
  available: boolean;
  isFree: boolean;
  rendersIncluded: number;
  totalCreditsRemaining: number;
  bannerState: string;
};

/** The sidebar's looks meter, from the store's live entitlement. A store
 *  without a plan, or whose plan cannot be read, shows no meter. */
export function looksMeterView(entitlement: MeterEntitlement | null, copy: ShellCopy): LooksMeter | null {
  if (!entitlement || !entitlement.available || entitlement.rendersIncluded <= 0) return null;
  const left = Math.max(0, entitlement.totalCreditsRemaining);
  const total = entitlement.rendersIncluded;
  return {
    title: entitlement.isFree ? copy.freeLooks : copy.looksThisCycle,
    value: entitlement.isFree ? copy.freeLooksLeft(left, total) : copy.looksLeft(left, total),
    percent: Math.min(100, Math.round((left / total) * 100)),
    low: ['low', 'critical', 'exhausted'].includes(entitlement.bannerState),
  };
}

export function shellRole(role: unknown): ShellRole | null {
  return role === 'owner' || role === 'admin' || role === 'member' ? role : null;
}

function zoneOrUtc(timeZone: string | null | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** Today's header: the date and a greeting, in the store's time zone, with
 *  Western digits in both languages ("Friday, 2 October", "الجمعة، 2 أكتوبر"). */
export function todayHeading(
  now: Date,
  timeZone: string | null | undefined,
  locale: SiteLocale,
  firstName: string | null,
  copy: ShellCopy,
): { date: string; greeting: string } {
  const zone = zoneOrUtc(timeZone);
  const parts = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const date = `${part('weekday')}${locale === 'ar' ? '،' : ','} ${part('day')} ${part('month')}`;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  const name = firstName?.trim() || null;
  const greeting =
    hour >= 5 && hour < 12
      ? copy.greeting.morning(name)
      : hour >= 12 && hour < 17
        ? copy.greeting.afternoon(name)
        : copy.greeting.evening(name);
  return { date, greeting };
}
