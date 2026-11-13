/* Copy for the v16 Plan page (04-dashboard.md, the Plan board). Every string
   on that board is still a draft; the pull request lists them for the
   owner. The Arabic is simple Modern Standard Arabic in neutral forms, with
   counts that agree as Arabic counts, and Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface PlanCopy {
  subtitle: string;
  bookCall: string;
  looksThisCycle: string;
  left: (n: number) => string;
  ofResets: (included: string, reset: string) => string;
  of: (included: string) => string;
  addedIncluded: (n: number) => string;
  runsOutAbout: (date: string) => string;
  shouldLast: string;
  outOfLooks: string;
  planNotActive: string;
  paceRunsOut: (perDay: number, daysBefore: number) => string;
  paceLasts: (perDay: number, reset: string) => string;
  paceNone: string;
  hidesWhileOut: string;
  hiddenUntil: (reset: string) => string;
  hiddenPlan: string;
  chartTitle: string;
  chartUsed: string;
  chartPace: string;
  chartNoTryOn: string;
  chartYour: (n: number) => string;
  chartToday: (n: number) => string;
  chartDaysWithout: (n: number) => string;
  tipUsed: (date: string, n: number) => string;
  tipPace: (date: string, n: number) => string;
  tipToday: (date: string, n: number) => string;
  chartDesc: (d: ChartFacts) => string;
  seeNumbers: string;
  day: string;
  looksUsed: string;
  yourPlan: string;
  status: Record<'active' | 'grace' | 'expired' | 'cancelled' | 'none', string>;
  perPeriod: (price: string, unit: 'day' | 'month' | 'year', count: number) => string;
  looksPer: (n: number, unit: 'day' | 'month' | 'year', count: number) => string;
  planLine: (looks: string) => string;
  renewsOn: (date: string) => string;
  comparePlans: string;
  lastCycles: string;
  cycleRange: (from: string, to: string) => string;
  thisCycleSoFar: string;
  yourLimit: (n: number) => string;
  ifYouRunOut: string;
  nothingBreaks: string;
  hidesByItself: string;
  hidesByItselfLine: string;
  chatKeepsWorking: string;
  chatKeepsWorkingLine: string;
  plans: string;
  plansLine: string;
  storeChatIncluded: string;
  storeChatLimitUnknown: string;
  /** Store Chat's limit, the same on every plan: AI replies a day. */
  storeChatLimit: (repliesPerDay: number) => string;
  /** A store whose AI replies are switched off: its team answers. */
  storeChatTeamOnly: string;
  storeChatLimitLine: string;
  /** A store with no plan: what the usage card and Your plan say, and the next step. */
  noLooksYet: string;
  notStarted: string;
  hiddenNoPlan: string;
  noPlan: Record<NoPlanReason, { body: string; action: string }>;
  current: string;
  changePlan: string;
  couldNotLoad: string;
}

/** Why a store has no plan, as far as the page can tell, which decides its
 *  next step: `connect` (its free plan starts once our code is confirmed on
 *  the store), `taken` (its address already used a free plan on another
 *  account) or `ask` (nothing the merchant can do alone). */
export type NoPlanReason = 'connect' | 'taken' | 'ask';

/** What the chart shows, for the sentence that describes it. */
export type ChartFacts = {
  used: number;
  limit: number;
  today: string;
  added: number;
  /** Looks a day at this pace, 0 when none were made. */
  perDay: number;
  /** The day they run out, when that comes before the reset. */
  runOut: string | null;
  daysBefore: number;
  reset: string;
};

const enUnit = (unit: 'day' | 'month' | 'year', count: number) =>
  count === 1 ? `a ${unit}` : `every ${count} ${unit}s`;
const enLooks = (n: number) => (n === 1 ? '1 look' : `${n} looks`);

