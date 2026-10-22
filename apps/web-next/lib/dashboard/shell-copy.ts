/* Copy for the v16 dashboard shell: the sidebar, the page header, the phone
   bars and the person menu (04-dashboard.md, the shared sidebar on every
   dashboard board). Strings marked approved in docs/handoff/product-v16/copy
   are used exactly; the rest are drafts listed for the owner in the pull
   request. The Arabic is simple Modern Standard Arabic in neutral forms:
   the boards' feminine "المالكة" is the sample owner's own choice, and
   nobody's form of address is guessed (01-system.md). Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type ShellRole = 'owner' | 'admin' | 'member';

export interface ShellCopy {
  skipToContent: string;
  navLabel: string;
  phoneNavLabel: string;
  nav: { today: string; inbox: string; tryOn: string; storeChat: string; storeChatShort: string; plan: string };
  switchStore: (current: string) => string;
  yourStores: string;
  looksThisCycle: string;
  freeLooks: string;
  looksLeft: (left: number, total: number) => string;
  freeLooksLeft: (left: number, total: number) => string;
  roles: Record<ShellRole, string>;
  menu: string;
  closeMenu: string;
  account: string;
  toDark: string;
  toLight: string;
  signOut: string;
  switchLanguage: string;
  otherLanguage: string;
  waiting: (count: number) => string;
  greeting: { morning: (name: string | null) => string; afternoon: (name: string | null) => string; evening: (name: string | null) => string };
}

const en: ShellCopy = {
  skipToContent: 'Skip to content',
  navLabel: 'GrindCTRL',
  phoneNavLabel: 'Main',
  nav: { today: 'Today', inbox: 'Inbox', tryOn: 'Try-On', storeChat: 'Store Chat', storeChatShort: 'Chat', plan: 'Plan' },
  switchStore: (current) => `Switch store, current ${current}`,
  yourStores: 'Your stores',
  looksThisCycle: 'Looks this cycle',
  freeLooks: 'Free looks',
  looksLeft: (left, total) => `${left} left of ${total}`,
  freeLooksLeft: (left, total) => `${left} left of ${total} this month`,
  roles: { owner: 'Owner', admin: 'Admin', member: 'Member' },
  menu: 'Menu',
  closeMenu: 'Close menu',
  account: 'Account',
  toDark: 'Switch to dark mode',
  toLight: 'Switch to light mode',
  signOut: 'Sign out',
  switchLanguage: 'التبديل إلى العربية',
  otherLanguage: 'العربية',
  waiting: (count) => `${count} waiting for a person`,
  greeting: {
    morning: (name) => (name ? `Good morning, ${name}` : 'Good morning'),
    afternoon: (name) => (name ? `Good afternoon, ${name}` : 'Good afternoon'),
    evening: (name) => (name ? `Good evening, ${name}` : 'Good evening'),
  },
};

const ar: ShellCopy = {
  skipToContent: 'انتقل إلى المحتوى',
  navLabel: 'GrindCTRL',
  phoneNavLabel: 'القائمة الرئيسية',
  nav: { today: 'اليوم', inbox: 'الرسائل', tryOn: 'التجربة الافتراضية', storeChat: 'دردشة المتجر', storeChatShort: 'الدردشة', plan: 'الباقة' },
  switchStore: (current) => `تبديل المتجر، الحالي ${current}`,
  yourStores: 'متاجرك',
  looksThisCycle: 'الإطلالات في هذه الدورة',
  freeLooks: 'إطلالات مجانية',
  looksLeft: (left, total) => `${left} متبقية من ${total}`,
  freeLooksLeft: (left, total) => `تبقّى ${left} من ${total} هذا الشهر`,
  roles: { owner: 'المالك', admin: 'مسؤول', member: 'عضو' },
  menu: 'القائمة',
  closeMenu: 'إغلاق القائمة',
  account: 'الحساب',
  toDark: 'التبديل إلى الوضع الداكن',
  toLight: 'التبديل إلى الوضع الفاتح',
  signOut: 'تسجيل الخروج',
  switchLanguage: 'Switch to English',
  otherLanguage: 'English',
  waiting: (count) => `${count} بانتظار شخص من الفريق`,
  greeting: {
    morning: (name) => (name ? `صباح الخير يا ${name}` : 'صباح الخير'),
    afternoon: (name) => (name ? `مساء الخير يا ${name}` : 'مساء الخير'),
    evening: (name) => (name ? `مساء الخير يا ${name}` : 'مساء الخير'),
  },
};

export function getShellCopy(locale: SiteLocale): ShellCopy {
  return locale === 'ar' ? ar : en;
}
