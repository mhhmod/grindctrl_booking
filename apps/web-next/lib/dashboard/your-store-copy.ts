/* Copy for the Your store page and its card on Today (Pack A handoff,
   docs/design-briefs/pack-a/handoff.txt, section 2). The handoff's strings
   are used exactly; values in braces there are filled in here. The few
   lines the handoff does not carry (a failed save, an inactive plan, the
   not-connected card) reuse wording the dashboard already ships. Western
   digits in both languages. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type PillKind = 'well' | 'attention' | 'bad' | 'waiting' | 'preview';

export interface YourStoreCopy {
  title: string;
  pill: Record<PillKind, string>;
  /** Banner while both switches are off and the code works (A5.1). */
  codeWorkingOn: (domain: string) => string;
  shoppersSeeNothing: string;
  showInstallSteps: string;
  installSteps: string;
  headingOff: string;
  headingOn: string;
  on: string;
  off: string;
  products: {
    tryOn: { name: string; sentence: string; cant: string };
    storeChat: { name: string; sentence: string; cant: string };
  };
  preview: string;
  looksLeftThisMonth: (n: number) => string;
  seeItOnYourStore: string;
  opensInNewTab: string;
  updatedCodeNote: string;
  getUpdatedCode: string;
  newFeatures: string;
  saveFailed: string;
  alertsLabel: string;
  check: {
    title: string;
    checkedAt: (time: string) => string;
    runNow: string;
    checking: string;
    checkingLabel: string;
    whatToFix: string;
    moreYouCanAdd: string;
    workingWell: string;
    waiting: string;
    /** The way forward while waiting: the connect card on the same page. */
    waitingAction: string;
  };
  rows: {
    productPages: string;
    floating: string;
    pickSpot: string;
    /** Pack B, B7.4: the owner's chosen spot is no longer on their product pages. */
    spotMoved: string;
    pickAgain: string;
    /** The owner chose the floating button (Pack B, B1.3), so floating is working as asked. */
    floatingChosen: string;
    collectionPages: string;
    easyOrdersPills: string;
    productPhotos: string;
    photosReady: string;
    productDetails: string;
    missingDetails: string;
    askUs: string;
    addLine: string;
    contactUs: string;
    pillsOff: string;
    turnOnPills: string;
    inlinePages: (inline: number, total: number) => string;
    pillProducts: (n: number) => string;
    photoFailure: (host: string) => string;
    code: string;
    seen: (ago: string) => string;
    connected: string;
    notSeenSince: (when: string) => string;
    reinstall: string;
    looks: string;
    dailyLimitReached: string;
    outOfLooks: string;
    looksLow: (n: number) => string;
    planInactive: string;
    topUp: string;
    seePlan: string;
    storeChat: string;
    live: string;
    addresses: string;
    liveCount: (live: number, total: number) => string;
    domainLive: string;
    domainWaiting: string;
    domainNeedsProof: string;
    proveItsYours: string;
  };
  ago: { justNow: string; minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string };
  since: { weekday: (day: string) => string; date: (date: string) => string };
  notConnected: { title: string; body: string; action: string };
  /** The Connect your store card at the top of Store setup. */
  connect: { title: string; connectedTitle: string; installed: (ago: string) => string; waiting: string; hideSteps: string; openStore: string };
  todayCard: { viewStoreCheck: string };
}