const en: PlanCopy = {
  subtitle: 'Our team manages your plan for now. To change it or add looks, book a call and we’ll set it up.',
  bookCall: 'Talk to us to add looks',
  looksThisCycle: 'Try-on looks this cycle',
  left: (n) => `${n} left`,
  ofResets: (included, reset) => `of ${included}, resets ${reset}`,
  of: (included) => `of ${included}`,
  addedIncluded: (n) => `Includes ${enLooks(n)} you added.`,
  runsOutAbout: (date) => `Runs out about ${date}`,
  shouldLast: 'Should last to the reset',
  outOfLooks: 'Out of looks',
  planNotActive: 'Plan not active',
  paceRunsOut: (perDay, daysBefore) =>
    `At this pace, about ${enLooks(perDay)} a day, you’ll run out ${daysBefore === 1 ? '1 day' : `${daysBefore} days`} before the reset.`,
  paceLasts: (perDay, reset) => `At this pace, about ${enLooks(perDay)} a day, they’ll last to your ${reset} reset.`,
  paceNone: 'No looks were made in the last 7 days.',
  hidesWhileOut: 'The Try it on button hides while you’re out.',
  hiddenUntil: (reset) => `The Try it on button is hidden until the looks reset on ${reset}.`,
  hiddenPlan: 'The Try it on button is hidden until the plan is active again.',
  chartTitle: 'Looks used this cycle',
  chartUsed: 'Used',
  chartPace: 'At this pace',
  chartNoTryOn: 'No try-on',
  chartYour: (n) => `Your ${n}`,
  chartToday: (n) => `Today, ${n} used`,
  chartDaysWithout: (n) => (n === 1 ? '1 day without try-on' : `${n} days without try-on`),
  tipUsed: (date, n) => `${date}: ${enLooks(n)} used`,
  tipPace: (date, n) => `${date}: about ${n} at this pace`,
  tipToday: (date, n) => `${date}: ${enLooks(n)} used so far`,
  chartDesc: ({ used, limit, today, added, perDay, runOut, daysBefore, reset }) => {
    const base = `${used} of ${limit} looks used by ${today}${added ? `, with ${added} added` : ''}.`;
    if (!perDay) return base;
    return runOut
      ? `${base} At about ${perDay} a day, all ${limit} are used around ${runOut}, ${daysBefore === 1 ? '1 day' : `${daysBefore} days`} before the ${reset} reset.`
      : `${base} At about ${perDay} a day, they last to the ${reset} reset.`;
  },
  seeNumbers: 'See the numbers',
  day: 'Day',
  looksUsed: 'Looks used',
  yourPlan: 'Your plan',
  status: { active: 'Active', grace: 'In grace period', expired: 'Expired', cancelled: 'Cancelled', none: 'No plan' },
  perPeriod: (price, unit, count) => `${price} ${enUnit(unit, count)}`,
  looksPer: (n, unit, count) => `${enLooks(n)} ${enUnit(unit, count)}`,
  planLine: (looks) => `${looks}, Store Chat included.`,
  renewsOn: (date) => `Renews on ${date}.`,
  comparePlans: 'Compare plans',
  lastCycles: 'Looks used, last 3 cycles',
  cycleRange: (from, to) => `${from} to ${to}`,
  thisCycleSoFar: 'This cycle so far',
  yourLimit: (n) => `Your ${n}`,
  ifYouRunOut: 'If you run out',
  nothingBreaks: 'Nothing breaks for your shoppers.',
  hidesByItself: 'The Try it on button hides by itself',
  hidesByItselfLine: 'Shoppers never see an error. It comes back the moment you add looks or the cycle resets.',
  chatKeepsWorking: 'Store Chat keeps working',
  chatKeepsWorkingLine: 'It doesn’t use looks.',
  plans: 'Plans',
  plansLine: 'Every plan has Store Chat.',
  /* Store Chat is not sold by plan. What limits it is one daily count of AI
     replies per store (messenger/ai-budget.ts), the same on every plan, so
     each card says that number rather than a per-plan one that does not exist. */
  storeChatIncluded: 'Store Chat included',
  storeChatLimitUnknown: 'Store Chat: daily AI limit unavailable. Refresh to check.',
  storeChatLimit: (n) => `Store Chat: up to ${n.toLocaleString('en-US')} AI ${n === 1 ? 'reply' : 'replies'} a day`,
  storeChatTeamOnly: 'Store Chat: your team answers, the assistant is off for this store',
  storeChatLimitLine: 'The daily maximum per store is the same on every plan. Past it, new questions go to your team in the Inbox until the next day (UTC). Service capacity can send questions to your team sooner.',
  noLooksYet: 'No looks yet',
  notStarted: 'Your plan has not started.',
  hiddenNoPlan: 'The Try it on button stays hidden until your plan starts.',
  noPlan: {
    connect: {
      body: 'Your Free plan starts by itself once we confirm our code on your store. There is nothing to pay or choose.',
      action: 'Check my store connection',
    },
    taken: {
      body: 'This store already used its free looks on another GRINDCTRL account, so a Free plan cannot start here. Book a call and we’ll set up a plan.',
      action: 'Talk to us to start a plan',
    },
    ask: {
      body: 'This store has no plan yet. Book a call and we’ll start one.',
      action: 'Talk to us to start a plan',
    },
  },
  current: 'Your plan',
  changePlan: 'To change plans, book a call with us.',
  couldNotLoad: "Your plan couldn't load just now. Refresh in a minute.",
};

