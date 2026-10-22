/* Copy for the v16 Today page (04-dashboard.md, the Today and Today-States
   boards). Strings marked approved in docs/handoff/product-v16/copy are
   used exactly; the rest are drafts listed for the owner in the pull
   request. The Arabic is simple Modern Standard Arabic in neutral forms
   (the boards' feminine "متسوقة" is a sample shopper), with counts that
   agree as Arabic counts, and Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** Arabic agreement with a count: one, two, three to ten, eleven and up. */
export function arCount(n: number, forms: { one: string; two: string; few: (n: number) => string; many: (n: number) => string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return n >= 3 && n <= 10 ? forms.few(n) : forms.many(n);
}

/** A wait of a day or more reads in days (a forgotten handoff can be weeks old). */
const DAY_MINUTES = 24 * 60;

const arMinutes = (n: number) =>
  arCount(n, { one: 'دقيقة', two: 'دقيقتين', few: (m) => `${m} دقائق`, many: (m) => `${m} دقيقة` });
const arHours = (n: number) => arCount(n, { one: 'ساعة', two: 'ساعتين', few: (m) => `${m} ساعات`, many: (m) => `${m} ساعة` });
const arDays = (n: number) => arCount(n, { one: 'يوم', two: 'يومين', few: (m) => `${m} أيام`, many: (m) => `${m} يوماً` });
const arChats = (n: number) =>
  arCount(n, { one: 'محادثة واحدة', two: 'محادثتين', few: (m) => `${m} محادثات`, many: (m) => `${m} محادثة` });

export interface TodayCopy {
  storeHealth: string;
  everythingWorking: string;
  tryOnLive: string;
  tryOnHidden: string;
  tryOnHiddenPlan: string;
  chatSeen: (ago: string) => string;
  chatLastSeen: (ago: string) => string;
  chatNotSeen: string;
  alertsFailing: string;
  healthDetails: string;
  closeDetails: string;
  ago: { justNow: string; minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string };
  needsYou: string;
  thingsCount: (n: number) => string;
  waitingTitle: (n: number) => string;
  longestWait: (wait: string) => string;
  waitingFor: (wait: string) => string;
  cartsHold: (n: number, money: string) => string;
  teamEmailed: string;
  waitMinutes: (n: number) => string;
  openInbox: string;
  runOutTitle: (days: number) => string;
  runOutLine: (daysBefore: number, resetDate: string) => string;
  runOutNoReset: string;
  hiddenTitle: string;
  hiddenLine: string;
  hiddenPlanLine: string;
  hiddenBack: (resetDate: string) => string;
  seePlan: string;
  nothingNeedsYou: string;
  calmAllHandled: (n: number) => string;
  calmSomeHandled: (handled: number, n: number) => string;
  calmNoChats: string;
  calmEmail: string;
  looksToday: (n: number) => string;
  lastSevenDays: string;
  looks: string;
  moreThanBefore: (pct: number) => string;
  fewerThanBefore: (pct: number) => string;
  sameAsBefore: string;
  chatsSolved: string;
  ofChats: (n: number) => string;
  noFinishedChats: string;
  teamFirstReply: string;
  minutesValue: (n: number) => string;
  duringOpeningHours: string;
  notEnoughHandoffs: string;
  details: {
    tryOn: string;
    tryOnShowing: (left: number, total: number) => string;
    tryOnHiddenDetail: string;
    tryOnHiddenPlanDetail: string;
    chat: string;
    chatSeenDetail: (ago: string) => string;
    chatNotSeenDetail: string;
    alerts: string;
    alertsOk: string;
    alertsNone: string;
    alertsFailing: (n: number) => string;
    billing: string;
    billingActive: (plan: string, until: string | null) => string;
    billingAttention: string;
    notChecked: string;
    ok: string;
    attention: string;
  };
}

const en: TodayCopy = {
  storeHealth: 'Store health',
  everythingWorking: 'Everything is working',
  tryOnLive: 'Try-on live',
  tryOnHidden: 'Try it on is hidden, no looks left',
  tryOnHiddenPlan: 'Try it on is hidden, the plan is not active',
  chatSeen: (ago) => `Store Chat live, seen ${ago}`,
  chatLastSeen: (ago) => `Store Chat last seen ${ago}`,
  chatNotSeen: 'Store Chat not seen on your store yet',
  alertsFailing: 'Handoff emails are not reaching anyone',
  healthDetails: 'Health details',
  closeDetails: 'Close health details',
  ago: {
    justNow: 'just now',
    minutes: (n) => `${n} min ago`,
    hours: (n) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
    days: (n) => (n === 1 ? '1 day ago' : `${n} days ago`),
  },
  needsYou: 'Needs you',
  thingsCount: (n) => (n === 1 ? '1 thing' : `${n} things, most urgent first`),
  waitingTitle: (n) => (n === 1 ? '1 shopper wants a person' : `${n} shoppers are waiting for a person`),
  longestWait: (wait) => `Longest wait ${wait}`,
  waitingFor: (wait) => `Waiting ${wait}`,
  cartsHold: (n, money) => (n === 1 ? `their cart holds ${money}` : `their carts hold ${money}`),
  teamEmailed: 'your team was emailed',
  waitMinutes: (n) =>
    n < 60
      ? `${Math.max(1, n)} min`
      : n < 120
        ? '1 hour'
        : n < DAY_MINUTES
          ? `${Math.floor(n / 60)} hours`
          : n < 2 * DAY_MINUTES
            ? '1 day'
            : `${Math.floor(n / DAY_MINUTES)} days`,
  openInbox: 'Open inbox',
  runOutTitle: (days) => (days <= 1 ? 'Looks run out in about a day' : `Looks run out in about ${days} days`),
  runOutLine: (daysBefore, resetDate) =>
    `At this pace, ${daysBefore === 1 ? '1 day' : `${daysBefore} days`} before your ${resetDate} reset. Try it on hides while you're out.`,
  runOutNoReset: "Try it on hides while you're out.",
  hiddenTitle: "Shoppers can't try on right now",
  hiddenLine: 'The looks for this cycle are used up, so Try it on is hidden.',
  hiddenPlanLine: 'The plan is not active, so Try it on is hidden.',
  hiddenBack: (resetDate) => `They come back on ${resetDate}.`,
  seePlan: 'See your plan',
  nothingNeedsYou: 'Nothing needs you',
  calmAllHandled: (n) =>
    n === 1
      ? "The assistant handled today's only chat and nobody is waiting."
      : `The assistant handled all ${n} chats today and nobody is waiting.`,
  calmSomeHandled: (handled, n) => `The assistant handled ${handled} of ${n} chats today, and nobody is waiting.`,
  calmNoChats: 'No chats yet today, and nobody is waiting.',
  calmEmail: "We'll email you if a shopper needs a person.",
  looksToday: (n) => (n === 1 ? '1 look today' : `${n} looks today`),
  lastSevenDays: 'Last 7 days',
  looks: 'Looks',
  moreThanBefore: (pct) => `${pct}% more than the 7 days before`,
  fewerThanBefore: (pct) => `${pct}% fewer than the 7 days before`,
  sameAsBefore: 'Same as the 7 days before',
  chatsSolved: 'Chats the assistant solved',
  ofChats: (n) => (n === 1 ? 'Of 1 chat, the rest went to the team' : `Of ${n} chats, the rest went to the team`),
  noFinishedChats: 'No finished chats yet',
  teamFirstReply: 'Team first reply',
  minutesValue: (n) => `${n} min`,
  duringOpeningHours: 'During opening hours',
  notEnoughHandoffs: 'Shown once your team has answered 5 handoffs',
  details: {
    tryOn: 'Try it on',
    tryOnShowing: (left, total) => `Showing on your store, ${left} looks left of ${total}.`,
    tryOnHiddenDetail: 'Hidden on your store: the looks for this cycle are used up.',
    tryOnHiddenPlanDetail: 'Hidden on your store: the plan is not active.',
    chat: 'Store Chat',
    chatSeenDetail: (ago) => `Seen on your store ${ago}.`,
    chatNotSeenDetail: 'Not seen on your store yet. Check that the GRINDCTRL Store Chat app embed is on in your theme.',
    alerts: 'Handoff alerts',
    alertsOk: 'Every alert in the last 7 days reached your team.',
    alertsNone: 'No handoffs in the last 7 days.',
    alertsFailing: (n) =>
      `${n === 1 ? '1 alert' : `${n} alerts`} in the last 7 days reached nobody. Check who gets them in Store Chat settings.`,
    billing: 'Plan',
    billingActive: (plan, until) => (until ? `${plan}, active until ${until}.` : `${plan}, active.`),
    billingAttention: 'Your plan needs attention. Open Try-On to see why.',
    notChecked: 'Not checked yet: the theme pieces on every product page, and WhatsApp.',
    ok: 'Working',
    attention: 'Needs a look',
  },
};

const ar: TodayCopy = {
  storeHealth: 'حالة المتجر',
  everythingWorking: 'كل شيء يعمل',
  tryOnLive: 'التجربة الافتراضية تعمل',
  tryOnHidden: 'زر التجربة مخفي، لا توجد إطلالات متبقية',
  tryOnHiddenPlan: 'زر التجربة مخفي، الباقة غير فعّالة',
  chatSeen: (ago) => `دردشة المتجر تعمل، آخر نشاط ${ago}`,
  chatLastSeen: (ago) => `آخر ظهور لدردشة المتجر ${ago}`,
  chatNotSeen: 'لم تظهر دردشة المتجر على متجرك بعد',
  alertsFailing: 'تنبيهات التحويل إلى الفريق لا تصل إلى أحد',
  healthDetails: 'تفاصيل الحالة',
  closeDetails: 'إغلاق تفاصيل الحالة',
  ago: {
    justNow: 'الآن',
    minutes: (n) => `قبل ${arMinutes(n)}`,
    hours: (n) => `قبل ${arHours(n)}`,
    days: (n) => `قبل ${arDays(n)}`,
  },
  needsYou: 'يحتاجك الآن',
  thingsCount: (n) =>
    arCount(n, {
      one: 'أمر واحد',
      two: 'أمران، الأكثر إلحاحاً أولاً',
      few: (m) => `${m} أمور، الأكثر إلحاحاً أولاً`,
      many: (m) => `${m} أمراً، الأكثر إلحاحاً أولاً`,
    }),
  waitingTitle: (n) =>
    arCount(n, {
      one: 'متسوق واحد ينتظر شخصاً من فريقك',
      two: 'متسوقان ينتظران شخصاً من فريقك',
      few: (m) => `${m} متسوقين ينتظرون شخصاً من فريقك`,
      many: (m) => `${m} متسوقاً ينتظرون شخصاً من فريقك`,
    }),
  longestWait: (wait) => `أطول انتظار ${wait}`,
  waitingFor: (wait) => `ينتظر منذ ${wait}`,
  cartsHold: (n, money) => (n === 1 ? `وفي سلته ${money}` : `وفي سلالهم ${money}`),
  teamEmailed: 'أُبلغ فريقك بالبريد الإلكتروني',
  waitMinutes: (n) =>
    n < 60 ? arMinutes(Math.max(1, n)) : n < DAY_MINUTES ? arHours(Math.floor(n / 60)) : arDays(Math.floor(n / DAY_MINUTES)),
  openInbox: 'افتح الرسائل',
  runOutTitle: (days) =>
    days <= 1 ? 'الإطلالات تنفد خلال يوم تقريباً' : `الإطلالات تنفد خلال ${arDays(days)} تقريباً`,
  runOutLine: (daysBefore, resetDate) =>
    `بهذا المعدل، قبل ${arDays(daysBefore)} من تجدد الدورة في ${resetDate}. يختفي زر التجربة ما دامت الإطلالات نافدة.`,
  runOutNoReset: 'يختفي زر التجربة ما دامت الإطلالات نافدة.',
  hiddenTitle: 'لا يستطيع المتسوقون التجربة الآن',
  hiddenLine: 'نفدت إطلالات هذه الدورة، لذلك زر التجربة مخفي.',
  hiddenPlanLine: 'الباقة غير فعّالة، لذلك زر التجربة مخفي.',
  hiddenBack: (resetDate) => `تعود في ${resetDate}.`,
  seePlan: 'اطّلع على باقتك',
  nothingNeedsYou: 'لا شيء يحتاجك الآن',
  calmAllHandled: (n) =>
    n === 1
      ? 'تولّى المساعد محادثة اليوم الوحيدة، ولا أحد ينتظر.'
      : n === 2
        ? 'تولّى المساعد المحادثتين كلتيهما اليوم، ولا أحد ينتظر.'
        : `تولّى المساعد المحادثات الـ ${n} كلها اليوم، ولا أحد ينتظر.`,
  calmSomeHandled: (handled, n) => `تولّى المساعد ${handled} من ${n} محادثة اليوم، ولا أحد ينتظر.`,
  calmNoChats: 'لا محادثات بعد اليوم، ولا أحد ينتظر.',
  calmEmail: 'سنراسلك بالبريد الإلكتروني إذا احتاج متسوق إلى شخص من الفريق.',
  looksToday: (n) =>
    arCount(n, {
      one: 'إطلالة واحدة اليوم',
      two: 'إطلالتان اليوم',
      few: (m) => `${m} إطلالات اليوم`,
      many: (m) => `${m} إطلالة اليوم`,
    }),
  lastSevenDays: 'آخر 7 أيام',
  looks: 'الإطلالات',
  moreThanBefore: (pct) => `أكثر بنسبة ${pct}% من الـ 7 أيام السابقة`,
  fewerThanBefore: (pct) => `أقل بنسبة ${pct}% من الـ 7 أيام السابقة`,
  sameAsBefore: 'مثل الـ 7 أيام السابقة',
  chatsSolved: 'محادثات أنهاها المساعد',
  ofChats: (n) => `من ${arChats(n)}، والباقي حُوِّل إلى الفريق`,
  noFinishedChats: 'لا محادثات منتهية بعد',
  teamFirstReply: 'أول رد من الفريق',
  minutesValue: (n) => arMinutes(n),
  duringOpeningHours: 'خلال ساعات العمل',
  notEnoughHandoffs: 'يظهر بعد أن يرد فريقك على 5 تحويلات',
  details: {
    tryOn: 'زر التجربة',
    tryOnShowing: (left, total) => `يظهر على متجرك، ${left} إطلالة متبقية من ${total}.`,
    tryOnHiddenDetail: 'مخفي على متجرك: نفدت إطلالات هذه الدورة.',
    tryOnHiddenPlanDetail: 'مخفي على متجرك: الباقة غير فعّالة.',
    chat: 'دردشة المتجر',
    chatSeenDetail: (ago) => `ظهرت على متجرك ${ago}.`,
    chatNotSeenDetail: 'لم تظهر على متجرك بعد. تأكد من تفعيل إضافة GRINDCTRL Store Chat في قالبك.',
    alerts: 'تنبيهات التحويل',
    alertsOk: 'وصلت كل التنبيهات في آخر 7 أيام إلى فريقك.',
    alertsNone: 'لا تحويلات في آخر 7 أيام.',
    alertsFailing: (n) =>
      `${arCount(n, { one: 'تنبيه واحد', two: 'تنبيهان', few: (m) => `${m} تنبيهات`, many: (m) => `${m} تنبيهاً` })} في آخر 7 أيام لم يصل إلى أحد. راجع من يستلمها في إعدادات دردشة المتجر.`,
    billing: 'الباقة',
    billingActive: (plan, until) => (until ? `${plan}، فعّالة حتى ${until}.` : `${plan}، فعّالة.`),
    billingAttention: 'باقتك تحتاج إلى مراجعة. افتح التجربة الافتراضية لمعرفة السبب.',
    notChecked: 'لم نتحقق بعد من: أجزاء القالب على كل صفحة منتج، وواتساب.',
    ok: 'يعمل',
    attention: 'يحتاج إلى نظرة',
  },
};

export function getTodayCopy(locale: SiteLocale): TodayCopy {
  return locale === 'ar' ? ar : en;
}
