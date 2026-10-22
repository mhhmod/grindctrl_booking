/* Copy for the v16 Try-On Set up tab (04-dashboard.md, the TryOnStudio
   board). The board's strings are drafts; the pull request lists the ones
   written here. The Arabic is simple Modern Standard Arabic in neutral
   forms, with Western digits; the actions on the look are named as nouns,
   since the merchant switches them, not the shopper. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface TryOnStudioCopy {
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