const arLooks = (n: number) =>
  arCount(n, { one: 'إطلالة واحدة', two: 'إطلالتان', few: (k) => `${k} إطلالات`, many: (k) => `${k} إطلالة` });
/** After "من", where two takes the genitive. */
const arLooksOf = (n: number) =>
  arCount(n, { one: 'إطلالة واحدة', two: 'إطلالتين', few: (k) => `${k} إطلالات`, many: (k) => `${k} إطلالة` });
/** After "حتى": "حتى 2,000 رد", with Western digits and a thousands comma. */
const arReplies = (n: number) =>
  arCount(n, { one: 'رد واحد', two: 'ردّين', few: (k) => `${k} ردود`, many: (k) => `${k.toLocaleString('en-US')} رد` });
const arDays = (n: number) => arCount(n, { one: 'يوم واحد', two: 'يومين', few: (k) => `${k} أيام`, many: (k) => `${k} يوماً` });
const arUnit = (unit: 'day' | 'month' | 'year', count: number) => {
  if (count === 1) return unit === 'month' ? 'شهرياً' : unit === 'year' ? 'سنوياً' : 'يومياً';
  return unit === 'day' ? `كل ${arDays(count)}` : unit === 'month' ? `كل ${count} أشهر` : `كل ${count} سنوات`;
};

