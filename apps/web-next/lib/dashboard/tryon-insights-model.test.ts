import { describe, expect, it } from 'vitest';
import { getTryOnResultsCopy } from './tryon-insights-copy';
import { getTodayCopy } from './today-copy';
import { buildTryOnResultsView, parsePeriod, titleFromHandle, type ResultsJob, type TryOnResultsFacts } from './tryon-insights-model';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const DAY = 86_400_000;
const en = getTryOnResultsCopy('en');
const ar = getTryOnResultsCopy('ar');

function job(daysAgo: number, over: Partial<ResultsJob> = {}): ResultsJob {
  return {
    product_id: 'layla-abaya',
    status: 'completed',
    duration_ms: 14_200,
    message: null,
    created_at: new Date(NOW - daysAgo * DAY).toISOString(),
    ...over,
  };
}

function facts(jobs: ResultsJob[], over: Partial<TryOnResultsFacts> = {}): TryOnResultsFacts {
  return {
    now: NOW,
    period: 30,
    live: true,
    jobs,
    products: { 'layla-abaya': { title: 'Layla Embroidered Abaya', imageUrl: 'https://cdn.shopify.com/layla.jpg' } },
    ...over,
  };
}

const view = (f: TryOnResultsFacts, locale: 'en' | 'ar' = 'en') =>
  buildTryOnResultsView(f, locale === 'ar' ? ar : en, getTodayCopy(locale), locale);

describe('Try-On Results tiles', () => {
  it('counts looks made in the period against the one before', () => {
    const jobs = [...Array.from({ length: 6 }, (_, i) => job(i + 1)), ...Array.from({ length: 5 }, (_, i) => job(35 + i))];
    const [looks, share] = view(facts(jobs)).tiles;
    expect(looks).toEqual({ key: 'looks', label: 'Looks made', value: '6', sub: '20% on the 30 days before', trend: 'up' });
    expect(share).toMatchObject({ value: '100%', sub: '6 of 6 photos' });
  });

  it('leaves the comparison out without a period before, and says when there are no photos', () => {
    expect(view(facts([job(1)])).tiles[0].sub).toBe('');
    expect(view(facts([])).tiles[1]).toMatchObject({ value: '–', sub: 'No photos yet in this period' });
  });

  it('reads only the chosen period', () => {
    const jobs = [job(3), job(10), job(20)];
    expect(view(facts(jobs, { period: 7 })).tiles[0].value).toBe('1');
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod('365')).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });
});

describe('Why some photos did not make a look', () => {
  it('sorts failures into what shoppers were told, most first', () => {
    const jobs = [
      job(1),
      job(1),
      job(2, { status: 'failed', message: 'The image is too blurry to use' }),
      job(2, { status: 'failed', message: 'No person detected in the photo' }),
      job(3, { status: 'failed', message: '429 Too Many Requests' }),
      job(3, { status: 'failed', message: 'socket hang up' }),
    ];
    const why = view(facts(jobs)).why!;
    expect(why.summary).toBe('4 of 6 photos, about 67%. Failed looks never use a look from your plan.');
    expect(why.rows.map((row) => [row.kind, row.count])).toEqual([
      ['unknown', 2],
      ['photo_rejected', 1],
      ['busy', 1],
    ]);
    expect(why.rows[0].share).toBe(1);
  });

  it('is left out when every photo made a look', () => {
    expect(view(facts([job(1)])).why).toBeNull();
  });
});

describe('By product and recent looks', () => {
  it('names products from the store, with the handle as words when the title is not known', () => {
    const jobs = [job(1), job(1), job(2, { product_id: 'linen-overshirt' })];
    const rows = view(facts(jobs)).byProduct!.rows;
    expect(rows).toEqual([
      { handle: 'layla-abaya', title: 'Layla Embroidered Abaya', imageUrl: 'https://cdn.shopify.com/layla.jpg', looks: 2 },
      { handle: 'linen-overshirt', title: 'Linen overshirt', imageUrl: null, looks: 1 },
    ]);
    expect(titleFromHandle('muscat-everyday-crepe-abaya')).toBe('Muscat everyday crepe abaya');
  });

  it('counts the products past the top six in one line', () => {
    const jobs = Array.from({ length: 8 }, (_, i) => job(1, { product_id: `piece-${i}` }));
    expect(view(facts(jobs)).byProduct!.other).toBe('The other 2 products made 2 looks.');
    expect(view(facts([])).byProduct).toBeNull();
  });

  it('lists the latest looks with how long they took, or why they did not work and that they were not counted', () => {
    const recent = view(
      facts([
        job(0.001),
        job(0.01, { status: 'failed', message: 'No person detected' }),
        job(0.02, { status: 'processing', duration_ms: null }),
      ]),
    ).recent;
    expect(recent.map((row) => [row.outcome, row.label, row.notCounted])).toEqual([
      ['made', 'Made in 14 s', false],
      ['failed', expect.stringMatching(/^Didn't work/), true],
      ['making', 'Being made', false],
    ]);
    expect(recent[0]).toMatchObject({ title: 'Layla Embroidered Abaya', ago: '1 min ago' });
  });
});

describe('the period choice and the badge', () => {
  it('links each period, with 30 days as the plain page', () => {
    expect(view(facts([])).periods.map((p) => [p.label, p.href, p.current])).toEqual([
      ['Last 7 days', '/dashboard/try-on?period=7', false],
      ['Last 30 days', '/dashboard/try-on', true],
      ['Last 90 days', '/dashboard/try-on?period=90', false],
    ]);
    expect(view(facts([]), 'ar').periods.map((p) => p.label)).toEqual(['آخر 7 أيام', 'آخر 30 يوماً', 'آخر 90 يوماً']);
  });

  it('says whether try-on shows on the store, and nothing when that could not be read', () => {
    expect(view(facts([])).status).toEqual({ live: true, label: 'Live on your store' });
    expect(view(facts([], { live: false })).status).toEqual({ live: false, label: 'Hidden on your store' });
    expect(view(facts([], { live: null })).status).toBeNull();
  });
});

describe('Try-On Results in Arabic', () => {
  it('counts as Arabic does, with Western digits', () => {
    const v = view(facts([job(1), job(1, { status: 'failed', message: 'blurry photo' })]), 'ar');
    expect(v.recent[0].label).toBe('صُنعت في 14 ثانية');
    expect(ar.madeIn(3)).toBe('صُنعت في 3 ثوانٍ');
    expect(ar.otherProducts(22, 14)).toBe('المنتجات الـ 22 الأخرى صُنعت منها 14 إطلالة.');
    expect(ar.photosOf(3, 3)).toBe('3 من 3 صور');
    expect(ar.photosOf(250, 271)).toBe('250 من 271 صورة');
    expect(en.photosOf(1, 1)).toBe('1 of 1 photo');
    expect(JSON.stringify(v)).not.toMatch(/[٠-٩]/);
  });
});
