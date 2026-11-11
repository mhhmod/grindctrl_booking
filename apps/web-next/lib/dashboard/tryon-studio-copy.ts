/* Copy for the v16 Try-On Set up tab (04-dashboard.md, the TryOnStudio
   board). The board's strings are drafts; the pull request lists the ones
   written here. The Arabic is simple Modern Standard Arabic in neutral
   forms, with Western digits; the actions on the look are named as nouns,
   since the merchant switches them, not the shopper. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface TryOnStudioCopy {
  storefrontSwitch: {
    on: string;
    off: string;
    state: Record<'on' | 'off' | 'not_installed', string>;
    reason: Record<'preview' | 'holdout' | 'out_of_looks' | 'plan_inactive' | 'unavailable', string>;
    install: string;
    unavailable: string;
    failed: string;
    pill: string;
    pillBody: string;
    pillNeedsButton: string;
    pillUnavailable: string;
    pillCodeOutdated: string;
    pillGetCode: string;
  };
  subtitle: string;
  unsavedLabel: string;
  unsaved: (n: number) => string;
  discard: string;
  save: string;
  saving: string;
  saved: string;
  button: string;
  buttonBody: string;
  colours: string;
  coloursBody: string;
  buttonColour: string;
  textColour: string;
  corners: string;
  cornersBody: string;
  lessRound: string;
  moreRound: string;
  /** The corners' value: "12 px", or fully round. */
  cornerValue: (px: number) => string;
  labels: string;
  productButton: string;
  cardPill: string;
  cardPillBody: string;
  english: string;
  arabic: string;
  /** "9 of 40". */
  count: (used: number, max: number) => string;
  reuseOther: string;
  englishNeeded: string;
  position: string;
  positionBody: string;
  moveInThemeEditor: string;
  positionBodyWoo: string;
  moveInSiteEditor: string;
  moveInCustomizer: string;
  panel: string;
  panelBody: string;
  background: string;
  panelBackground: string;
  light: string;
  dark: string;
  loadingAnimation: string;
  loadingAnimationBody: string;
  animations: Record<'steps' | 'pulse' | 'bar', string>;
  loadingSteps: string;
  loadingStepsBody: string;
  step: (n: number) => string;
  onTheLook: string;
  onTheLookBody: string;
  actions: Record<'showAddToCart' | 'showDownload' | 'showWhatsapp' | 'showTryAgain', { label: string; body: string }>;
  note: string;
  noteBody: string;
  privacy: string;
  privacyBody: string;
  promiseTitle: string;
  promiseBody: string;
  seeWhatTheySee: string;
  preview: string;
  couldNotLoad: string;
}

