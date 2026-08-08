/* Copy for the try-on settings form and the Shopify embedded admin.

   One form backs two surfaces (the GrindCTRL dashboard and the Shopify
   admin), so this dictionary translates both at once. Merchant-facing, not
   shopper-facing: the language here follows the person configuring the
   widget, which Shopify supplies as ?locale on the embedded app URL.

   Theme preset names (Warm Cream, Ocean Blue) are deliberately absent. They
   are product names for a palette, and translating them makes them harder
   to talk about across a bilingual team, not easier. */

import type { TryOnLocale } from './i18n';

export interface SettingsFormCopy {
  theme: string;
  custom: string;
  buttonLabel: string;
  buttonLabelAr: string;
  catalogLabel: string;
  catalogLabelAr: string;
  reuseOtherLanguage: string;
  buttonColor: string;
  textColor: string;
  iconGradientStart: string;
  iconGradientEnd: string;
  gradientPresets: string;
  gradientUseMyColour: string;
  gradientBaseColour: string;
  gradientIntensity: string;
  gradientAdvanced: string;
  buttonIconSize: string;
  catalogIconSize: string;
  catalogLabelSize: string;
  catalogPillPadding: string;
  cornerRadius: string;
  panelBackground: string;
  light: string;
  dark: string;
  widgetThemeHint: string;
  loadingAnimation: string;
  loadingSteps_: string;
  loadingPulse: string;
  loadingBar: string;
  resultButtons: string;
  resultButtonsHint: string;
  /** Glued to a slider value: `18px`. Not a standalone word. */
  pxSuffix: string;
  addToCart: string;
  downloadPreview: string;
  requestWhatsapp: string;
  tryAnotherPhoto: string;
  disclaimer: string;
  disclaimerPlaceholder: string;
  disclaimerAr: string;
  disclaimerArPlaceholder: string;
  loadingStepsLabel: string;
  // Live preview
  previewHeading: string;
  previewTabButton: string;
  previewTabCatalog: string;
  previewTabUpload: string;
  previewTabGenerating: string;
  previewTabResults: string;
  previewCaptionProduct: string;
  previewCaptionButtonExpanded: string;
  previewCaptionButtonCollapsed: string;
  previewCaptionCatalog: string;
  previewCaptionCatalogHint: string;
  previewCaptionUpload: string;
  previewCaptionGenerating: string;
  previewCaptionResults: string;
  /* Two flat strings rather than one with the theme interpolated: Arabic
     agrees the adjective with the noun (لوحة is feminine), so a shared
     sentence would need a gender table to stay correct. */
  previewShopperViewLight: string;
  previewShopperViewDark: string;
  /* Chrome inside the preview mock. The merchant is the reader here, not the
     shopper — but a merchant reading Arabic should not find English inside the
     thing that shows them their own settings. */
  previewProductPhoto: string;
  previewResultPhoto: string;
  previewYourStore: string;
  previewStoreAutoNote: string;
  previewUploadPrompt: string;
  previewGenerateCta: string;
  previewProductImage: string;
  previewCloseDialog: string;
  /* Shown only when the merchant has written no loading steps of their own, so
     these are what an Arabic SHOPPER reads by default, not the merchant. */
  previewLoadingReading: string;
  previewLoadingFitting: string;
  previewLoadingRendering: string;
  // Shopify embedded admin chrome
  productPages: string;
  catalogPages: string;
  appearance: string;
  saved: string;
  saveFailed: string;
  save: string;
  saving: string;
}

