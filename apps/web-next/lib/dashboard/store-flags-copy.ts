import type { SiteLocale } from '@/lib/landing/landing-i18n';
// StoreFlagsCard previously had inline English operator labels only.
export function getStoreFlagsCopy(locale: SiteLocale) {
  return locale === 'ar' ? {
    dailyLimits: 'الحدود اليومية', storeChatDailyTurns: 'ردود المساعد الذكي في اليوم', tryOnDailyLooks: 'إطلالات القياس في اليوم',
    usage: (used: number, limit: number) => `${used} من ${limit} اليوم`,
    reset: 'يُعاد العدّ الساعة 00:00 بتوقيت UTC', default: (n: number) => `الافتراضي (${n})`,
    save: 'حفظ', saved: 'تم الحفظ', failed: 'تعذّر الحفظ. حاول مرة أخرى.', unknown: 'غير متاح',
  } : {
    dailyLimits: 'Daily limits', storeChatDailyTurns: 'Store Chat AI replies per day', tryOnDailyLooks: 'Try-On looks per day',
    usage: (used: number, limit: number) => `${used} of ${limit} today`,
    reset: 'Resets at 00:00 UTC', default: (n: number) => `Default (${n})`,
    save: 'Save', saved: 'Saved', failed: "Couldn't save. Try again.", unknown: 'Unavailable',
  };
}
