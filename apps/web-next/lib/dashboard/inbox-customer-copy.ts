/* Copy for the v16 Inbox's customer column (04-dashboard.md, the Inbox
   board's "About Salma"). The board's strings are drafts; the pull request
   lists the ones written here. The Arabic is simple Modern Standard Arabic
   in neutral forms, with Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { OrderStage } from '@/lib/messenger/order-card';

export interface InboxCustomerCopy {
  about: (name: string) => string;
  aboutShopper: string;
  shopper: string;
  signedIn: string;
  gaveEmail: string;
  fromPage: (page: string) => string;
  fromHome: string;
  lastOn: (path: string) => string;
  order: (name: string) => string;
  stage: Record<OrderStage, string>;
  stageWith: (stage: string, carrier: string) => string;
  cashOnDelivery: (total: string) => string;
  paid: (total: string) => string;
  track: string;
  openInShopify: string;
  openCustomer: string;
  inCart: string;
  cartTotal: (total: string) => string;
  pastConversations: string;
  pastStatus: Record<'open' | 'handoff_requested' | 'handoff_active' | 'closed', string>;
  noPast: string;
  nothingYet: string;
  loading: string;
  couldNotLoad: string;
  showCustomer: string;
  close: string;
}

const en: InboxCustomerCopy = {
  about: (name) => `About ${name}`,
  aboutShopper: 'About this shopper',
  shopper: 'Shopper',
  signedIn: 'Signed in to the store',
  gaveEmail: 'Gave this email in the chat',
  fromPage: (page) => `From the ${page} page`,
  fromHome: 'From the home page',
  lastOn: (path) => `Last on ${path}`,
  order: (name) => `Order ${name}`,
  stage: {
    preparing: 'Preparing',
    on_its_way: 'On its way',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  },
  stageWith: (stage, carrier) => `${stage} with ${carrier}`,
  cashOnDelivery: (total) => `${total}, cash on delivery`,
  paid: (total) => `${total}, paid`,
  track: 'Track the parcel',
  openInShopify: 'Open in Shopify',
  openCustomer: 'Open the customer in Shopify',
  inCart: 'In the cart',
  cartTotal: (total) => `Total ${total}`,
  pastConversations: 'Past conversations',
  pastStatus: { open: 'With the assistant', handoff_requested: 'Waiting for a person', handoff_active: 'With your team', closed: 'Resolved' },
  noPast: 'This is the first conversation.',
  nothingYet: 'Nothing else is known about this shopper yet.',
  loading: 'Loading what we know…',
  couldNotLoad: "This shopper's details couldn't load. Try again in a minute.",
  showCustomer: 'About the shopper',
  close: 'Close',
};

const ar: InboxCustomerCopy = {
  about: (name) => `عن ${name}`,
  aboutShopper: 'عن هذا المتسوق',
  shopper: 'متسوق',
  signedIn: 'سجّل الدخول إلى المتجر',
  gaveEmail: 'كتب هذا البريد في المحادثة',
  fromPage: (page) => `من صفحة ${page}`,
  fromHome: 'من الصفحة الرئيسية',
  lastOn: (path) => `آخر صفحة: ${path}`,
  order: (name) => `الطلب ${name}`,
  stage: {
    preparing: 'قيد التجهيز',
    on_its_way: 'في الطريق',
    out_for_delivery: 'خرج للتوصيل',
    delivered: 'تم التوصيل',
    cancelled: 'ملغى',
  },
  stageWith: (stage, carrier) => `${stage} مع ${carrier}`,
  cashOnDelivery: (total) => `${total}، الدفع عند الاستلام`,
  paid: (total) => `${total}، مدفوع`,
  track: 'تتبّع الشحنة',
  openInShopify: 'افتح في Shopify',
  openCustomer: 'افتح العميل في Shopify',
  inCart: 'في السلة',
  cartTotal: (total) => `الإجمالي ${total}`,
  pastConversations: 'المحادثات السابقة',
  pastStatus: { open: 'مع المساعد', handoff_requested: 'في انتظار شخص من الفريق', handoff_active: 'مع فريقك', closed: 'تم الحل' },
  noPast: 'هذه أول محادثة.',
  nothingYet: 'لا نعرف شيئاً آخر عن هذا المتسوق بعد.',
  loading: 'جارٍ تحميل ما نعرفه…',
  couldNotLoad: 'تعذّر تحميل تفاصيل هذا المتسوق. حاول مجدداً بعد دقيقة.',
  showCustomer: 'عن المتسوق',
  close: 'إغلاق',
};

export function getInboxCustomerCopy(locale: SiteLocale): InboxCustomerCopy {
  return locale === 'ar' ? ar : en;
}
