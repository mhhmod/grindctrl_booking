/* ─── Try-On Agent — Lightweight i18n (en / ar) ─── */

import type { TryOnProduct } from './types';

export const TRYON_LOCALES = ['en', 'ar'] as const;
export type TryOnLocale = (typeof TRYON_LOCALES)[number];

export const TRYON_LOCALE_COOKIE = 'tryon-locale';
export const DEFAULT_TRYON_LOCALE: TryOnLocale = 'en';

export function isTryOnLocale(value: unknown): value is TryOnLocale {
  return typeof value === 'string' && (TRYON_LOCALES as readonly string[]).includes(value);
}

export function getDir(locale: TryOnLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Localized product overrides. English falls back to the catalog data. */
type ProductCopy = Pick<TryOnProduct, 'name' | 'category' | 'details'>;

interface TryOnDict {
  langToggleLabel: string;
  langSwitchTo: string;

  brandHome: string;
  home: string;

  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;

  footerTagline: string;
  footerHome: string;
  footerSignUp: string;

  loadingSteps: string[];

  uploadTitle: string;
  uploadSubtitle: (product: string) => string;

  consentTitle: string;
  consentSubtitle: string;
  photoReady: string;
  changePhoto: string;
  privacyLabel: string;
  privacyText: string;
  noteLabel: string;
  noteText: string;
  generateBtn: string;

  generatingTitle: string;

  errorTitle: string;
  tryAgain: string;
  genericError: string;

  photoLabel: string;
  uploadAria: string;
  removePhoto: string;
  dropTitle: string;
  dropHint: (maxMb: number) => string;
  errUnsupported: (allowed: string) => string;
  errTooLarge: (maxMb: number) => string;

  demoBadge: string;
  previewLabel: string;
  download: string;
  whatsapp: string;
  whatsappMsg: (product: string) => string;
  trial: string;
  addToCart: string;
  addedToCart: string;
  addToCartRetry: string;
  disclaimerMock: string;
  disclaimerLive: string;
  colorsVary: string;
  tryDifferent: string;

  product: Record<string, ProductCopy>;
}

const en: TryOnDict = {
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  brandHome: 'GRINDCTRL home',
  home: 'Home',

  heroBadge: 'AI Visual Sales',
  heroTitle: 'See it on you before you buy',
  heroSubtitle:
    'Upload your photo and instantly preview how a product looks on you. Less guessing, more confidence before checkout.',

  footerTagline: 'AI implementation and automation platform.',
  footerHome: 'Home',
  footerSignUp: 'Sign up',

  loadingSteps: [
    'Preparing your preview…',
    'Analyzing photo composition…',
    'Mapping product to your photo…',
    'Rendering try-on preview…',
    'Finalizing result…',
  ],

  uploadTitle: 'Upload your photo',
  uploadSubtitle: (product) =>
    `Upload a full or half-body photo to preview how the ${product} looks on you.`,

  consentTitle: 'Ready to generate your preview',
  consentSubtitle: 'Review the details below and tap generate when ready.',
  photoReady: 'Your photo is ready',
  changePhoto: 'Change photo',
  privacyLabel: 'Privacy:',
  privacyText:
    'Your photo is used only to create this try-on preview. It is not stored permanently or shared publicly.',
  noteLabel: 'Note:',
  noteText: 'The preview is visual guidance, not an exact sizing guarantee.',
  generateBtn: 'Generate Try-On Preview',

  generatingTitle: 'Creating your preview',

  errorTitle: 'Something went wrong',
  tryAgain: 'Try again',
  genericError: 'Something went wrong.',

  photoLabel: 'Your photo',
  uploadAria: 'Upload your photo',
  removePhoto: 'Remove photo',
  dropTitle: 'Drag and drop your photo here',
  dropHint: (maxMb) => `or click to browse · JPG, PNG, WebP · Max ${maxMb} MB`,
  errUnsupported: (allowed) =>
    `Unsupported file type. Please upload an image file (${allowed}).`,
  errTooLarge: (maxMb) => `File is too large. Maximum size is ${maxMb} MB.`,

  demoBadge: 'Demo Preview',
  previewLabel: 'Try-On Preview',
  download: 'Download preview',
  whatsapp: 'Request order / WhatsApp',
  whatsappMsg: (product) => `I'd like to order the ${product}! Here's my try-on preview.`,
  trial: 'Start business trial',
  addToCart: 'Add to cart',
  addedToCart: 'Adding…',
  addToCartRetry: 'Could not add, try again',
  disclaimerMock:
    'This is a demo preview using a placeholder image, no real AI generation was performed. ',
  disclaimerLive:
    'This preview is visual guidance only and is not an exact sizing guarantee. ',
  colorsVary: 'Colors may vary slightly from the actual product.',
  tryDifferent: 'Try with a different photo',

  product: {},
};

const ar: TryOnDict = {
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  brandHome: 'الصفحة الرئيسية GRINDCTRL',
  home: 'الرئيسية',

  heroBadge: 'مبيعات بصرية بالذكاء الاصطناعي',
  heroTitle: 'شاهده عليك قبل الشراء',
  heroSubtitle:
    'ارفع صورتك وشاهد فورًا كيف يبدو المنتج عليك. تخمين أقل وثقة أكبر قبل إتمام الشراء.',

  footerTagline: 'منصة تطبيق الذكاء الاصطناعي والأتمتة.',
  footerHome: 'الرئيسية',
  footerSignUp: 'إنشاء حساب',

  loadingSteps: [
    'جارٍ تجهيز المعاينة…',
    'تحليل تكوين الصورة…',
    'مطابقة المنتج مع صورتك…',
    'إنشاء معاينة التجربة…',
    'إنهاء النتيجة…',
  ],

  uploadTitle: 'ارفع صورتك',
  uploadSubtitle: (product) =>
    `ارفع صورة كاملة أو نصفية لمعاينة كيف يبدو ${product} عليك.`,

  consentTitle: 'جاهز لإنشاء معاينتك',
  consentSubtitle: 'راجع التفاصيل أدناه ثم اضغط على إنشاء عندما تكون جاهزًا.',
  photoReady: 'صورتك جاهزة',
  changePhoto: 'تغيير الصورة',
  privacyLabel: 'الخصوصية:',
  privacyText:
    'تُستخدم صورتك فقط لإنشاء هذه المعاينة. لا يتم تخزينها بشكل دائم أو مشاركتها علنًا.',
  noteLabel: 'ملاحظة:',
  noteText: 'المعاينة إرشاد بصري وليست ضمانًا دقيقًا للمقاس.',
  generateBtn: 'إنشاء معاينة التجربة',

  generatingTitle: 'جارٍ إنشاء معاينتك',

  errorTitle: 'حدث خطأ ما',
  tryAgain: 'حاول مرة أخرى',
  genericError: 'حدث خطأ ما.',

  photoLabel: 'صورتك',
  uploadAria: 'ارفع صورتك',
  removePhoto: 'إزالة الصورة',
  dropTitle: 'اسحب صورتك وأفلتها هنا',
  dropHint: (maxMb) => `أو اضغط للتصفح · JPG، PNG، WebP · بحد أقصى ${maxMb} ميجابايت`,
  errUnsupported: (allowed) =>
    `نوع الملف غير مدعوم. يرجى رفع ملف صورة (${allowed}).`,
  errTooLarge: (maxMb) => `حجم الملف كبير جدًا. الحد الأقصى ${maxMb} ميجابايت.`,

  demoBadge: 'معاينة تجريبية',
  previewLabel: 'معاينة التجربة',
  download: 'تنزيل المعاينة',
  whatsapp: 'اطلب الآن / واتساب',
  whatsappMsg: (product) => `أرغب في طلب ${product}! إليك معاينة التجربة الخاصة بي.`,
  trial: 'ابدأ النسخة التجريبية للأعمال',
  addToCart: 'أضِف إلى السلة',
  addedToCart: 'جارٍ الإضافة…',
  addToCartRetry: 'تعذّرت الإضافة، حاول مجددًا',
  disclaimerMock:
    'هذه معاينة تجريبية تستخدم صورة بديلة، ولم يتم إجراء أي توليد فعلي بالذكاء الاصطناعي. ',
  disclaimerLive:
    'هذه المعاينة إرشاد بصري فقط وليست ضمانًا دقيقًا للمقاس. ',
  colorsVary: 'قد تختلف الألوان قليلًا عن المنتج الفعلي.',
  tryDifferent: 'جرّب بصورة مختلفة',

  product: {
    'premium-ringer-tee': {
      name: 'تيشيرت رينجر بريميوم',
      category: 'تيشيرت',
      details: [
        'جسم بلون كريمي / أبيض مائل',
        'ياقة مضلّعة بلون بني شوكولاتة داكن',
        'أساور أكمام مضلّعة بلون بني شوكولاتة داكن',
        'شعار مطرّز صغير على الصدر الأيسر',
        'قَصّة رياضية / ضيقة فاخرة',
        'قطن جيرسيه ناعم وزن ثقيل',
      ],
    },
  },
};

export const TRYON_DICTIONARIES: Record<TryOnLocale, TryOnDict> = { en, ar };

export type TryOnTranslator = TryOnDict;

export function getDictionary(locale: TryOnLocale): TryOnDict {
  return TRYON_DICTIONARIES[locale] ?? en;
}

/** Returns localized product copy, falling back to the English catalog entry. */
export function localizeProduct(
  product: TryOnProduct,
  locale: TryOnLocale,
): TryOnProduct {
  const override = getDictionary(locale).product[product.id];
  if (!override) return product;
  return { ...product, ...override };
}
