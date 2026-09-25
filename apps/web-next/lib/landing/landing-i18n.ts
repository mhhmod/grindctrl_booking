/* GrindCTRL landing: lightweight i18n for English and Arabic. */

export const SITE_LOCALES = ['en', 'ar'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const SITE_LOCALE_COOKIE = 'gc-locale';
export const DEFAULT_SITE_LOCALE: SiteLocale = 'en';

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === 'string' && (SITE_LOCALES as readonly string[]).includes(value);
}

export function getDir(locale: SiteLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

interface LandingDict {
  brandHome: string;
  langToggleLabel: string;
  langSwitchTo: string;

  navPricing: string;
  signIn: string;
  bookCall: string;
  menu: string;
  closeMenu: string;

  heroBadge: string;
  heroTitle: string;






  /* Render receipt card (replaces the old AiVisionFigure in #proof). */

  testimonials: { quote: string; name: string; role: string; photo: string }[];

  integrationStateImplemented: string;
  integrationStateSetupRequired: string;
  integrationStateEvidenceRequired: string;
  integrationStatePlanned: string;
  integrationStateInfrastructure: string;


  ctaTitle: string;
  ctaBody: string;

  /* Site v15 chrome: header, phone menu and footer (copy/landing.json). */
  siteMainNav: string;
  siteOpenMenu: string;
  navTryOn: string;
  navLiveStore: string;
  navAiOps: string;
  navProduct: string;
  navResults: string;
  navHowItWorks: string;
  menuTheProduct: string;
  menuAskStore: string;
  footerNav: string;
  footerProduct: string;
  footerLiveStore: string;
  footerTryOnPage: string;
  footerCopyright: string;
  footerCopyrightShort: string;
  passwordLabel: string;
  passwordCopy: string;
  passwordCopied: string;
  passwordSelected: string;
  passwordCopyAria: string;
  passwordCopiedAria: string;

  footerHome: string;
  footerDemo: string;
  footerPricing: string;
  footerRoi: string;
  footerSecurity: string;
  analyticsTitle: string;
  analyticsDescription: string;
  analyticsChoiceLabel: string;
  analyticsAllow: string;
  analyticsDeny: string;
  analyticsStatusLabel: string;
  analyticsStatusUnknown: string;
  analyticsStatusGranted: string;
  analyticsStatusDenied: string;
}

const en: LandingDict = {
  brandHome: 'GrindCTRL home',
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  navPricing: 'Pricing',
  signIn: 'Sign in',
  bookCall: 'Book a call',
  menu: 'Menu',
  closeMenu: 'Close menu',

  heroBadge: 'AI commerce for online stores',
  heroTitle: 'Turn every shopper signal into the next useful action.',







  testimonials: [],

  integrationStateImplemented: 'Implemented',
  integrationStateSetupRequired: 'Setup required',
  integrationStateEvidenceRequired: 'Evidence required',
  integrationStatePlanned: 'Planned',
  integrationStateInfrastructure: 'Infrastructure',


  ctaTitle: 'Give shoppers a reason to feel sure before checkout.',
  ctaBody:
    'Book a call and we will map the try-on experience to your Shopify theme, catalog, and customer journey.',

  siteMainNav: 'Main',
  siteOpenMenu: 'Open menu',
  navTryOn: 'Try it on',
  navLiveStore: 'Live store',
  navAiOps: 'AI operations',
  navProduct: 'Product',
  navResults: 'Results',
  navHowItWorks: 'How it works',
  menuTheProduct: 'The product',
  menuAskStore: 'Ask the store',
  footerNav: 'Footer',
  footerProduct: 'Product',
  footerLiveStore: 'Live store',
  footerTryOnPage: 'Try-on page',
  footerCopyright: '© 2026 GrindCTRL. AI commerce experiences for Shopify fashion stores.',
  footerCopyrightShort: '© 2026 GrindCTRL',
  passwordLabel: 'Store password',
  passwordCopy: 'Copy',
  passwordCopied: 'Copied',
  passwordSelected: 'Selected, press Ctrl+C',
  passwordCopyAria: 'Copy the store password',
  passwordCopiedAria: 'Store password copied',
  footerHome: 'Home',
  footerDemo: 'Live demo',
  footerPricing: 'Pricing',
  footerRoi: 'ROI calculator',
  footerSecurity: 'Security',
  analyticsTitle: 'Analytics preferences',
  analyticsDescription: 'Optional analytics help us understand which pages and demos are useful. Nothing is collected until you allow it, and you can change your choice here.',
  analyticsChoiceLabel: 'Choose whether to allow optional analytics',
  analyticsAllow: 'Allow analytics',
  analyticsDeny: 'Deny analytics',
  analyticsStatusLabel: 'Current choice',
  analyticsStatusUnknown: 'Not chosen',
  analyticsStatusGranted: 'Allowed',
  analyticsStatusDenied: 'Denied',
};

const ar: LandingDict = {
  brandHome: 'الصفحة الرئيسية لـ GrindCTRL',
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  navPricing: 'الأسعار',
  signIn: 'تسجيل الدخول',
  bookCall: 'احجز مكالمة',
  menu: 'القائمة',
  closeMenu: 'إغلاق القائمة',

  heroBadge: 'تجارة ذكية للمتاجر الإلكترونية',
  heroTitle: 'حوّل كل إشارة من المتسوق إلى الخطوة المفيدة التالية.',




  /* Must stay identical to the names in components/pricing/pricing-copy.ts.
     This dictionary feeds the pricing section on the home page; that one feeds
     the /pricing page. Two Arabic names for one plan is worse than the English
     they replaced, so these are copied from there rather than reinvented. */



  testimonials: [],

  integrationStateImplemented: 'مطبق',
  integrationStateSetupRequired: 'يتطلب إعدادًا',
  integrationStateEvidenceRequired: 'يتطلب دليلاً',
  integrationStatePlanned: 'مخطط له',
  integrationStateInfrastructure: 'بنية تحتية',


  ctaTitle: 'امنح عملاءك سببًا للثقة قبل إتمام الشراء.',
  ctaBody:
    'احجز مكالمة وسنحدد كيف تتكامل تجربة الملابس مع قالب Shopify والكتالوج ورحلة عملائك.',

  siteMainNav: 'القائمة الرئيسية',
  siteOpenMenu: 'فتح القائمة',
  navTryOn: 'جرّبها عليك',
  navLiveStore: 'المتجر المباشر',
  navAiOps: 'عمليات الذكاء الاصطناعي',
  navProduct: 'المنتج',
  navResults: 'النتائج',
  navHowItWorks: 'كيف يعمل',
  menuTheProduct: 'المنتج',
  menuAskStore: 'اسأل المتجر',
  footerNav: 'تذييل الصفحة',
  footerProduct: 'المنتج',
  footerLiveStore: 'المتجر المباشر',
  footerTryOnPage: 'صفحة التجربة',
  footerCopyright: '© 2026 GrindCTRL. تجارب تسوّق بالذكاء الاصطناعي لمتاجر الأزياء على Shopify.',
  footerCopyrightShort: '© 2026 GrindCTRL',
  passwordLabel: 'كلمة مرور المتجر',
  passwordCopy: 'نسخ',
  passwordCopied: 'تم النسخ',
  passwordSelected: 'تم التحديد، اضغط Ctrl+C',
  passwordCopyAria: 'انسخ كلمة مرور المتجر',
  passwordCopiedAria: 'تم نسخ كلمة مرور المتجر',
  footerHome: 'الرئيسية',
  footerDemo: 'تجربة مباشرة',
  footerPricing: 'الأسعار',
  footerRoi: 'حاسبة العائد',
  footerSecurity: 'الأمان',
  analyticsTitle: 'تفضيلات التحليلات',
  analyticsDescription: 'تساعدنا التحليلات الاختيارية على فهم الصفحات والتجارب المفيدة. لن نجمع شيئًا حتى تسمح بذلك، ويمكنك تغيير اختيارك هنا.',
  analyticsChoiceLabel: 'اختر ما إذا كنت تسمح بالتحليلات الاختيارية',
  analyticsAllow: 'السماح بالتحليلات',
  analyticsDeny: 'رفض التحليلات',
  analyticsStatusLabel: 'الاختيار الحالي',
  analyticsStatusUnknown: 'لم يتم الاختيار',
  analyticsStatusGranted: 'مسموح',
  analyticsStatusDenied: 'مرفوض',
};

export const LANDING_DICTIONARIES: Record<SiteLocale, LandingDict> = { en, ar };
export type LandingTranslator = LandingDict;

export function getLandingDictionary(locale: SiteLocale): LandingDict {
  return LANDING_DICTIONARIES[locale] ?? en;
}
