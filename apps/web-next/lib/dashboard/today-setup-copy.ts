/* Copy for the v16 Today while setting up (04-dashboard.md, the
   Today-Setup board). The board's strings are drafts the owner still has
   to review, listed in the pull request. The Arabic is simple Modern
   Standard Arabic in neutral forms (the board's feminine "المتسوقة" is a
   sample shopper), with counts that agree and Western digits. Strings the
   dashboard already shows elsewhere (Try it yourself and Go live on Try-On
   Set up, Open theme editor on Store Chat Set up) read the same here. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface TodaySetupCopy {
  title: (store: string) => string;
  stepsLeft: (steps: number, minutes: number) => string;
  done: string;
  connected: string;
  theme: string;
  ready: string;
  chatEmbed: string;
  tryOnBlock: string;
  openThemeEditor: string;
  addButton: string;
  checkAgain: string;
  addButtonHint: string;
  chatPlugin: string;
  chatCode: string;
  tryOnCode: string;
  addButtonHintPaste: string;
  choosePosition: string;
  storeSetup: string;
  addButtonHintWoo: string;
  tryIt: string;
  tryItBody: string;
  testFree: string;
  openStore: string;
  goLive: string;
  goLiveBody: string;
  onlyYou: string;
  halfTest: string;
  stuck: string;
  book: string;
  failed: string;
}

const en: TodaySetupCopy = {
  title: (store) => `Get ${store} live`,
  stepsLeft: (steps, minutes) => `${steps === 1 ? '1 step' : `${steps} steps`} left, about ${minutes} minutes`,
  done: 'Done',
  connected: 'Store connected',
  theme: 'Turn GrindCTRL on in your theme',
  ready: 'Ready',
  chatEmbed: 'Store Chat app embed (GRINDCTRL Store Chat)',
  tryOnBlock: 'Try it on button on product pages (GrindCTRL Try-On block)',
  openThemeEditor: 'Open theme editor',
  addButton: 'Add the button to product pages',
  checkAgain: 'Check again',
  addButtonHint: 'Save the button in your theme editor. Open a product page with the preview link below, then check again. Shoppers see the button after you go live.',
  chatPlugin: 'Store Chat (GRINDCTRL plugin for WordPress)',
  chatCode: 'Store Chat code',
  tryOnCode: 'Try it on button on product pages',
  addButtonHintPaste: 'Choose the button position in Try-On setup. Open a product page with your preview link, then check again. Shoppers will see the button after you go live.',
  choosePosition: 'Choose button position',
  storeSetup: 'Open Store setup',
  addButtonHintWoo: 'Opens the WordPress Site Editor. Place the Try-On button on your product page and save. Classic themes use the Customizer instead.',
  tryIt: 'Try it yourself on your store',
  tryItBody: 'Try on a piece and ask a question, like a shopper would.',
  testFree: 'Test looks are free.',
  openStore: 'Open my store',
  goLive: 'Go live',
  goLiveBody: 'For everyone, or for half your visitors so you can measure the difference.',
  onlyYou: 'Only you see GrindCTRL on your store until you go live.',
  halfTest: '50/50 test',
  stuck: 'Stuck on a step?',
  book: 'Book 15 minutes with us',
  failed: 'That didn’t work. Try again in a minute.',
};

const arSteps = (n: number) =>
  arCount(n, { one: 'تبقّت خطوة واحدة', two: 'تبقّت خطوتان', few: (m) => `تبقّت ${m} خطوات`, many: (m) => `تبقّت ${m} خطوة` });
const arMinutes = (n: number) =>
  arCount(n, { one: 'دقيقة', two: 'دقيقتين', few: (m) => `${m} دقائق`, many: (m) => `${m} دقيقة` });

const ar: TodaySetupCopy = {
  title: (store) => `جهّز ${store} للإطلاق`,
  stepsLeft: (steps, minutes) => `${arSteps(steps)}، نحو ${arMinutes(minutes)}`,
  done: 'تم',
  connected: 'المتجر متصل',
  theme: 'فعّل GrindCTRL في قالبك',
  ready: 'جاهز',
  chatEmbed: 'تضمين دردشة المتجر («GRINDCTRL Store Chat»)',
  tryOnBlock: 'زر التجربة في صفحات المنتجات (قسم «GrindCTRL Try-On»)',
  openThemeEditor: 'افتح محرر القالب',
  addButton: 'أضف الزر إلى صفحات المنتجات',
  checkAgain: 'تحقق مرة أخرى',
  addButtonHint: 'احفظ الزر في محرر القالب. افتح صفحة منتج برابط المعاينة أدناه ثم تحقق مجددًا. سيرى المتسوقون الزر بعد الإطلاق.',
  chatPlugin: 'دردشة المتجر (إضافة GRINDCTRL لووردبريس)',
  chatCode: 'كود دردشة المتجر',
  tryOnCode: 'زر التجربة في صفحات المنتجات',
  addButtonHintPaste: 'اختر موضع الزر في إعدادات التجربة الافتراضية. افتح صفحة منتج برابط المعاينة ثم تحقق مجددًا. سيرى المتسوقون الزر بعد الإطلاق.',
  choosePosition: 'اختر موضع الزر',
  storeSetup: 'افتح إعداد المتجر',
  addButtonHintWoo: 'يفتح محرر الموقع في ووردبريس. ضع زر التجربة في صفحة المنتج ثم احفظ. القوالب الكلاسيكية تستخدم أداة التخصيص بدلاً من ذلك.',
  tryIt: 'جرّب بنفسك في متجرك',
  tryItBody: 'جرّب قطعة واطرح سؤالاً، كما يفعل المتسوق.',
  testFree: 'إطلالات الاختبار مجانية.',
  openStore: 'افتح متجري',
  goLive: 'أطلقه للمتسوقين',
  goLiveBody: 'للجميع، أو لنصف زوارك حتى تقيس الفرق.',
  onlyYou: 'لن يرى أحد غيرك GrindCTRL في متجرك حتى تطلقه للمتسوقين.',
  halfTest: 'اختبار 50/50',
  stuck: 'هل تعثرت في خطوة؟',
  book: 'احجز 15 دقيقة معنا',
  failed: 'لم ينجح ذلك. حاول مجدداً بعد دقيقة.',
};

export function getTodaySetupCopy(locale: SiteLocale): TodaySetupCopy {
  return locale === 'ar' ? ar : en;
}
