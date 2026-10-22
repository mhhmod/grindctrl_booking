/* Copy for the v16 Try-On Results tab (04-dashboard.md, the TryOnInsights
   board). Every string on that board is still a draft except "Try-On" and
   "Looks"; the pull request lists them for the owner. The Arabic is simple
   Modern Standard Arabic in neutral forms, with counts that agree as Arabic
   counts, and Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export type ResultsPeriod = 7 | 30 | 90;

export interface TryOnResultsCopy {
  tabsLabel: string;
  results: string;
  setUp: string;
  liveOnStore: string;
  hiddenOnStore: string;
  subtitle: string;
  periodLabel: string;
  period: (days: ResultsPeriod) => string;
  looksMade: string;
  onDaysBefore: (pct: number, days: ResultsPeriod) => string;
  fewerOnDaysBefore: (pct: number, days: ResultsPeriod) => string;
  sameAsDaysBefore: (days: ResultsPeriod) => string;
  photosMadeLook: string;
  photosOf: (made: number, photos: number) => string;
  noPhotosYet: string;
  whyTitle: string;
  whySummary: (failed: number, photos: number, pct: number) => string;
  reasons: Record<'photo_rejected' | 'busy' | 'service_unavailable' | 'unknown', { title: string; line: string }>;
  byProduct: string;
  product: string;
  looks: string;
  otherProducts: (products: number, looks: number) => string;
  noLooksYet: string;
  recentLooks: string;
  privacyLine: string;
  madeIn: (seconds: number) => string;
  didntWork: Record<'photo_rejected' | 'busy' | 'service_unavailable' | 'unknown', string>;
  notCounted: string;
  making: string;
  noRecentLooks: string;
  couldNotLoad: string;
}

const en: TryOnResultsCopy = {
  tabsLabel: 'Try-On',
  results: 'Results',
  setUp: 'Set up',
  liveOnStore: 'Live on your store',
  hiddenOnStore: 'Hidden on your store',
  subtitle: 'What shoppers did with try-on.',
  periodLabel: 'Period',
  period: (days) => `Last ${days} days`,
  looksMade: 'Looks made',
  onDaysBefore: (pct, days) => `${pct}% on the ${days} days before`,
  fewerOnDaysBefore: (pct, days) => `${pct}% fewer than the ${days} days before`,
  sameAsDaysBefore: (days) => `Same as the ${days} days before`,
  photosMadeLook: 'Photos that made a look',
  photosOf: (made, photos) => `${made} of ${photos} ${photos === 1 ? 'photo' : 'photos'}`,
  noPhotosYet: 'No photos yet in this period',
  whyTitle: "Why some photos didn't make a look",
  whySummary: (failed, photos, pct) =>
    `${failed} of ${photos} ${photos === 1 ? 'photo' : 'photos'}, about ${pct}%. Failed looks never use a look from your plan.`,
  reasons: {
    photo_rejected: {
      title: "The photo couldn't be used",
      line: 'Shoppers were asked for a clear, front-facing photo of one person in good light. Nothing for you to do.',
    },
    busy: {
      title: 'Our service was busy',
      line: 'Shoppers were asked to try again in a minute, at no cost to you.',
    },
    service_unavailable: {
      title: 'Our service had a problem',
      line: 'Shoppers were asked to try again later. Nothing for you to do.',
    },
    unknown: {
      title: 'Something else went wrong',
      line: 'Shoppers were asked to try again.',
    },
  },
  byProduct: 'By product',
  product: 'Product',
  looks: 'Looks',
  otherProducts: (products, looks) =>
    `The other ${products === 1 ? 'product' : `${products} products`} made ${looks === 1 ? '1 look' : `${looks} looks`}.`,
  noLooksYet: 'No looks yet in this period.',
  recentLooks: 'Recent looks',
  privacyLine: "You never see shoppers' photos or looks here, only what happened.",
  madeIn: (seconds) => `Made in ${seconds} s`,
  didntWork: {
    photo_rejected: "Didn't work, photo couldn't be used",
    busy: "Didn't work, service busy",
    service_unavailable: "Didn't work, service problem",
    unknown: "Didn't work",
  },
  notCounted: 'Not counted',
  making: 'Being made',
  noRecentLooks: 'No looks yet. They show here as shoppers try pieces on.',
  couldNotLoad: "Try-on results couldn't load just now. Refresh in a minute.",
};

const arPhotos = (n: number) => arCount(n, { one: 'صورة واحدة', two: 'صورتين', few: (k) => `${k} صور`, many: (k) => `${k} صورة` });

const ar: TryOnResultsCopy = {
  tabsLabel: 'التجربة الافتراضية',
  results: 'النتائج',
  setUp: 'الإعداد',
  liveOnStore: 'تعمل على متجرك',
  hiddenOnStore: 'مخفية على متجرك',
  subtitle: 'ما فعله المتسوقون مع التجربة.',
  periodLabel: 'الفترة',
  period: (days) => (days === 7 ? 'آخر 7 أيام' : `آخر ${days} يوماً`),
  looksMade: 'الإطلالات',
  onDaysBefore: (pct, days) => `أكثر بنسبة ${pct}% من ${days === 7 ? 'الـ 7 أيام' : `الـ ${days} يوماً`} السابقة`,
  fewerOnDaysBefore: (pct, days) => `أقل بنسبة ${pct}% من ${days === 7 ? 'الـ 7 أيام' : `الـ ${days} يوماً`} السابقة`,
  sameAsDaysBefore: (days) => `مثل ${days === 7 ? 'الـ 7 أيام' : `الـ ${days} يوماً`} السابقة`,
  photosMadeLook: 'صور أنتجت إطلالة',
  photosOf: (made, photos) => `${made} من ${arPhotos(photos)}`,
  noPhotosYet: 'لا صور بعد في هذه الفترة',
  whyTitle: 'لماذا لم تنتج بعض الصور إطلالة',
  whySummary: (failed, photos, pct) =>
    `${failed} من ${arPhotos(photos)}، نحو ${pct}%. الإطلالات التي تفشل لا تُخصم من إطلالات باقتك أبداً.`,
  reasons: {
    photo_rejected: {
      title: 'تعذّر استخدام الصورة',
      line: 'طُلب من المتسوقين صورة واضحة لشخص واحد من الأمام وبإضاءة جيدة. لا تحتاج إلى فعل شيء.',
    },
    busy: {
      title: 'كانت خدمتنا مشغولة',
      line: 'طُلب من المتسوقين المحاولة بعد دقيقة، دون أي تكلفة عليك.',
    },
    service_unavailable: {
      title: 'واجهت خدمتنا مشكلة',
      line: 'طُلب من المتسوقين المحاولة لاحقاً. لا تحتاج إلى فعل شيء.',
    },
    unknown: {
      title: 'حدث خطأ آخر',
      line: 'طُلب من المتسوقين المحاولة مرة أخرى.',
    },
  },
  byProduct: 'حسب المنتج',
  product: 'المنتج',
  looks: 'الإطلالات',
  otherProducts: (products, looks) =>
    `${arCount(products, {
      one: 'المنتج الآخر صُنعت منه',
      two: 'المنتجان الآخران صُنعت منهما',
      few: (n) => `المنتجات الـ ${n} الأخرى صُنعت منها`,
      many: (n) => `المنتجات الـ ${n} الأخرى صُنعت منها`,
    })} ${arCount(looks, { one: 'إطلالة واحدة', two: 'إطلالتان', few: (n) => `${n} إطلالات`, many: (n) => `${n} إطلالة` })}.`,
  noLooksYet: 'لا إطلالات بعد في هذه الفترة.',
  recentLooks: 'أحدث الإطلالات',
  privacyLine: 'لا ترى هنا صور المتسوقين أو إطلالاتهم أبداً، بل ما حدث فقط.',
  madeIn: (seconds) => `صُنعت في ${arCount(seconds, { one: 'ثانية', two: 'ثانيتين', few: (n) => `${n} ثوانٍ`, many: (n) => `${n} ثانية` })}`,
  didntWork: {
    photo_rejected: 'لم تنجح، تعذّر استخدام الصورة',
    busy: 'لم تنجح، الخدمة مشغولة',
    service_unavailable: 'لم تنجح، مشكلة في الخدمة',
    unknown: 'لم تنجح',
  },
  notCounted: 'لا تُحتسب',
  making: 'جارٍ صنعها',
  noRecentLooks: 'لا إطلالات بعد. تظهر هنا عندما يجرّب المتسوقون القطع.',
  couldNotLoad: 'تعذّر تحميل نتائج التجربة الآن. حدّث الصفحة بعد دقيقة.',
};

export function getTryOnResultsCopy(locale: SiteLocale): TryOnResultsCopy {
  return locale === 'ar' ? ar : en;
}
