/* ─── Try-On Agent — Lightweight i18n (en / ar) ─── */

import type { TryOnProduct } from './types';

export const TRYON_LOCALES = ['en', 'ar'] as const;
export type TryOnLocale = (typeof TRYON_LOCALES)[number];

/* Deliberately the same cookie the landing and pricing pages use
   (SITE_LOCALE_COOKIE in lib/landing/landing-i18n.ts). It used to be
   'tryon-locale', which meant picking Arabic on the landing page and then
   opening the demo dropped you back to English. Both surfaces speak the same
   two locales, so they share one preference. */
export const TRYON_LOCALE_COOKIE = 'gc-locale';
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
  preparingSession: string;
  storefrontProofErrorTitle: string;
  storefrontProofError: string;
  refreshTryOn: string;

  noProductTitle: string;
  noProductDescription: string;

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
  resultPreviewAlt: (product: string) => string;
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

  /* Public /try-on page, site v15 (copy/tryon.json). */
  pageTag: string;
  pageStepsLabel: string;
  pageStepPiece: string;
  pageStepPhoto: string;
  pageStepCreate: string;
  pageStepLook: string;
  pageDemoStore: string;
  pageTitle: string;
  pageSubtitle: string;
  pageForStores: string;
  pageNeedPhoto: string;
  pageCreateLook: string;
  pageTryAnother: string;
  pageCompareLooks: string;
  pageDownload: string;
  pageContinueShopping: string;
  pageStoreAria: string;
  pageSampleNote: string;
  pageClose: string;
  pageTrace: string[];
  pageChange: string;
  pageChangePiece: string;
  pageDemoPiece: string;
  pageAddPhoto: string;
  pageUploadRules: string;
  pageOr: string;
  pageUseSample: string;
  pageSampleModel: string;
  pageSamplePhoto: string;
  pageCompareWithPhoto: string;
  pageViewPhoto: string;
  pageViewLook: string;
  pageLookEmpty: string;
  pageSampleCaption: string;
  pageLooksTitle: string;
  pageLooksCount: (count: string) => string;
  pageStoreTitle: string;
  pageStoreBadge: string;
  pageOpenStore: string;
  pagePickerNote: string;
  pageCompareTitle: string;
  pageErrType: string;
  pagePricing: string;
  pageFooterNav: string;
  pageCopyright: string;
  pageCopyrightShort: string;
  pagePasswordLabel: string;
  pagePasswordCopy: string;
  pagePasswordCopied: string;
  pagePasswordSelected: string;
  pagePasswordCopyAria: string;
  pagePasswordCopiedAria: string;
  pagePieces: Record<'abaya' | 'linen' | 'denim' | 'polo', { name: string; kind: string }>;
  product: Record<string, ProductCopy>;
}

const en: TryOnDict = {
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  brandHome: 'GrindCTRL home',
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
  preparingSession: 'Preparing secure try-on…',
  storefrontProofErrorTitle: 'Try-on needs to be refreshed',
  storefrontProofError:
    'We could not verify this product session. Refresh try-on and try again.',
  refreshTryOn: 'Refresh try-on',

  noProductTitle: 'No product selected',
  noProductDescription: 'Open try-on from a product page to preview that item.',

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
  resultPreviewAlt: (product) => `Try-on preview of ${product}`,
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

  pageTag: 'Try-On',
  pageStepsLabel: 'Steps',
  pageStepPiece: 'The piece',
  pageStepPhoto: 'Your photo',
  pageStepCreate: 'Create',
  pageStepLook: 'Your look',
  pageDemoStore: 'Demo store',
  pageTitle: 'See it on you before you buy.',
  pageSubtitle: 'Pick a piece, add a photo, get your look.',
  pageForStores: 'For stores: book a call',
  pageNeedPhoto: 'Add a photo to create your look.',
  pageCreateLook: 'Create my look',
  pageTryAnother: 'Try another piece',
  pageCompareLooks: 'Compare looks',
  pageDownload: 'Download',
  pageContinueShopping: 'Continue shopping',
  pageStoreAria: 'The demo store',
  pageSampleNote: 'Sample looks are real try-on engine outputs on AI-generated models.',
  pageClose: 'Close',
  pageTrace: ['photo received', 'garment mapped', 'look rendered', 'ready to shop'],
  pageChange: 'Change',
  pageChangePiece: 'Change piece',
  pageDemoPiece: 'Demo piece',
  pageAddPhoto: 'Add your photo',
  pageUploadRules: 'Full or half body. JPG, PNG or WebP, up to 8 MB.',
  pageOr: 'or',
  pageUseSample: 'Use a sample photo',
  pageSampleModel: 'An AI-generated model',
  pageSamplePhoto: 'Sample photo',
  pageCompareWithPhoto: 'Compare with your photo',
  pageViewPhoto: 'Photo',
  pageViewLook: 'Look',
  pageLookEmpty: 'Your look appears here',
  pageSampleCaption:
    'A sample look made by the try-on engine. The preview is visual guidance, not an exact sizing guarantee.',
  pageLooksTitle: 'Your looks',
  pageLooksCount: (count) => `${count} of 4`,
  pageStoreTitle: 'The same try-on, inside a real store.',
  pageStoreBadge: 'Try it on with AI on every product',
  pageOpenStore: 'Open the demo store',
  pagePickerNote: 'Demo pieces with sample looks. Your photo stays as it is.',
  pageCompareTitle: 'Your looks side by side',
  pageErrType: 'Unsupported file type. Please upload a JPG, PNG or WebP image.',
  pagePricing: 'Pricing',
  pageFooterNav: 'Footer',
  pageCopyright: '© 2026 GrindCTRL. AI commerce experiences for Shopify fashion stores.',
  pageCopyrightShort: '© 2026 GrindCTRL',
  pagePasswordLabel: 'Store password',
  pagePasswordCopy: 'Copy',
  pagePasswordCopied: 'Copied',
  pagePasswordSelected: 'Selected, press Ctrl+C',
  pagePasswordCopyAria: 'Copy the store password',
  pagePasswordCopiedAria: 'Store password copied',
  pagePieces: {
    abaya: { name: 'Embroidered abaya', kind: 'Womenswear' },
    linen: { name: 'Sage linen shirt', kind: 'Womenswear' },
    denim: { name: 'Denim overshirt', kind: 'Menswear' },
    polo: { name: 'Knit polo', kind: 'Menswear' },
  },
  product: {},
};