const en: SettingsFormCopy = {
  theme: 'Theme',
  custom: 'Custom',
  buttonLabel: 'Button label',
  buttonLabelAr: 'Button label (Arabic)',
  catalogLabel: 'Catalog pill label',
  catalogLabelAr: 'Catalog pill label (Arabic)',
  reuseOtherLanguage: 'Leave empty to reuse the other language',
  buttonColor: 'Button color',
  textColor: 'Text color',
  iconGradientStart: 'Icon gradient start',
  iconGradientEnd: 'Icon gradient end',
  gradientPresets: 'Icon gradient',
  gradientUseMyColour: 'Use my colour',
  gradientBaseColour: 'Brand colour',
  gradientIntensity: 'Gradient strength',
  gradientAdvanced: 'Advanced: pick both colours',
  buttonIconSize: 'Button icon size',
  catalogIconSize: 'Catalog icon size',
  catalogLabelSize: 'Catalog label size',
  catalogPillPadding: 'Catalog pill padding',
  cornerRadius: 'Corner radius (px)',
  panelBackground: 'Try-on panel background',
  light: 'Light',
  dark: 'Dark',
  /* Deliberately says neither "above" nor "beside": the preview sits above the
     controls in a narrow container and beside them in a wide one. */
  widgetThemeHint:
    'The surface behind the try-on journey, on product pages and in the catalog dialog. The preview reflects it.',
  loadingAnimation: 'Loading animation',
  loadingSteps_: 'Checklist steps',
  loadingPulse: 'Product photo pulse',
  loadingBar: 'Progress bar',
  resultButtons: 'Result screen buttons',
  resultButtonsHint: 'What shoppers can do after seeing themselves in the product.',
  pxSuffix: 'px',
  addToCart: 'Add to cart',
  downloadPreview: 'Download preview',
  requestWhatsapp: 'Request order / WhatsApp',
  tryAnotherPhoto: 'Try with a different photo',
  disclaimer: 'Disclaimer under the result (empty = default)',
  disclaimerPlaceholder: 'This preview is visual guidance only...',
  disclaimerAr: 'Disclaimer (Arabic)',
  disclaimerArPlaceholder: 'Leave both empty to use the built-in translated line',
  loadingStepsLabel: 'Loading steps (one per line, empty = default)',
  previewHeading: 'Live preview',
  previewTabButton: 'Button',
  previewTabCatalog: 'Catalog',
  previewTabUpload: 'Upload',
  previewTabGenerating: 'Generating',
  previewTabResults: 'Results',
  previewCaptionProduct: 'The product being viewed',
  previewCaptionButtonExpanded:
    'This is the journey shoppers get on the product page. Click the button again to collapse.',
  previewCaptionButtonCollapsed: 'Click the button to see the journey shoppers get.',
  previewCaptionCatalog: 'The catalog dialog runs the same journey, from the same settings.',
  previewCaptionCatalogHint: 'Click a Try on pill to open the catalog dialog.',
  previewCaptionUpload: 'The upload step shoppers see after opening the widget.',
  previewCaptionGenerating: 'What shoppers see while their look renders.',
  previewCaptionResults: 'The result screen, with only the buttons enabled below.',
  previewShopperViewLight: 'Shopper view, light panel',
  previewShopperViewDark: 'Shopper view, dark panel',
  previewProductPhoto: 'Product photo',
  previewResultPhoto: 'Result photo',
  previewYourStore: 'Your store',
  previewStoreAutoNote: 'Image and name come from your store automatically.',
  previewUploadPrompt: 'Upload your photo',
  previewGenerateCta: 'Generate my look',
  previewProductImage: 'Product image',
  previewCloseDialog: 'Close preview dialog',
  previewLoadingReading: 'Reading your photo',
  previewLoadingFitting: 'Fitting the garment',
  previewLoadingRendering: 'Rendering your look',
  productPages: 'Product pages',
  catalogPages: 'Catalog pages',
  appearance: 'Appearance',
  saved: 'Saved, live within a minute.',
  saveFailed: 'Could not save. Try again.',
  save: 'Save',
  saving: 'Saving...',
};

