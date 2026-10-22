/* Copy for the v16 Inbox page around today's conversation panel
   (04-dashboard.md, the Inbox board). The panel's own strings live in
   components/dashboard/messenger/conversations-panel.tsx. Drafts; the pull
   request lists them for the owner. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface InboxCopy {
  noStoreChatTitle: string;
  noStoreChatBody: string;
  openStoreChat: string;
  emptyTitle: string;
  emptyBody: string;
  couldNotLoad: string;
}

const en: InboxCopy = {
  noStoreChatTitle: 'Store Chat isn’t set up for this store yet',
  noStoreChatBody: 'Once Store Chat is on your store, shoppers’ messages land here.',
  openStoreChat: 'Open Store Chat',
  emptyTitle: 'No conversations yet',
  emptyBody: 'When shoppers message you from your store, they appear here.',
  couldNotLoad: "The inbox couldn't load just now. Refresh in a minute.",
};

const ar: InboxCopy = {
  noStoreChatTitle: 'دردشة المتجر غير مُعدّة لهذا المتجر بعد',
  noStoreChatBody: 'بمجرد تشغيل دردشة المتجر على متجرك، تصل رسائل المتسوقين إلى هنا.',
  openStoreChat: 'افتح دردشة المتجر',
  emptyTitle: 'لا محادثات بعد',
  emptyBody: 'عندما يراسلك المتسوقون من متجرك، تظهر محادثاتهم هنا.',
  couldNotLoad: 'تعذّر تحميل الرسائل الآن. حدّث الصفحة بعد دقيقة.',
};

export function getInboxCopy(locale: SiteLocale): InboxCopy {
  return locale === 'ar' ? ar : en;
}