const ar: PlanCopy = {
  subtitle: 'يدير فريقنا باقتك حالياً. لتغييرها أو إضافة إطلالات، احجز مكالمة وسنتولى الأمر.',
  bookCall: 'تواصل معنا لإضافة إطلالات',
  looksThisCycle: 'إطلالات التجربة في هذه الدورة',
  left: (n) => `${n} متبقية`,
  ofResets: (included, reset) => `من ${included}، تتجدد في ${reset}`,
  of: (included) => `من ${included}`,
  addedIncluded: (n) => `تشمل ${arLooks(n)} أضفتها.`,
  runsOutAbout: (date) => `تنفد تقريباً يوم ${date}`,
  shouldLast: 'تكفي حتى تجدد الدورة',
  outOfLooks: 'نفدت الإطلالات',
  planNotActive: 'الباقة غير فعّالة',
  paceRunsOut: (perDay, daysBefore) =>
    `بهذا المعدل، نحو ${arLooks(perDay)} يومياً، ستنفد إطلالاتك قبل ${arDays(daysBefore)} من تجدد الدورة.`,
  paceLasts: (perDay, reset) => `بهذا المعدل، نحو ${arLooks(perDay)} يومياً، تكفي حتى تجدد الدورة في ${reset}.`,
  paceNone: 'لم تُصنع أي إطلالات خلال آخر 7 أيام.',
  hidesWhileOut: 'يختفي زر التجربة ما دامت الإطلالات نافدة.',
  hiddenUntil: (reset) => `زر التجربة مخفي حتى تتجدد الإطلالات في ${reset}.`,
  hiddenPlan: 'زر التجربة مخفي حتى تعود الباقة فعّالة.',
  chartTitle: 'الإطلالات المستخدمة في هذه الدورة',
  chartUsed: 'المستخدمة',
  chartPace: 'بهذا المعدل',
  chartNoTryOn: 'بدون تجربة',
  chartYour: (n) => `${n} من باقتك`,
  chartToday: (n) => `اليوم، ${n} مستخدمة`,
  chartDaysWithout: (n) => `${arDays(n)} بدون تجربة`,
  tipUsed: (date, n) => `${date}: ${arLooks(n)} مستخدمة`,
  tipPace: (date, n) => `${date}: نحو ${n} بهذا المعدل`,
  tipToday: (date, n) => `${date}: ${arLooks(n)} مستخدمة حتى الآن`,
  chartDesc: ({ used, limit, today, added, perDay, runOut, daysBefore, reset }) => {
    const base = `استُخدمت ${used} من ${arLooksOf(limit)} حتى ${today}${added ? `، بعد إضافة ${added}` : ''}.`;
    if (!perDay) return base;
    return runOut
      ? `${base} بمعدل ${perDay} يومياً تقريباً، تنفد الإطلالات كلها نحو ${runOut}، أي قبل ${arDays(daysBefore)} من تجدد الدورة في ${reset}.`
      : `${base} بمعدل ${perDay} يومياً تقريباً، تكفي حتى تجدد الدورة في ${reset}.`;
  },
  seeNumbers: 'عرض الأرقام',
  day: 'اليوم',
  looksUsed: 'الإطلالات المستخدمة',
  yourPlan: 'باقتك',
  status: { active: 'نشطة', grace: 'في فترة السماح', expired: 'منتهية', cancelled: 'ملغاة', none: 'لا باقة' },
  perPeriod: (price, unit, count) => `${price} ${arUnit(unit, count)}`,
  looksPer: (n, unit, count) => `${arLooks(n)} ${arUnit(unit, count)}`,
  planLine: (looks) => `${looks}، ودردشة المتجر مشمولة.`,
  renewsOn: (date) => `تتجدد في ${date}.`,
  comparePlans: 'مقارنة الباقات',
  lastCycles: 'الإطلالات المستخدمة، آخر 3 دورات',
  cycleRange: (from, to) => `${from} إلى ${to}`,
  thisCycleSoFar: 'هذه الدورة حتى الآن',
  yourLimit: (n) => `${n} من باقتك`,
  ifYouRunOut: 'إذا نفدت إطلالاتك',
  nothingBreaks: 'لا يتعطل شيء لدى متسوقيك.',
  hidesByItself: 'زر التجربة يختفي تلقائياً',
  hidesByItselfLine: 'لا يرى المتسوقون أي خطأ. ويعود الزر فور إضافة إطلالات أو تجدد الدورة.',
  chatKeepsWorking: 'دردشة المتجر تواصل العمل',
  chatKeepsWorkingLine: 'لا تستهلك أي إطلالات.',
  plans: 'الباقات',
  plansLine: 'كل الباقات تشمل دردشة المتجر.',
  storeChatIncluded: 'دردشة المتجر مشمولة',
  storeChatLimitUnknown: 'دردشة المتجر: تعذّر قراءة حد المساعد اليومي. حدّث الصفحة للتحقق.',
  storeChatLimit: (n) => `دردشة المتجر: حتى ${arReplies(n)} من المساعد يومياً`,
  storeChatTeamOnly: 'دردشة المتجر: فريقك هو من يرد، والمساعد متوقف لهذا المتجر',
  storeChatLimitLine: 'الحد اليومي لكل متجر واحد في كل الباقات. بعده تصل الأسئلة الجديدة إلى فريقك في صندوق الوارد حتى اليوم التالي (بتوقيت UTC). قد تؤدي حدود سعة الخدمة إلى تحويل الأسئلة إلى فريقك قبل ذلك.',
  noLooksYet: 'لا إطلالات بعد',
  notStarted: 'لم تبدأ باقتك بعد.',
  hiddenNoPlan: 'يبقى زر التجربة مخفياً حتى تبدأ باقتك.',
  noPlan: {
    connect: {
      body: 'تبدأ باقتك المجانية تلقائياً فور تأكدنا من وجود الكود على متجرك. لا شيء تدفعه أو تختاره.',
      action: 'تحقق من ربط متجري',
    },
    taken: {
      body: 'استخدم هذا المتجر إطلالاته المجانية من قبل في حساب آخر على GRINDCTRL، لذلك لا يمكن بدء باقة مجانية هنا. احجز مكالمة وسنجهّز لك باقة.',
      action: 'تواصل معنا لبدء باقة',
    },
    ask: {
      body: 'لا توجد باقة لهذا المتجر بعد. احجز مكالمة وسنبدأ لك واحدة.',
      action: 'تواصل معنا لبدء باقة',
    },
  },
  current: 'باقتك',
  changePlan: 'لتغيير الباقة، احجز مكالمة معنا.',
  couldNotLoad: 'تعذّر تحميل باقتك الآن. حدّث الصفحة بعد دقيقة.',
};

export function getPlanCopy(locale: SiteLocale): PlanCopy {
  return locale === 'ar' ? ar : en;
}
