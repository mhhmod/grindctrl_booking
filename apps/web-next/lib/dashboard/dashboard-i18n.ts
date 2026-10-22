/* Dashboard chrome in English and Arabic.

   Keyed by canonical pathname so a route's title and description stay
   together and cannot drift from the route table. Only the chrome lives
   here: navigation, page titles, descriptions, breadcrumbs. Page bodies own
   their own strings, and the try-on settings form is already translated in
   lib/try-on/settings-copy.ts, shared with the Shopify embedded admin.

   The locale is the same gc-locale cookie the marketing site and the
   storefront demo use, so a language chosen anywhere carries into here. */

import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';

export type DashboardRouteCopy = { title: string; description: string };

export interface DashboardCopy {
  home: string;
  routes: Record<string, DashboardRouteCopy>;
  /** Sidebar badge aria-label for a nav item's waiting count. */
  navBadgeWaiting: (count: number) => string;
}

const en: DashboardCopy = {
  home: 'Dashboard',
  navBadgeWaiting: (count) => `${count} waiting for a human`,
  routes: {
    '/dashboard': {
      title: 'Overview',
      description: 'The try-on business this week, across every merchant store.',
    },
    '/dashboard/inbox': {
      title: 'Inbox',
      description: 'Shopper conversations that need your team.',
    },
    '/dashboard/try-on': {
      title: 'Try-On',
      description: 'Settings, plans, and generation history for every merchant store.',
    },
    '/dashboard/plan': {
      title: 'Plan and looks',
      description: 'Your plan and the try-on looks this cycle.',
    },
    '/dashboard/store-chat': {
      title: 'Store Chat',
      description: 'The chat box on your storefront: appearance, AI, behaviour, installation.',
    },
    '/dashboard/install': {
      title: 'Widget / Embed',
      description: 'Install snippet, verification concept, and widget preview panel.',
    },
    '/dashboard/settings': {
      title: 'Settings',
      description: 'Workspace configuration and account-level controls.',
    },
  },
};

const ar: DashboardCopy = {
  home: 'لوحة التحكم',
  navBadgeWaiting: (count) => `${count} بانتظار الرد`,
  routes: {
    '/dashboard': {
      title: 'نظرة عامة',
      description: 'أداء التجربة الافتراضية هذا الأسبوع عبر كل متجر.',
    },
    '/dashboard/inbox': {
      title: 'الرسائل',
      description: 'محادثات المتسوقين التي تحتاج فريقك.',
    },
    '/dashboard/try-on': {
      title: 'التجربة الافتراضية',
      description: 'الإعدادات والخطط وسجل الإنشاء لكل متجر.',
    },
    '/dashboard/plan': {
      title: 'الباقة والإطلالات',
      description: 'باقتك وإطلالات التجربة في هذه الدورة.',
    },
    '/dashboard/store-chat': {
      title: 'دردشة المتجر',
      description: 'صندوق الدردشة في متجرك: المظهر، الذكاء الاصطناعي، السلوك، والتثبيت.',
    },
    '/dashboard/install': {
      title: 'الأداة والتضمين',
      description: 'كود التثبيت والتحقق ولوحة معاينة الأداة.',
    },
    '/dashboard/settings': {
      title: 'الإعدادات',
      description: 'إعدادات مساحة العمل وضوابط الحساب.',
    },
  },
};

export function getDashboardCopy(locale: SiteLocale = DEFAULT_SITE_LOCALE): DashboardCopy {
  return locale === 'ar' ? ar : en;
}
