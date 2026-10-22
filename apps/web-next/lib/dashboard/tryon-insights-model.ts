/* What the v16 Try-On Results tab shows (04-dashboard.md, TryOnInsights),
   from the store's own looks. Everything else on the board waits for its
   back end and is left out rather than guessed: added to cart, orders and
   returns (N3, N4), the funnel's steps before the photo and after the look
   (item 22), Is it working? (N22), where looks start, the product-photo and
   whole-body reasons (item 17), and "said not right" (N39). */

import { classifyTryOnFailure, type TryOnFailureKind } from '@/lib/try-on/shopper-errors';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { ResultsPeriod, TryOnResultsCopy } from './tryon-insights-copy';
import type { TodayCopy } from './today-copy';
import { relativeAgo } from './today-model';

const DAY = 86_400_000;
export const PERIODS: readonly ResultsPeriod[] = [7, 30, 90];
export const TOP_PRODUCTS = 6;
export const RECENT_LOOKS = 6;
const REASON_ORDER: readonly TryOnFailureKind[] = ['photo_rejected', 'busy', 'service_unavailable', 'unknown'];

export type ResultsJob = {
  product_id: string;
  status: string;
  duration_ms: number | null;
  message: string | null;
  created_at: string;
};

export type ProductInfo = { title: string; imageUrl: string | null };

export type TryOnResultsFacts = {
  now: number;
  period: ResultsPeriod;
  /** Try it on shows on the store now (the plan has looks and is active). */
  live: boolean | null;
  /** The last two periods of the store's looks, test looks left out. */
  jobs: ResultsJob[];
  products: Record<string, ProductInfo>;
};

export type ResultsTile = { key: string; label: string; value: string; sub: string; trend?: 'up' | 'down' };
export type ReasonRow = { kind: TryOnFailureKind; title: string; line: string; count: number; share: number };
export type ProductRow = { handle: string; title: string; imageUrl: string | null; looks: number };
export type RecentRow = { key: string; title: string; imageUrl: string | null; ago: string; outcome: 'made' | 'failed' | 'making'; label: string; notCounted: boolean };

export type TryOnResultsView = {
  status: { live: boolean; label: string } | null;
  periods: Array<{ days: ResultsPeriod; label: string; current: boolean; href: string }>;
  tiles: ResultsTile[];
  why: { summary: string; rows: ReasonRow[] } | null;
  byProduct: { rows: ProductRow[]; other: string | null } | null;
  recent: RecentRow[];
};

export function parsePeriod(value: unknown): ResultsPeriod {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as ResultsPeriod) : 30;
}

/** "muscat-everyday-crepe-abaya" reads as "Muscat everyday crepe abaya"
 *  when the store's own title cannot be read. */
export function titleFromHandle(handle: string): string {
  const words = handle.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : handle;
}

function change(current: number, previous: number, copy: TryOnResultsCopy, days: ResultsPeriod) {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { sub: copy.sameAsDaysBefore(days) };
  return pct > 0
    ? { sub: copy.onDaysBefore(pct, days), trend: 'up' as const }
    : { sub: copy.fewerOnDaysBefore(-pct, days), trend: 'down' as const };
}

export function buildTryOnResultsView(
  facts: TryOnResultsFacts,
  copy: TryOnResultsCopy,
  todayCopy: TodayCopy,
  _locale: SiteLocale,
): TryOnResultsView {
  const start = facts.now - facts.period * DAY;
  const before = start - facts.period * DAY;
  const inPeriod = facts.jobs.filter((job) => Date.parse(job.created_at) > start);
  const previous = facts.jobs.filter((job) => {
    const at = Date.parse(job.created_at);
    return at > before && at <= start;
  });
  const made = inPeriod.filter((job) => job.status === 'completed');
  const failed = inPeriod.filter((job) => job.status === 'failed');
  const photos = made.length + failed.length;
  const info = (handle: string): ProductInfo => facts.products[handle] ?? { title: titleFromHandle(handle), imageUrl: null };

  const tiles: ResultsTile[] = [];
  const delta = change(made.length, previous.filter((job) => job.status === 'completed').length, copy, facts.period);
  tiles.push({ key: 'looks', label: copy.looksMade, value: String(made.length), sub: delta?.sub ?? '', trend: delta?.trend });
  tiles.push(
    photos > 0
      ? {
          key: 'made_share',
          label: copy.photosMadeLook,
          value: `${Math.round((made.length / photos) * 100)}%`,
          sub: copy.photosOf(made.length, photos),
        }
      : { key: 'made_share', label: copy.photosMadeLook, value: '–', sub: copy.noPhotosYet },
  );

  let why: TryOnResultsView['why'] = null;
  if (failed.length > 0) {
    const counts = new Map<TryOnFailureKind, number>();
    for (const job of failed) {
      const kind = classifyTryOnFailure(job.message ?? '');
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const most = Math.max(...counts.values());
    why = {
      summary: copy.whySummary(failed.length, photos, Math.max(1, Math.round((failed.length / photos) * 100))),
      rows: REASON_ORDER.filter((kind) => counts.has(kind))
        .map((kind) => ({ kind, ...copy.reasons[kind], count: counts.get(kind)!, share: counts.get(kind)! / most }))
        .sort((a, b) => b.count - a.count),
    };
  }

  let byProduct: TryOnResultsView['byProduct'] = null;
  if (made.length > 0) {
    const perProduct = new Map<string, number>();
    for (const job of made) perProduct.set(job.product_id, (perProduct.get(job.product_id) ?? 0) + 1);
    const ranked = [...perProduct].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked.slice(0, TOP_PRODUCTS);
    const rest = ranked.slice(TOP_PRODUCTS);
    byProduct = {
      rows: top.map(([handle, looks]) => ({ handle, ...info(handle), looks })),
      other: rest.length ? copy.otherProducts(rest.length, rest.reduce((sum, [, looks]) => sum + looks, 0)) : null,
    };
  }

  const recent = [...facts.jobs]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, RECENT_LOOKS)
    .map((job, index): RecentRow => {
      const product = info(job.product_id);
      const base = { key: `${job.created_at}-${index}`, title: product.title, imageUrl: product.imageUrl, ago: relativeAgo(job.created_at, facts.now, todayCopy) };
      if (job.status === 'completed') {
        const seconds = job.duration_ms ? Math.max(1, Math.round(job.duration_ms / 1000)) : null;
        return { ...base, outcome: 'made', label: seconds ? copy.madeIn(seconds) : copy.looksMade, notCounted: false };
      }
      if (job.status === 'failed') {
        return { ...base, outcome: 'failed', label: copy.didntWork[classifyTryOnFailure(job.message ?? '')], notCounted: true };
      }
      return { ...base, outcome: 'making', label: copy.making, notCounted: false };
    });

  return {
    status: facts.live === null ? null : { live: facts.live, label: facts.live ? copy.liveOnStore : copy.hiddenOnStore },
    periods: PERIODS.map((days) => ({
      days,
      label: copy.period(days),
      current: days === facts.period,
      href: days === 30 ? '/dashboard/try-on' : `/dashboard/try-on?period=${days}`,
    })),
    tiles,
    why,
    byProduct,
    recent,
  };
}