const ar: TryOnDict = {
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  brandHome: 'الصفحة الرئيسية لـ GrindCTRL',
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
  preparingSession: 'جارٍ تجهيز تجربة آمنة…',
  storefrontProofErrorTitle: 'تحتاج تجربة المنتج إلى تحديث',
  storefrontProofError:
    'تعذّر التحقق من جلسة هذا المنتج. حدّث تجربة المنتج ثم حاول مرة أخرى.',
  refreshTryOn: 'تحديث تجربة المنتج',

  noProductTitle: 'لم يتم تحديد منتج',
  noProductDescription: 'افتح ميزة التجربة من صفحة منتج لمعاينة هذا المنتج.',

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
  resultPreviewAlt: (product) => `معاينة تجربة ${product}`,
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

  pageTag: 'التجربة الافتراضية',
  pageStepsLabel: 'الخطوات',
  pageStepPiece: 'القطعة',
  pageStepPhoto: 'صورتك',
  pageStepCreate: 'الإنشاء',
  pageStepLook: 'إطلالتك',
  pageDemoStore: 'المتجر التجريبي',
  pageTitle: 'شاهدها عليك قبل الشراء.',
  pageSubtitle: 'اختر قطعة، وأضف صورة، واحصل على إطلالتك.',
  pageForStores: 'للمتاجر: احجز مكالمة',
  pageNeedPhoto: 'أضف صورة لإنشاء إطلالتك.',
  pageCreateLook: 'اصنع إطلالتي',
  pageTryAnother: 'جرّب قطعة أخرى',
  pageCompareLooks: 'قارن الإطلالات',
  pageDownload: 'تنزيل',
  pageContinueShopping: 'تابع التسوّق',
  pageStoreAria: 'المتجر التجريبي',
  pageSampleNote: 'الإطلالات النموذجية مخرجات حقيقية لمحرك التجربة على عارضين مولَّدين بالذكاء الاصطناعي.',
  pageClose: 'إغلاق',
  pageTrace: ['تم استلام الصورة', 'تمت مطابقة القطعة', 'اكتملت الإطلالة', 'جاهز للشراء'],
  pageChange: 'تغيير',
  pageChangePiece: 'تغيير القطعة',
  pageDemoPiece: 'قطعة تجريبية',
  pageAddPhoto: 'أضف صورتك',
  pageUploadRules: 'صورة كاملة أو نصفية. JPG أو PNG أو WebP، حتى 8 ميجابايت.',
  pageOr: 'أو',
  pageUseSample: 'استخدم صورة نموذجية',
  pageSampleModel: 'عارض مولَّد بالذكاء الاصطناعي',
  pageSamplePhoto: 'صورة نموذجية',
  pageCompareWithPhoto: 'قارن بصورتك',
  pageViewPhoto: 'الصورة',
  pageViewLook: 'الإطلالة',
  pageLookEmpty: 'ستظهر إطلالتك هنا',
  pageSampleCaption: 'إطلالة نموذجية أنشأها محرك التجربة. المعاينة إرشاد بصري وليست ضمانًا دقيقًا للمقاس.',
  pageLooksTitle: 'إطلالاتك',
  pageLooksCount: (count) => `${count} من 4`,
  pageStoreTitle: 'التجربة نفسها، داخل متجر حقيقي.',
  pageStoreBadge: 'زر جرّبها بالذكاء الاصطناعي على كل منتج',
  pageOpenStore: 'افتح المتجر التجريبي',
  pagePickerNote: 'قطع تجريبية بإطلالات نموذجية. تبقى صورتك كما هي.',
  pageCompareTitle: 'إطلالاتك جنبًا إلى جنب',
  pageErrType: 'نوع الملف غير مدعوم. يرجى رفع صورة JPG أو PNG أو WebP.',
  pagePricing: 'الأسعار',
  pageFooterNav: 'تذييل الصفحة',
  pageCopyright: '© 2026 GrindCTRL. تجارب تسوّق بالذكاء الاصطناعي لمتاجر الأزياء على Shopify.',
  pageCopyrightShort: '© 2026 GrindCTRL',
  pagePasswordLabel: 'كلمة مرور المتجر',
  pagePasswordCopy: 'نسخ',
  pagePasswordCopied: 'تم النسخ',
  pagePasswordSelected: 'تم التحديد، اضغط Ctrl+C',
  pagePasswordCopyAria: 'انسخ كلمة مرور المتجر',
  pagePasswordCopiedAria: 'تم نسخ كلمة مرور المتجر',
  pagePieces: {
    abaya: { name: 'عباية مطرّزة', kind: 'ملابس نسائية' },
    linen: { name: 'قميص كتان بلون المريمية', kind: 'ملابس نسائية' },
    denim: { name: 'قميص جينز خارجي', kind: 'ملابس رجالية' },
    polo: { name: 'قميص بولو محبوك', kind: 'ملابس رجالية' },
  },
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
