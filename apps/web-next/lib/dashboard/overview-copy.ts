/* Copy for the dashboard Overview page (app/dashboard/overview/page.tsx).

   Same shape as lib/try-on/dashboard-copy.ts: an interface, an en/ar const
   each, and a getter. Kept in its own module rather than folded into
   dashboard-i18n.ts, since that file is deliberately chrome-only (nav titles
   and breadcrumbs) — page bodies own their own strings. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface OverviewCopy {
  manageTryOn: string;

  generations7d: string;
  providerSpend7d: string;
  successRate7d: string;
  installedShopsCard: string;

  noJobsYet: string;
  noFailures: string;
  failedCount: (n: number) => string;
  avgRender: (seconds: string) => string;
  noRendersThisWeek: string;

  trendNewThisWeek: string;
  trendQuiet: string;
  trendLevel: string;
  trendUp: (pct: number) => string;
  trendDown: (pct: number) => string;

  last14Days: string;
  last14DaysBody: string;
  dailyChartAriaLabel: string;

  shopsThisWeek: string;
  shopsThisWeekBody: string;
  noMerchantShopsYet: string;
  columnShop: string;
  columnJobs7d: string;
  columnSpend7d: string;
  columnLastActivity: string;
  uninstalledBadge: string;
  noneYet: string;

  recentFailures: string;
  recentFailuresBody: string;
  nothingFailedRecently: string;
  demoShop: string;
  noMessageRecorded: string;
}

const en: OverviewCopy = {
  manageTryOn: 'Manage try-on',

  generations7d: 'Generations, 7 days',
  providerSpend7d: 'Provider spend, 7 days',
  successRate7d: 'Success rate, 7 days',
  installedShopsCard: 'Installed shops',

  noJobsYet: 'No jobs yet',
  noFailures: 'no failures',
  failedCount: (n) => `${n} failed`,
  avgRender: (seconds) => `avg render ${seconds}s`,
  noRendersThisWeek: 'no renders this week',

  trendNewThisWeek: 'new this week',
  trendQuiet: 'quiet',
  trendLevel: 'level with last week',
  trendUp: (pct) => `up ${pct}% on last week`,
  trendDown: (pct) => `down ${pct}% on last week`,

  last14Days: 'Last 14 days',
  last14DaysBody: 'Generations per day, all shops and the public demo.',
  dailyChartAriaLabel: 'Generations per day, last 14 days',

  shopsThisWeek: 'Shops this week',
  shopsThisWeekBody: 'Who is generating, and what it costs.',
  noMerchantShopsYet: 'No merchant shops yet. Install the app on a store and it appears here.',
  columnShop: 'Shop',
  columnJobs7d: 'Jobs 7d',
  columnSpend7d: 'Spend 7d',
  columnLastActivity: 'Last activity',
  uninstalledBadge: 'uninstalled',
  noneYet: 'None yet',

  recentFailures: 'Recent failures',
  recentFailuresBody: 'The last five failed generations, newest first.',
  nothingFailedRecently: 'Nothing failed recently. When a generation fails, the reason lands here.',
  demoShop: 'demo',
  noMessageRecorded: 'No message recorded',
};

const ar: OverviewCopy = {
  manageTryOn: 'إدارة التجربة الافتراضية',

  generations7d: 'عمليات التوليد، آخر ٧ أيام',
  providerSpend7d: 'تكلفة المزود، آخر ٧ أيام',
  successRate7d: 'معدل النجاح، آخر ٧ أيام',
  installedShopsCard: 'المتاجر المثبَّتة',

  noJobsYet: 'لا توجد عمليات بعد',
  noFailures: 'لا إخفاقات',
  failedCount: (n) => `${n} فشل`,
  avgRender: (seconds) => `متوسط التوليد ${seconds} ث`,
  noRendersThisWeek: 'لا عمليات توليد هذا الأسبوع',

  trendNewThisWeek: 'جديد هذا الأسبوع',
  trendQuiet: 'هادئ',
  trendLevel: 'مستقر مقارنة بالأسبوع الماضي',
  trendUp: (pct) => `ارتفاع ${pct}% عن الأسبوع الماضي`,
  trendDown: (pct) => `انخفاض ${pct}% عن الأسبوع الماضي`,

  last14Days: 'آخر ١٤ يوماً',
  last14DaysBody: 'عمليات التوليد يومياً، لكل المتاجر والتجربة التوضيحية العامة.',
  dailyChartAriaLabel: 'عمليات التوليد يومياً، آخر ١٤ يوماً',

  shopsThisWeek: 'المتاجر هذا الأسبوع',
  shopsThisWeekBody: 'من يستخدم الخدمة، وبأي تكلفة.',
  noMerchantShopsYet: 'لا يوجد متجر تاجر بعد. ثبّت التطبيق على متجر وسيظهر هنا.',
  columnShop: 'المتجر',
  columnJobs7d: 'العمليات (٧ أيام)',
  columnSpend7d: 'التكلفة (٧ أيام)',
  columnLastActivity: 'آخر نشاط',
  uninstalledBadge: 'غير مثبَّت',
  noneYet: 'لا شيء بعد',

  recentFailures: 'أحدث الإخفاقات',
  recentFailuresBody: 'آخر خمس عمليات فاشلة، الأحدث أولاً.',
  nothingFailedRecently: 'لا إخفاقات مؤخراً. عند فشل أي عملية، يظهر السبب هنا.',
  demoShop: 'تجريبي',
  noMessageRecorded: 'لم يُسجَّل أي سبب',
};

export function getOverviewCopy(locale: SiteLocale): OverviewCopy {
  return locale === 'ar' ? ar : en;
}
