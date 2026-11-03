/* Copy for the dashboard states that are not one page's own: a person with
   no store yet, a store list that could not be read, a page that needs a
   Shopify store, and the page-level error and loading text (04-dashboard.md).
   Drafts; the pull request lists them for the owner. Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface StatesCopy {
  noStore: { title: string; body: string; setUpChat: string };
  lookupFailed: { title: string; body: string; retry: string };
  needsShopify: {
    tryOn: { title: string; body: string };
    plan: { title: string; body: string };
    switchBody: string;
    switchTo: (store: string) => string;
  };
  storeTaken: { title: string; body: string; action: string };
  backToSetUp: string;
  error: { title: string; body: string; retry: string; reference: string };
  loading: string;
}

const en: StatesCopy = {
  noStore: {
    title: 'Connect your first store',
    body: 'Your results appear here once a store is connected. Connect a Shopify store, or set up Store Chat on your own website.',
    setUpChat: 'Set up Store Chat on your website',
  },
  lookupFailed: {
    title: 'We couldn’t load your stores',
    body: 'Something went wrong on our side, and nothing you saved was lost. Try again in a moment.',
    retry: 'Try again',
  },
  needsShopify: {
    tryOn: {
      title: 'Try-On needs a Shopify store',
      body: 'Try-On runs on the product pages of a Shopify store. Connect one to turn it on.',
    },
    plan: {
      title: 'Plans belong to a Shopify store',
      body: 'Your plan and looks are tied to a Shopify store. Connect one to see them here.',
    },
    switchBody: 'You already have a Shopify store connected.',
    switchTo: (store) => `Switch to ${store}`,
  },
  // The store's Try-On link is on this account, so the merchant can move
  // Store Chat themselves: a re-link from Shopify admin moves both.
  storeTaken: {
    title: 'This store’s Store Chat is on another account',
    body: 'To move it here: in Try-On, choose “Connect or re-link a store” to get a code. Then in your Shopify admin, open Apps, then GrindCTRL, choose “Link a different account” and enter the code.',
    action: 'Get a linking code',
  },
  backToSetUp: 'Back to Set up',
  error: {
    title: 'This page did not load',
    body: 'Something went wrong on our side. Trying again usually works. The problem is often momentary.',
    retry: 'Try again',
    reference: 'Reference',
  },
  loading: 'Loading',
};

const ar: StatesCopy = {
  noStore: {
    title: 'اربط متجرك الأول',
    body: 'تظهر نتائجك هنا بعد ربط متجر. اربط متجر Shopify، أو فعّل دردشة المتجر على موقعك.',
    setUpChat: 'فعّل دردشة المتجر على موقعك',
  },
  lookupFailed: {
    title: 'تعذّر تحميل متاجرك',
    body: 'حدث خطأ من جانبنا ولم يضع أي شيء حفظته. حاول مرة أخرى بعد قليل.',
    retry: 'إعادة المحاولة',
  },
  needsShopify: {
    tryOn: {
      title: 'التجربة الافتراضية تحتاج إلى متجر Shopify',
      body: 'تعمل التجربة الافتراضية في صفحات منتجات متجر Shopify. اربط متجراً لتشغيلها.',
    },
    plan: {
      title: 'الباقات مرتبطة بمتجر Shopify',
      body: 'باقتك وإطلالاتك مرتبطة بمتجر Shopify. اربط متجراً لعرضها هنا.',
    },
    switchBody: 'لديك متجر Shopify مرتبط بالفعل.',
    switchTo: (store) => `التبديل إلى ${store}`,
  },
  storeTaken: {
    title: 'محادثة المتجر لهذا المتجر على حساب آخر',
    body: 'لنقلها إلى هنا: من صفحة التجربة اختر "ربط متجر أو إعادة ربطه" للحصول على رمز. ثم في لوحة تحكم شوبيفاي افتح التطبيقات ثم جريند كنترول، واختر "ربط حساب آخر" وأدخل الرمز.',
    action: 'احصل على رمز الربط',
  },
  backToSetUp: 'العودة إلى الإعداد',
  error: {
    title: 'تعذّر تحميل هذه الصفحة',
    body: 'حدث خطأ من جانبنا. إعادة المحاولة تنجح عادةً، فالمشكلة غالباً مؤقتة.',
    retry: 'إعادة المحاولة',
    reference: 'الرقم المرجعي',
  },
  loading: 'جارٍ التحميل',
};

export function getStatesCopy(locale: SiteLocale): StatesCopy {
  return locale === 'ar' ? ar : en;
}