const ar: SettingsFormCopy = {
  theme: 'النمط',
  custom: 'مخصص',
  buttonLabel: 'نص الزر',
  buttonLabelAr: 'نص الزر (بالعربية)',
  catalogLabel: 'نص زر الكتالوج',
  catalogLabelAr: 'نص زر الكتالوج (بالعربية)',
  reuseOtherLanguage: 'اتركه فارغًا لاستخدام اللغة الأخرى',
  buttonColor: 'لون الزر',
  textColor: 'لون النص',
  iconGradientStart: 'بداية تدرّج الأيقونة',
  iconGradientEnd: 'نهاية تدرّج الأيقونة',
  gradientPresets: 'تدرّج الأيقونة',
  gradientUseMyColour: 'استخدم لوني',
  gradientBaseColour: 'لون العلامة',
  gradientIntensity: 'قوة التدرّج',
  gradientAdvanced: 'خيارات متقدمة: اختر اللونين',
  buttonIconSize: 'حجم أيقونة الزر',
  catalogIconSize: 'حجم أيقونة الكتالوج',
  catalogLabelSize: 'حجم نص الكتالوج',
  catalogPillPadding: 'حشو زر الكتالوج',
  cornerRadius: 'استدارة الحواف (بكسل)',
  panelBackground: 'خلفية لوحة التجربة',
  light: 'فاتح',
  dark: 'داكن',
  widgetThemeHint:
    'الخلفية التي تظهر خلف تجربة القياس، في صفحات المنتجات وفي نافذة الكتالوج. المعاينة تعكسها.',
  loadingAnimation: 'حركة التحميل',
  loadingSteps_: 'خطوات متسلسلة',
  loadingPulse: 'نبض صورة المنتج',
  loadingBar: 'شريط تقدم',
  resultButtons: 'أزرار شاشة النتيجة',
  resultButtonsHint: 'ما يمكن للمتسوقين فعله بعد رؤية أنفسهم بالمنتج.',
  /* A whole word, not an abbreviation, so it carries its own space. */
  pxSuffix: ' بكسل',
  addToCart: 'أضف إلى السلة',
  downloadPreview: 'تنزيل المعاينة',
  requestWhatsapp: 'طلب عبر واتساب',
  tryAnotherPhoto: 'جرّب بصورة أخرى',
  disclaimer: 'تنويه أسفل النتيجة (فارغ = الافتراضي)',
  disclaimerPlaceholder: 'هذه المعاينة إرشادية بصريًا فقط...',
  disclaimerAr: 'التنويه (بالعربية)',
  disclaimerArPlaceholder: 'اترك الحقلين فارغين لاستخدام النص المترجم المدمج',
  loadingStepsLabel: 'خطوات التحميل (سطر لكل خطوة، فارغ = الافتراضي)',
  previewHeading: 'معاينة مباشرة',
  previewTabButton: 'الزر',
  previewTabCatalog: 'الكتالوج',
  previewTabUpload: 'الرفع',
  previewTabGenerating: 'الإنشاء',
  previewTabResults: 'النتيجة',
  previewCaptionProduct: 'المنتج المعروض',
  previewCaptionButtonExpanded:
    'هذه هي الرحلة التي يمر بها المتسوقون في صفحة المنتج. اضغط الزر مرة أخرى لطيّها.',
  previewCaptionButtonCollapsed: 'اضغط الزر لمشاهدة الرحلة التي يمر بها المتسوقون.',
  previewCaptionCatalog: 'نافذة الكتالوج تعرض نفس الرحلة، بنفس الإعدادات.',
  previewCaptionCatalogHint: 'اضغط على زر «جرّب» لفتح نافذة الكتالوج.',
  previewCaptionUpload: 'خطوة رفع الصورة كما يراها المتسوقون بعد فتح الأداة.',
  previewCaptionGenerating: 'ما يراه المتسوقون أثناء إنشاء نتيجتهم.',
  previewCaptionResults: 'شاشة النتيجة، مع الأزرار المفعّلة فقط أدناه.',
  previewShopperViewLight: 'عرض المتسوق، لوحة فاتحة',
  previewShopperViewDark: 'عرض المتسوق، لوحة داكنة',
  previewProductPhoto: 'صورة المنتج',
  previewResultPhoto: 'صورة النتيجة',
  previewYourStore: 'متجرك',
  previewStoreAutoNote: 'الصورة والاسم يأتيان من متجرك تلقائيًا.',
  previewUploadPrompt: 'ارفع صورتك',
  previewGenerateCta: 'أنشئ إطلالتي',
  previewProductImage: 'صورة المنتج',
  previewCloseDialog: 'إغلاق نافذة المعاينة',
  previewLoadingReading: 'نقرأ صورتك',
  previewLoadingFitting: 'نضبط مقاس القطعة',
  previewLoadingRendering: 'نُجهّز إطلالتك',
  productPages: 'صفحات المنتجات',
  catalogPages: 'صفحات الكتالوج',
  appearance: 'المظهر',
  saved: 'تم الحفظ، سيظهر خلال دقيقة.',
  saveFailed: 'تعذّر الحفظ. حاول مرة أخرى.',
  save: 'حفظ',
  saving: 'جارٍ الحفظ...',
};

export function getSettingsFormCopy(locale: TryOnLocale): SettingsFormCopy {
  return locale === 'ar' ? ar : en;
}