const en: TryOnStudioCopy = {
  storefrontSwitch: {
    on: 'Try-On is on',
    off: 'Try-On is off',
    state: {
      on: 'Shoppers see the Try it on button on your product pages.',
      off: 'Shoppers don’t see the Try it on button. Turn it on whenever you’re ready.',
      not_installed: 'Not on your store yet. Install it, then turn it on here.',
    },
    reason: {
      preview: 'In preview: only you see the button.',
      holdout: 'Shown to part of your shoppers while we measure the difference.',
      out_of_looks: 'Paused: this month’s looks are used up.',
      plan_inactive: 'Paused: your plan isn’t active.',
      unavailable: 'We couldn’t check Try-On right now. Try again in a minute.',
    },
    install: 'Install on your store',
    unavailable: 'This switch is almost ready. Try again soon.',
    failed: 'That didn’t save. Try again.',
    pill: 'Try on pill on collection cards',
    pillBody: 'A small Try on pill on each product card in your collections, search and home page.',
    pillNeedsButton: 'Turn Try-On on to show the pills.',
    pillUnavailable: 'The pill switch is almost ready. Try again soon.',
    pillCodeOutdated: 'Your store still has the older code, so pills can’t show yet. Paste your updated code over the old one.',
    pillGetCode: 'Get my updated code',
  },
  subtitle: 'Every change shows in the preview first. When you save, shoppers see it within a minute.',
  unsavedLabel: 'Unsaved changes',
  unsaved: (n) => (n === 1 ? '1 unsaved change' : `${n} unsaved changes`),
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved, live within a minute.',
  button: 'Button',
  buttonBody: 'The Try it on button on your product pages and the pill on your collection cards.',
  colours: 'Colours',
  coloursBody: 'Used by the button and the pill.',
  buttonColour: 'Button colour',
  textColour: 'Text colour',
  corners: 'Corners',
  cornersBody: 'Rounds the button and the pill.',
  lessRound: 'Less round',
  moreRound: 'More round',
  cornerValue: (px) => (px >= 999 ? 'Fully round' : `${px} px`),
  labels: 'Labels',
  productButton: 'Product page button',
  cardPill: 'Product card pill',
  cardPillBody: 'Shown on product cards in your collections.',
  english: 'English',
  arabic: 'العربية',
  count: (used, max) => `${used} of ${max}`,
  reuseOther: 'Leave one empty to reuse the other language.',
  englishNeeded: 'Write this one in English.',
  position: 'Position',
  positionBody: 'The button is the GrindCTRL Try-On block in your product page template. Its place is set in your theme editor.',
  moveInThemeEditor: 'Move it in the theme editor',
  positionBodyWoo: 'Choose where the button sits on your product page in WordPress. Block themes use the Site Editor; other themes use the Customizer.',
  moveInSiteEditor: 'Open the Site Editor',
  moveInCustomizer: 'Open the Customizer',
  panel: 'Try-on panel',
  panelBody: 'The panel that opens when a shopper taps Try it on.',
  background: 'Background',
  panelBackground: 'Panel background',
  light: 'Light',
  dark: 'Dark',
  loadingAnimation: 'Loading animation',
  loadingAnimationBody: 'What shoppers see while their look is made.',
  animations: { steps: 'Checklist steps', pulse: 'Photo pulse', bar: 'Progress bar' },
  loadingSteps: 'Loading steps',
  loadingStepsBody: 'Shown one after another while the look is made. Leave them empty to use the standard steps.',
  step: (n) => `Step ${n}`,
  onTheLook: 'On the look',
  onTheLookBody: 'What shoppers can do after they see themselves in the piece.',
  actions: {
    showAddToCart: { label: 'Add to cart', body: 'Adds the piece in the size they picked.' },
    showDownload: { label: 'Save photo', body: 'Saves the look to the shopper’s phone.' },
    showWhatsapp: { label: 'Send on WhatsApp', body: 'Opens WhatsApp with a short message about the piece. The shopper picks who gets it.' },
    showTryAgain: { label: 'Try with a different photo', body: 'Starts again with a new photo.' },
  },
  note: 'Note under each look',
  noteBody: 'Up to 300 characters. Leave both empty to use the standard note.',
  privacy: 'Privacy',
  privacyBody: 'Shoppers try on more when they trust what happens to their photo.',
  promiseTitle: 'Photos are deleted after each look',
  promiseBody:
    'Each photo goes to our try-on service, makes one look, then is deleted. Shoppers can keep their photo and looks on their own phone for 24 hours. You only see a look a shopper sends you.',
  seeWhatTheySee: 'See what they see',
  preview: 'Preview',
  couldNotLoad: "Your Try-On settings couldn't load just now. Refresh in a minute.",
};

