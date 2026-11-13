/* Copy for the dashboard states that are not one page's own: a person with
   no store yet, a store list that could not be read, a page that needs a
   Shopify store, and the page-level error and loading text (04-dashboard.md).
   Drafts; the pull request lists them for the owner. Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface StatesCopy {
  noStore: { title: string; body: string; setUpChat: string };
  lookupFailed: { title: string; body: string; retry: string };
  needsStore: {
    tryOn: { title: string; body: string };
    plan: { title: string; body: string };
    switchBody: string;
    switchTo: (store: string) => string;
    wooAction: string;
    wooHint: string;
    pasteAction: string;
    pasteHint: string;
  };
  storeTaken: { title: string; body: string; action: string };
  /** Pasted code on a Shopify store that is not confirmed yet. */
  finishConfirming: { title: (shop: string) => string; body: string; action: string };
  error: { title: string; body: string; retry: string; reference: string };
  /** The session ended (expired, or signed out in another tab). */
  sessionEnded: { title: string; body: string; action: string };
  loading: string;
}

const en: StatesCopy = {
  noStore: {
    title: 'Connect your first store',
    body: 'Your results appear here once a store is connected. Paste one code into your store, on Shopify, EasyOrders or any website, or connect the Shopify app.',
    setUpChat: 'Install with a code',
  },
  lookupFailed: {
    title: 'We couldn’t load your stores',
    body: 'Something went wrong on our side, and nothing you saved was lost. Try again in a moment.',
    retry: 'Try again',
  },
  needsStore: {
    tryOn: {
      title: 'Connect your store to turn on Try-On',
      body: 'Try-On runs on your product pages. Pick the way that fits your store.',
    },
    plan: {
      title: 'Plans belong to a connected store',
      body: 'Your plan and looks are tied to a Shopify or WooCommerce store. Connect one to see them here.',
    },
    switchBody: 'You already have a Shopify store connected.',
    switchTo: (store) => `Switch to ${store}`,
    wooAction: 'Connect a WooCommerce store',
    wooHint: 'Install the GRINDCTRL plugin on WordPress and pair it with a code from Store Chat.',
    pasteAction: 'Install with a code',
    pasteHint: 'Paste one code into your store. Works on Shopify, EasyOrders and any website, no app needed.',
  },
  // The store's Try-On link is on this account, so the merchant can move
  // Store Chat themselves: a re-link from Shopify admin moves both.
  storeTaken: {
    title: 'This store’s Store Chat is on another account',
    body: 'To move it here: in Try-On, choose “Connect or re-link a store” to get a code. Then in your Shopify admin, open Apps, then GrindCTRL, choose “Link a different account” and enter the code.',
    action: 'Get a linking code',
  },
  finishConfirming: {
    title: (shop) => `Finish confirming ${shop}`,
    body: 'One step is left: confirm in Store setup that this store is yours. Try-On, your plan and your results show here after that.',
    action: 'Finish confirming',
  },
  error: {
    title: 'This page did not load',
    body: 'Something went wrong on our side. Trying again usually works. The problem is often momentary.',
    retry: 'Try again',
    reference: 'Reference',
  },
  sessionEnded: {
    title: 'You were signed out',
    body: 'Sign in again to continue. You’ll come back to this page, and an unsent reply or invite is kept on this device.',
    action: 'Sign in again',
  },
  loading: 'Loading',
};

const ar: StatesCopy = {
  noStore: {
    title: 'اربط متجرك الأول',
    body: 'تظهر نتائجك هنا بعد ربط متجر. الصق كوداً واحداً في متجرك على Shopify أو EasyOrders أو أي موقع، أو اربط تطبيق Shopify.',
    setUpChat: 'ثبّت بكود',
  },
  lookupFailed: {
    title: 'تعذّر تحميل متاجرك',
    body: 'حدث خطأ من جانبنا ولم يضع أي شيء حفظته. حاول مرة أخرى بعد قليل.',
    retry: 'إعادة المحاولة',
  },
  needsStore: {
    tryOn: {
      title: 'اربط متجرك لتشغيل التجربة الافتراضية',
      body: 'تعمل التجربة الافتراضية في صفحات منتجاتك. اختر الطريقة التي تناسب متجرك.',
    },
    plan: {
      title: 'الباقات مرتبطة بمتجر مرتبط',
      body: 'باقتك وإطلالاتك مرتبطة بمتجر Shopify أو WooCommerce. اربط متجراً لعرضها هنا.',
    },
    switchBody: 'لديك متجر Shopify مرتبط بالفعل.',
    switchTo: (store) => `التبديل إلى ${store}`,
    wooAction: 'اربط متجر WooCommerce',
    wooHint: 'ثبّت إضافة GRINDCTRL على ووردبريس واربطها برمز من دردشة المتجر.',
    pasteAction: 'ثبّت بكود',
    pasteHint: 'الصق كوداً واحداً في متجرك. يعمل على Shopify وEasyOrders وأي موقع، بدون تطبيق.',
  },
  storeTaken: {
    title: 'محادثة المتجر لهذا المتجر على حساب آخر',
    body: 'لنقلها إلى هنا: من صفحة التجربة اختر "ربط متجر أو إعادة ربطه" للحصول على رمز. ثم في لوحة تحكم شوبيفاي افتح التطبيقات ثم جريند كنترول، واختر "ربط حساب آخر" وأدخل الرمز.',
    action: 'احصل على رمز الربط',
  },
  finishConfirming: {
    // The shop is a Latin host: isolate it so it keeps its own direction.
    title: (shop) => `أكمل تأكيد ⁨${shop}⁩`,
    body: 'بقيت خطوة واحدة: أكّد من إعداد المتجر أن هذا المتجر لك. بعدها تظهر هنا التجربة الافتراضية وخطتك ونتائجك.',
    action: 'أكمل التأكيد',
  },
  error: {
    title: 'تعذّر تحميل هذه الصفحة',
    body: 'حدث خطأ من جانبنا. إعادة المحاولة تنجح عادةً، فالمشكلة غالباً مؤقتة.',
    retry: 'إعادة المحاولة',
    reference: 'الرقم المرجعي',
  },
  sessionEnded: {
    title: 'تم تسجيل خروجك',
    body: 'سجّل الدخول مرة أخرى للمتابعة. ستعود إلى هذه الصفحة، ويبقى الرد أو الدعوة التي لم تُرسل محفوظًا على هذا الجهاز.',
    action: 'سجّل الدخول مرة أخرى',
  },
  loading: 'جارٍ التحميل',
};

export function getStatesCopy(locale: SiteLocale): StatesCopy {
  return locale === 'ar' ? ar : en;
}