/** Arabic agreement with a count: one, two, three to ten, eleven and up. */
function arCount(n: number, forms: { one: string; two: string; few: (n: number) => string; many: (n: number) => string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return n >= 3 && n <= 10 ? forms.few(n) : forms.many(n);
}

/* The handoff's two samples: "متبقي 15 إطلالة" and "متبقي 3 إطلالات". */
const arLooks = (n: number) => (n >= 3 && n <= 10 ? `${n} إطلالات` : `${n} إطلالة`);

const en: YourStoreCopy = {
  title: 'Your store',
  pill: {
    well: 'Working well',
    attention: 'Needs attention',
    bad: 'Not working',
    waiting: 'Waiting for data',
    preview: 'In preview',
  },
  codeWorkingOn: (domain) => `Your code is working on ${domain}`,
  shoppersSeeNothing: 'Shoppers see nothing yet. Turn on what you want below.',
  showInstallSteps: 'Show the install steps',
  installSteps: 'Install steps',
  headingOff: 'Turn on what you want',
  headingOn: 'On your store',
  on: 'On',
  off: 'Off',
  products: {
    tryOn: {
      name: 'Try-On',
      sentence: 'Shoppers see a Try-On button on your product pages.',
      cant: "Shoppers can't see the Try-On button right now.",
    },
    storeChat: {
      name: 'Store Chat',
      sentence: 'Shoppers see Store Chat on every page.',
      cant: "Shoppers can't see Store Chat right now.",
    },
  },
  preview: "Only you can see it while you're in preview.",
  looksLeftThisMonth: (n) => (n === 1 ? '1 look left this month' : `${n} looks left this month`),
  seeItOnYourStore: 'See it on your store',
  opensInNewTab: 'opens in a new tab',
  updatedCodeNote: 'Collection pills need your updated code. Everything else keeps working.',
  getUpdatedCode: 'Get my updated code',
  newFeatures: 'New features appear here.',
  saveFailed: 'That didn’t save. Try again.',
  alertsLabel: 'Email me when something stops working',
  check: {
    title: 'Store check',
    checkedAt: (time) => `Checked today at ${time}`,
    runNow: 'Run check now',
    checking: 'Checking…',
    checkingLabel: 'Checking your store',
    whatToFix: 'What to fix',
    moreYouCanAdd: 'More you can add',
    workingWell: 'Working well',
    waiting: "We'll check your store as soon as your code is live. This updates by itself.",
    waitingAction: 'Finish connecting your store',
  },
  rows: {
    productPages: "Product pages",
    floating: "Showing as a floating button. Pick a spot?",
    pickSpot: "Pick a spot",
    spotMoved: 'Your chosen spot moved. Try-On is showing next to your Buy button until you pick again.',
    pickAgain: 'Pick again',
    floatingChosen: 'Floating button',
    collectionPages: "Collection pages",
    easyOrdersPills: "Show a Try-On pill on your collection pages. Needs Connect EasyOrders.",
    productPhotos: "Product photos",
    photosReady: "Ready for Try-On",
    missingDetails: "We can't find product details on your product pages. Add one line, or",
    askUs: "ask us",
    addLine: "Add one line",
    contactUs: "Contact us",
    pillsOff: "Pills are off.",
    turnOnPills: "Turn on pills",
    // No title/healthy details sentence in A6: reuse Product pages / Connected.
    productDetails: "Product pages",
    inlinePages: (inline, total) => `Next to "Add to cart" on ${inline} of ${total} pages`,
    pillProducts: (n) => `Try on pills on ${n} products`,
    photoFailure: (host) => `We can't use your product photos from ${host}. Contact us, we'll add it.`,
    code: 'Code on your store',
    seen: (ago) => `Seen ${ago}`,
    connected: 'Connected',
    notSeenSince: (when) => `We haven't seen your code since ${when}. Usually a theme change removed it.`,
    reinstall: 'Reinstall in 1 minute',
    looks: 'Try-On availability',
    dailyLimitReached: 'Paused for today: daily limit reached. Back at 00:00 UTC.',
    outOfLooks: 'Out of looks. The button is hidden from shoppers until you top up.',
    looksLow: (n) => (n === 1 ? '1 look left this month.' : `${n} looks left this month.`),
    planInactive: 'The plan is not active, so Try it on is hidden.',
    topUp: 'Top up',
    seePlan: 'See your plan',
    storeChat: 'Store Chat',
    live: 'Live',
    addresses: 'Addresses',
    liveCount: (live, total) => `${live} of ${total} live`,
    domainLive: 'Live',
    domainWaiting: 'Waiting',
    domainNeedsProof: 'Needs proof',
    proveItsYours: "Prove it's yours",
  },
  ago: {
    justNow: 'just now',
    minutes: (n) => (n === 1 ? '1 minute ago' : `${n} minutes ago`),
    hours: (n) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
    days: (n) => (n === 1 ? '1 day ago' : `${n} days ago`),
  },
  since: { weekday: (day) => day, date: (date) => date },
  connect: {
    title: 'Connect your store',
    connectedTitle: 'Your store',
    installed: (ago) => `Installed · last seen ${ago}`,
    waiting: 'Waiting for your code',
    hideSteps: 'Hide install steps',
    openStore: 'Open my store',
  },
  notConnected: {
    title: 'Not connected yet',
    body: 'One code runs everything.',
    action: 'Connect your store',
  },
  todayCard: { viewStoreCheck: 'View store check' },
};

const ar: YourStoreCopy = {
  title: 'متجرك',
  pill: {
    well: 'يعمل جيدًا',
    attention: 'يحتاج انتباهك',
    bad: 'لا يعمل',
    waiting: 'في انتظار البيانات',
    preview: 'في المعاينة',
  },
  codeWorkingOn: (domain) => `الكود يعمل على ${domain}`,
  shoppersSeeNothing: 'لا يظهر شيء للمتسوقين بعد. شغّل ما تريده من الأسفل.',
  showInstallSteps: 'اعرض خطوات التركيب',
  installSteps: 'خطوات التركيب',
  headingOff: 'شغّل ما تريد',
  headingOn: 'على متجرك',
  on: 'مفعّل',
  off: 'متوقف',
  products: {
    tryOn: {
      name: 'القياس الافتراضي',
      sentence: 'يرى المتسوقون زر القياس الافتراضي في صفحات منتجاتك.',
      cant: 'لا يرى المتسوقون زر القياس الافتراضي الآن.',
    },
    storeChat: {
      name: 'محادثة المتجر',
      sentence: 'يرى المتسوقون محادثة المتجر في كل صفحة.',
      cant: 'لا يرى المتسوقون محادثة المتجر الآن.',
    },
  },
  preview: 'أنت فقط تراها ما دمت في وضع المعاينة.',
  looksLeftThisMonth: (n) => `متبقي ${arLooks(n)} هذا الشهر`,
  seeItOnYourStore: 'شاهده على متجرك',
  opensInNewTab: 'يفتح في تبويب جديد',
  updatedCodeNote: 'شارات صفحات المجموعات تحتاج الكود المحدّث. كل شيء آخر يعمل كما هو.',
  getUpdatedCode: 'احصل على الكود المحدّث',
  newFeatures: 'المزايا الجديدة تظهر هنا.',
  saveFailed: 'لم يُحفظ ذلك. حاول مجدداً.',
  alertsLabel: 'أرسل لي بريدًا عندما يتوقف شيء عن العمل',
  check: {
    title: 'فحص المتجر',
    checkedAt: (time) => `آخر فحص اليوم ${time}`,
    runNow: 'افحص الآن',
    checking: 'جارٍ الفحص…',
    checkingLabel: 'جارٍ فحص متجرك',
    whatToFix: 'ما يحتاج إصلاحًا',
    moreYouCanAdd: 'يمكنك إضافة المزيد',
    workingWell: 'يعمل جيدًا',
    waiting: 'سنفحص متجرك فور أن يعمل الكود، وتتحدث هذه الصفحة تلقائياً.',
    waitingAction: 'أكمل ربط متجرك',
  },
  rows: {
    productPages: "صفحات المنتجات",
    floating: "يظهر كزر عائم. هل تختار له مكانًا؟",
    pickSpot: "اختر المكان",
    spotMoved: 'تغيّر المكان الذي اخترته. يظهر زر القياس بجوار زر الشراء حتى تختار من جديد.',
    pickAgain: 'اختر من جديد',
    floatingChosen: 'زر عائم',
    collectionPages: "صفحات المجموعات",
    easyOrdersPills: "اعرض شارة القياس الافتراضي في صفحات المجموعات. يحتاج إلى ربط EasyOrders.",
    productPhotos: "صور المنتجات",
    photosReady: "جاهزة للقياس الافتراضي",
    missingDetails: "لا نجد بيانات المنتج في صفحات منتجاتك. أضف سطرًا واحدًا، أو",
    askUs: "اطلب منا",
    addLine: "أضف سطرًا واحدًا",
    contactUs: "تواصل معنا",
    pillsOff: "الشارات متوقفة.",
    turnOnPills: "شغّل الشارات",
    // No title/healthy details sentence in A6: reuse Product pages / Connected.
    productDetails: "صفحات المنتجات",
    inlinePages: (inline, total) => `بجوار «أضف للسلة» في ${inline} من ${total} صفحة`,
    pillProducts: (n) => `شارات القياس على ${n} منتجًا`,
    photoFailure: (host) => `لا نستطيع استخدام صور منتجاتك من ${host}. تواصل معنا وسنضيفه.`,
    code: 'الكود على متجرك',
    seen: (ago) => `شوهد ${ago}`,
    connected: 'مربوط',
    notSeenSince: (when) => `لم نرَ الكود منذ ${when}. غالبًا حذفه تغيير في القالب.`,
    reinstall: 'أعد التركيب في دقيقة',
    looks: 'رصيد القياس الافتراضي',
    dailyLimitReached: 'متوقف اليوم: تم بلوغ الحد اليومي. يعود الساعة 00:00 بتوقيت UTC.',
    outOfLooks: 'انتهت الإطلالات. الزر مخفي عن المتسوقين حتى تضيف رصيدًا.',
    looksLow: (n) => `متبقي ${arLooks(n)} هذا الشهر.`,
    planInactive: 'الباقة غير فعّالة، لذلك زر التجربة مخفي.',
    topUp: 'أضف إطلالات',
    seePlan: 'اطّلع على باقتك',
    storeChat: 'محادثة المتجر',
    live: 'يعمل',
    addresses: 'العناوين',
    liveCount: (live, total) => `${live} من ${total} يعمل`,
    domainLive: 'يعمل',
    domainWaiting: 'في الانتظار',
    domainNeedsProof: 'يحتاج إثباتًا',
    proveItsYours: 'أثبت أنه متجرك',
  },
  ago: {
    justNow: 'الآن',
    minutes: (n) =>
      `منذ ${arCount(n, { one: 'دقيقة', two: 'دقيقتين', few: (m) => `${m} دقائق`, many: (m) => `${m} دقيقة` })}`,
    hours: (n) => `منذ ${arCount(n, { one: 'ساعة', two: 'ساعتين', few: (m) => `${m} ساعات`, many: (m) => `${m} ساعة` })}`,
    days: (n) => `منذ ${arCount(n, { one: 'يوم', two: 'يومين', few: (m) => `${m} أيام`, many: (m) => `${m} يومًا` })}`,
  },
  since: { weekday: (day) => `يوم ${day}`, date: (date) => date },
  connect: {
    title: 'اربط متجرك',
    connectedTitle: 'متجرك',
    installed: (ago) => `مُركّب · آخر ظهور ${ago}`,
    waiting: 'في انتظار الكود',
    hideSteps: 'إخفاء خطوات التركيب',
    openStore: 'افتح متجري',
  },
  notConnected: {
    title: 'لم يُربط بعد',
    body: 'كود واحد يشغّل كل شيء.',
    action: 'اربط متجرك',
  },
  todayCard: { viewStoreCheck: 'اعرض فحص المتجر' },
};

export function getYourStoreCopy(locale: SiteLocale): YourStoreCopy {
  return locale === 'ar' ? ar : en;
}