const ar: TryOnStudioCopy = {
  storefrontSwitch: {
    on: 'التجربة الافتراضية مفعّلة',
    off: 'التجربة الافتراضية متوقفة',
    state: {
      on: 'يرى المتسوقون زر التجربة في صفحات منتجاتك.',
      off: 'لا يرى المتسوقون زر التجربة. فعّلها متى كنت جاهزاً.',
      not_installed: 'غير مثبّتة في متجرك بعد. ثبّتها ثم فعّلها من هنا.',
    },
    reason: {
      preview: 'في وضع المعاينة: يظهر الزر لك وحدك.',
      holdout: 'تظهر لجزء من المتسوقين بينما نقيس الفرق.',
      out_of_looks: 'متوقفة: نفدت إطلالات هذا الشهر.',
      plan_inactive: 'متوقفة: خطتك غير مفعّلة.',
      unavailable: 'تعذّر التحقق من التجربة الافتراضية الآن. حاول بعد دقيقة.',
    },
    install: 'ثبّت على متجرك',
    unavailable: 'هذا المفتاح أوشك على الجاهزية. حاول قريباً.',
    failed: 'لم يُحفظ ذلك. حاول مجدداً.',
    pill: 'زر التجربة على بطاقات المنتجات',
    pillBody: 'زر صغير للتجربة على كل بطاقة منتج في المجموعات والبحث والصفحة الرئيسية.',
    pillNeedsButton: 'فعّل التجربة الافتراضية لإظهار الأزرار.',
    pillUnavailable: 'مفتاح البطاقات أوشك على الجاهزية. حاول قريباً.',
    pillCodeOutdated: 'متجرك ما زال يعمل بالكود القديم، لذا لن تظهر الأزرار بعد. الصق الكود المحدّث مكان القديم.',
    pillGetCode: 'احصل على الكود المحدّث',
  },
  subtitle: 'يظهر كل تغيير في المعاينة أولاً. وعند الحفظ، يراه المتسوقون خلال دقيقة.',
  unsavedLabel: 'تغييرات غير محفوظة',
  unsaved: (n) =>
    arCount(n, {
      one: 'تغيير واحد غير محفوظ',
      two: 'تغييران غير محفوظين',
      few: (k) => `${k} تغييرات غير محفوظة`,
      many: (k) => `${k} تغييراً غير محفوظ`,
    }),
  discard: 'تجاهل',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  saved: 'تم الحفظ، ويظهر في متجرك خلال دقيقة.',
  button: 'الزر',
  buttonBody: 'زر التجربة في صفحات منتجاتك، وزر البطاقة على بطاقات المنتجات في مجموعاتك.',
  colours: 'الألوان',
  coloursBody: 'يُستخدم في الزر وزر البطاقة.',
  buttonColour: 'لون الزر',
  textColour: 'لون النص',
  corners: 'الحواف',
  cornersBody: 'يحدد استدارة الزر وزر البطاقة.',
  lessRound: 'استدارة أقل',
  moreRound: 'استدارة أكثر',
  cornerValue: (px) => (px >= 999 ? 'دائرية بالكامل' : `${px} px`),
  labels: 'النصوص',
  productButton: 'زر صفحة المنتج',
  cardPill: 'زر بطاقة المنتج',
  cardPillBody: 'يظهر على بطاقات المنتجات في مجموعاتك.',
  english: 'الإنجليزية',
  arabic: 'العربية',
  count: (used, max) => `${used} من ${max}`,
  reuseOther: 'اترك أحدهما فارغاً لاستخدام نص اللغة الأخرى.',
  englishNeeded: 'اكتب هذا النص بالإنجليزية.',
  position: 'الموضع',
  positionBody: 'الزر هو قسم «GrindCTRL Try-On» في قالب صفحة المنتج. يُحدَّد موضعه في محرر القالب.',
  moveInThemeEditor: 'انقله في محرر القالب',
  positionBodyWoo: 'اختر موضع الزر في صفحة المنتج داخل ووردبريس. القوالب القائمة على الكتل تستخدم محرر الموقع، وغيرها يستخدم أداة التخصيص.',
  moveInSiteEditor: 'افتح محرر الموقع',
  moveInCustomizer: 'افتح أداة التخصيص',
  panel: 'لوحة التجربة',
  panelBody: 'اللوحة التي تُفتح عندما يضغط المتسوق على زر التجربة.',
  background: 'الخلفية',
  panelBackground: 'خلفية اللوحة',
  light: 'فاتح',
  dark: 'داكن',
  loadingAnimation: 'حركة التحميل',
  loadingAnimationBody: 'ما يراه المتسوقون أثناء إنشاء إطلالتهم.',
  animations: { steps: 'قائمة خطوات', pulse: 'نبض الصورة', bar: 'شريط التقدم' },
  loadingSteps: 'خطوات التحميل',
  loadingStepsBody: 'تظهر واحدة تلو الأخرى أثناء إنشاء الإطلالة. اتركها فارغة لاستخدام الخطوات القياسية.',
  step: (n) => `الخطوة ${n}`,
  onTheLook: 'على الإطلالة',
  onTheLookBody: 'ما يمكن للمتسوقين فعله بعد أن يروا أنفسهم بالقطعة.',
  actions: {
    showAddToCart: { label: 'الإضافة إلى السلة', body: 'يضيف القطعة بالمقاس الذي اختاره المتسوق.' },
    showDownload: { label: 'حفظ الصورة', body: 'يحفظ الإطلالة على هاتف المتسوق.' },
    showWhatsapp: { label: 'الإرسال على واتساب', body: 'يفتح واتساب برسالة قصيرة عن القطعة، والمتسوق يختار من يرسلها إليه.' },
    showTryAgain: { label: 'التجربة بصورة مختلفة', body: 'يبدأ من جديد بصورة جديدة.' },
  },
  note: 'الملاحظة أسفل كل إطلالة',
  noteBody: 'حتى 300 حرف. اتركهما فارغين لاستخدام الملاحظة القياسية.',
  privacy: 'الخصوصية',
  privacyBody: 'يجرب المتسوقون أكثر عندما يثقون بما يحدث لصورهم.',
  promiseTitle: 'الصور تُحذف بعد كل إطلالة',
  promiseBody:
    'تُرسل كل صورة إلى خدمة التجربة لدينا لصنع إطلالة واحدة، ثم تُحذف. يمكن للمتسوقين الاحتفاظ بصورهم وإطلالاتهم على هواتفهم لمدة 24 ساعة. ولا ترى إلا الإطلالة التي يرسلها إليك متسوق.',
  seeWhatTheySee: 'شاهد ما يرونه',
  preview: 'معاينة',
  couldNotLoad: 'تعذّر تحميل إعدادات التجربة الافتراضية الآن. حدّث الصفحة بعد دقيقة.',
};

