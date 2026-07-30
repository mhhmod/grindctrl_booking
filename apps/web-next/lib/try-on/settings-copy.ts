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
  cornerRadius: string;
  panelBackground: string;
  light: string;
  dark: string;
  loadingAnimation: string;
  loadingSteps_: string;
  loadingPulse: string;
  loadingBar: string;
  resultButtons: string;
  addToCart: string;
  downloadPreview: string;
  requestWhatsapp: string;
  tryAnotherPhoto: string;
  disclaimer: string;
  disclaimerPlaceholder: string;
  disclaimerAr: string;
  disclaimerArPlaceholder: string;
  loadingStepsLabel: string;
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
  cornerRadius: 'Corner radius (px)',
  panelBackground: 'Try-on panel background',
  light: 'Light',
  dark: 'Dark',
  loadingAnimation: 'Loading animation',
  loadingSteps_: 'Checklist steps',
  loadingPulse: 'Product photo pulse',
  loadingBar: 'Progress bar',
  resultButtons: 'Result screen buttons',
  addToCart: 'Add to cart',
  downloadPreview: 'Download preview',
  requestWhatsapp: 'Request order / WhatsApp',
  tryAnotherPhoto: 'Try with a different photo',
  disclaimer: 'Disclaimer under the result (empty = default)',
  disclaimerPlaceholder: 'This preview is visual guidance only...',
  disclaimerAr: 'Disclaimer (Arabic)',
  disclaimerArPlaceholder: 'Leave both empty to use the built-in translated line',
  loadingStepsLabel: 'Loading steps (one per line, empty = default)',
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
  cornerRadius: 'استدارة الحواف (بكسل)',
  panelBackground: 'خلفية لوحة التجربة',
  light: 'فاتح',
  dark: 'داكن',
  loadingAnimation: 'حركة التحميل',
  loadingSteps_: 'خطوات متسلسلة',
  loadingPulse: 'نبض صورة المنتج',
  loadingBar: 'شريط تقدم',
  resultButtons: 'أزرار شاشة النتيجة',
  addToCart: 'أضف إلى السلة',
  downloadPreview: 'تنزيل المعاينة',
  requestWhatsapp: 'طلب عبر واتساب',
  tryAnotherPhoto: 'جرّب بصورة أخرى',
  disclaimer: 'تنويه أسفل النتيجة (فارغ = الافتراضي)',
  disclaimerPlaceholder: 'هذه المعاينة إرشادية بصريًا فقط...',
  disclaimerAr: 'التنويه (بالعربية)',
  disclaimerArPlaceholder: 'اترك الحقلين فارغين لاستخدام النص المترجم المدمج',
  loadingStepsLabel: 'خطوات التحميل (سطر لكل خطوة، فارغ = الافتراضي)',
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
