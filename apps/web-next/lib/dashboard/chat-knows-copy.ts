/* Copy for the v16 Store Chat page's head and its What it knows tab
   (04-dashboard.md, the Knowledge board). Every string on that board is
   still a draft; the pull request lists them for the owner. The Arabic is
   simple Modern Standard Arabic in neutral forms, with counts that agree as
   Arabic counts, and Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface ChatKnowsCopy {
  tabsLabel: string;
  whatItKnows: string;
  setUp: string;
  liveOn: (domain: string) => string;
  live: string;
  hidden: string;
  answeredShare: (pct: number, chats: number) => string;
  noChatsYet: string;
  openStore: string;
  learnsFrom: string;
  addPageOrNote: string;
  pagesAndNotes: string;
  pagesAndNotesNone: string;
  titlesList: (titles: string[], more: number) => string;
  note: string;
  page: string;
  active: string;
  paused: string;
  pause: string;
  resume: string;
  resync: string;
  remove: string;
  removeConfirm: string;
  removeYes: string;
  keep: string;
  syncedToday: string;
  syncedDaysAgo: (days: number) => string;
  neverSynced: string;
  updatedToday: string;
  updatedDaysAgo: (days: number) => string;
  showAll: (count: number) => string;
  hide: string;
  kindLabel: string;
  title: string;
  titleHint: string;
  content: string;
  contentHint: string;
  link: string;
  linkHint: string;
  add: string;
  adding: string;
  cancel: string;
  added: string;
  addFailed: string;
  linkFailed: string;
  actionFailed: string;
  resynced: string;
  couldNotLoad: string;
}

const enList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const arList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join('، ')} و${items[items.length - 1]}`;
const arDays = (n: number) => arCount(n, { one: 'يوم', two: 'يومين', few: (k) => `${k} أيام`, many: (k) => `${k} يوماً` });
const arChats = (n: number) =>
  arCount(n, { one: 'محادثة واحدة', two: 'محادثتين', few: (k) => `${k} محادثات`, many: (k) => `${k} محادثة` });

const en: ChatKnowsCopy = {
  tabsLabel: 'Store Chat',
  whatItKnows: 'What it knows',
  setUp: 'Set up',
  liveOn: (domain) => `Live on ${domain}`,
  live: 'Live on your store',
  hidden: 'Hidden from shoppers',
  answeredShare: (pct, chats) =>
    `In the last 7 days the assistant answered ${pct}% of ${chats === 1 ? '1 chat' : `${chats} chats`} on its own.`,
  noChatsYet: 'No finished chats in the last 7 days yet.',
  openStore: 'Open your store',
  learnsFrom: 'What it learns from',
  addPageOrNote: 'Add a page or note',
  pagesAndNotes: 'Pages and notes',
  pagesAndNotesNone: 'Nothing yet. Add a page from your store or a note, and the assistant answers from it.',
  titlesList: (titles, more) => (more > 0 ? `${titles.join(', ')} and ${more} more` : enList(titles)),
  note: 'Note',
  page: 'Page',
  active: 'Active',
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Use again',
  resync: 'Re-sync',
  remove: 'Delete',
  removeConfirm: 'Delete this? The assistant stops using it.',
  removeYes: 'Delete',
  keep: 'Keep',
  syncedToday: 'Synced today',
  syncedDaysAgo: (days) => (days === 1 ? 'Synced yesterday' : `Synced ${days} days ago`),
  neverSynced: 'Not synced yet',
  updatedToday: 'Updated today',
  updatedDaysAgo: (days) => (days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`),
  showAll: (count) => `Show all ${count}`,
  hide: 'Show less',
  kindLabel: 'What to add',
  title: 'Title',
  titleHint: 'For example, Shipping and returns',
  content: 'What the assistant should know',
  contentHint: 'Write it the way you would tell a new team member.',
  link: 'Page link',
  linkHint: 'A page on your store, like your FAQ or shipping page.',
  add: 'Add',
  adding: 'Adding…',
  cancel: 'Cancel',
  added: 'Added. The assistant uses it from the next chat.',
  addFailed: "Couldn't add it just now. Try again in a minute.",
  linkFailed: "Couldn't read that page. Check the link opens without a password, then try again.",
  actionFailed: "That didn't go through. Try again in a minute.",
  resynced: 'Re-synced.',
  couldNotLoad: "What the assistant knows couldn't load just now. Refresh in a minute.",
};

const ar: ChatKnowsCopy = {
  tabsLabel: 'دردشة المتجر',
  whatItKnows: 'ما يعرفه',
  setUp: 'الإعداد',
  liveOn: (domain) => `تعمل على ${domain}`,
  live: 'تعمل على متجرك',
  hidden: 'مخفية عن المتسوقين',
  answeredShare: (pct, chats) => `خلال آخر 7 أيام أجاب المساعد بنفسه عن ${pct}% من ${arChats(chats)}.`,
  noChatsYet: 'لا محادثات منتهية خلال آخر 7 أيام بعد.',
  openStore: 'افتح متجرك',
  learnsFrom: 'ما يتعلّم منه',
  addPageOrNote: 'أضف صفحة أو ملاحظة',
  pagesAndNotes: 'الصفحات والملاحظات',
  pagesAndNotesNone: 'لا شيء بعد. أضف صفحة من متجرك أو ملاحظة، وسيجيب المساعد منها.',
  titlesList: (titles, more) => (more > 0 ? `${titles.join('، ')} و${arCount(more, { one: 'واحدة أخرى', two: 'اثنتان أخريان', few: (k) => `${k} أخرى`, many: (k) => `${k} أخرى` })}` : arList(titles)),
  note: 'ملاحظة',
  page: 'صفحة',
  active: 'مفعّلة',
  paused: 'متوقفة',
  pause: 'إيقاف',
  resume: 'استخدامها مجدداً',
  resync: 'مزامنة',
  remove: 'حذف',
  removeConfirm: 'حذفها؟ سيتوقف المساعد عن استخدامها.',
  removeYes: 'حذف',
  keep: 'إبقاء',
  syncedToday: 'تمت المزامنة اليوم',
  syncedDaysAgo: (days) => (days === 1 ? 'تمت المزامنة أمس' : `تمت المزامنة قبل ${arDays(days)}`),
  neverSynced: 'لم تتم المزامنة بعد',
  updatedToday: 'حُدّثت اليوم',
  updatedDaysAgo: (days) => (days === 1 ? 'حُدّثت أمس' : `حُدّثت قبل ${arDays(days)}`),
  showAll: (count) => `عرض الكل (${count})`,
  hide: 'عرض أقل',
  kindLabel: 'ما تريد إضافته',
  title: 'العنوان',
  titleHint: 'مثلاً: الشحن والإرجاع',
  content: 'ما يجب أن يعرفه المساعد',
  contentHint: 'اكتبها كما تشرحها لعضو جديد في فريقك.',
  link: 'رابط الصفحة',
  linkHint: 'صفحة في متجرك، مثل صفحة الأسئلة الشائعة أو الشحن.',
  add: 'إضافة',
  adding: 'جارٍ الإضافة…',
  cancel: 'إلغاء',
  added: 'تمت الإضافة. سيستخدمها المساعد بدءاً من المحادثة التالية.',
  addFailed: 'تعذّرت الإضافة الآن. حاول مرة أخرى بعد دقيقة.',
  linkFailed: 'تعذّرت قراءة هذه الصفحة. تأكد أن الرابط يفتح دون كلمة مرور، ثم حاول مرة أخرى.',
  actionFailed: 'لم يتم ذلك. حاول مرة أخرى بعد دقيقة.',
  resynced: 'تمت المزامنة.',
  couldNotLoad: 'تعذّر تحميل ما يعرفه المساعد الآن. حدّث الصفحة بعد دقيقة.',
};

export function getChatKnowsCopy(locale: SiteLocale): ChatKnowsCopy {
  return locale === 'ar' ? ar : en;
}