export function getTryOnStudioCopy(locale: SiteLocale): TryOnStudioCopy {
  return locale === 'ar' ? ar : en;
}

/* Button placement on Set up (Pack B, B1 and B2), word for word from the
   Pick a spot handoff. Store check's B7.4 row lives in your-store-copy.ts. */
export interface PlacementCopy {
  notSaved: string;
  section: string;
  auto: string;
  recommended: string;
  autoSub: string;
  spot: string;
  spotSub: string;
  pick: string;
  /** The saved spot: "Below "Add to cart"". */
  saved: (position: 'before' | 'after', label: string) => string;
  change: string;
  reset: string;
  floating: string;
  floatingSub: string;
  advanced: string;
  selector: string;
  above: string;
  below: string;
  test: string;
  opening: string;
  finish: string;
  failed: string;
  /** No confirmed store address to open yet (pasted code not confirmed, no verified domain). */
  noAddress: string;
  noAddressAction: string;
}

const placementEn: PlacementCopy = {
  notSaved: "We didn't see a spot saved. Your previous placement stays. Pick a spot to try again.",
  section: 'Button placement',
  auto: 'Next to your Buy button',
  recommended: 'Recommended',
  autoSub: 'We find your Add to cart or Buy now button.',
  spot: 'Pick a spot on my store',
  spotSub: 'Tap the exact place on your product page.',
  pick: 'Pick a spot',
  saved: (position, label) => `${position === 'before' ? 'Above' : 'Below'} "${label}"`,
  change: 'Change',
  reset: 'Reset to automatic',
  floating: 'Floating button',
  floatingSub: 'A small button at the bottom corner of product pages.',
  advanced: 'Advanced (for developers)',
  selector: 'CSS selector',
  above: 'Above',
  below: 'Below',
  test: 'Test on my store',
  opening: 'Opening your store…',
  finish: 'Finish in the new tab',
  failed: "Couldn't save. Check your connection and try again.",
  noAddress: 'We don’t have a confirmed address for your store yet. Finish connecting it, then pick a spot.',
  noAddressAction: 'Go to Store setup',
};

const placementAr: PlacementCopy = {
  notSaved: 'لم نرَ مكانًا محفوظًا. يبقى مكان الزر السابق. اختر مكانًا للمحاولة مجددًا.',
  section: 'مكان الزر',
  auto: 'بجوار زر الشراء',
  recommended: 'مستحسن',
  autoSub: 'نجد زر «أضف للسلة» أو «اشترِ الآن» تلقائيًا.',
  spot: 'اختر مكانًا في متجري',
  spotSub: 'اضغط على المكان الذي تريده في صفحة المنتج.',
  pick: 'اختر المكان',
  saved: (position, label) => `${position === 'before' ? 'فوق' : 'تحت'} «${label}»`,
  change: 'تغيير',
  reset: 'العودة للتلقائي',
  floating: 'زر عائم',
  floatingSub: 'زر صغير في زاوية صفحة المنتج السفلية.',
  advanced: 'متقدم (للمطورين)',
  selector: 'محدد CSS',
  above: 'فوق',
  below: 'تحت',
  test: 'جرّبه على متجري',
  opening: 'جارٍ فتح متجرك…',
  finish: 'أكمل في الصفحة الجديدة',
  failed: 'تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.',
  noAddress: 'لا يوجد لدينا عنوان مؤكد لمتجرك بعد. أكمل ربط المتجر ثم اختر المكان.',
  noAddressAction: 'اذهب إلى إعداد المتجر',
};

export function getPlacementCopy(locale: SiteLocale): PlacementCopy {
  return locale === 'ar' ? placementAr : placementEn;
}
