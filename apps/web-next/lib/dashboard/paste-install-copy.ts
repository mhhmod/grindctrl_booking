import type { PasteErrorCode, PasteStep } from '@/lib/paste/types';

export type InstallPlatform = 'shopify' | 'woocommerce' | 'website';

export type PasteInstallCopy = {
  title: string;
  intro: string;
  platformLegend: string;
  platforms: Record<InstallPlatform, { name: string; body: string }>;
  steps: { address: string; code: string; paste: string; live: string };
  shopifyLabel: string;
  shopifyPlaceholder: string;
  shopifyHint: string;
  shopifyContinue: string;
  domainLabel: string;
  domainPlaceholder: string;
  domainHint: string;
  shopifyDomainHint: string;
  addDomain: string;
  removeDomain: (domain: string) => string;
  domainState: { live: (ago: string) => string; waiting: string; proof: string };
  proofTitle: string;
  proofMeta: string;
  proofDns: string;
  proofDnsName: string;
  proofDnsValue: string;
  check: string;
  codeLocked: string;
  copyCode: string;
  copied: string;
  pasteSteps: (step: PasteStep) => string;
  openThemeEditor: string;
  openStore: string;
  waiting: string;
  waitingHint: string;
  chatLive: (domain: string) => string;
  tryOnLive: string;
  tryOnReason: (reason: string | null) => string;
  goTryOnSetup: string;
  doneForYou: string;
  doneForYouAction: string;
  resetTitle: string;
  resetBody: string;
  resetAction: string;
  resetConfirm: string;
  resetDone: (time: string) => string;
  cancel: string;
  errors: Record<PasteErrorCode, string>;
};

const en: PasteInstallCopy = {
  title: 'Install on your store',
  intro: 'One block of code adds Store Chat and Try-On. No app to install.',
  platformLegend: 'Where is your store?',
  platforms: {
    shopify: { name: 'Shopify', body: 'Paste one block in your theme.' },
    woocommerce: { name: 'WooCommerce', body: 'Install our plugin.' },
    website: { name: 'Any other website', body: 'EasyOrders, a custom site or any platform that accepts code.' },
  },
  steps: { address: 'Your store address', code: 'Copy your code', paste: 'Paste it in your store', live: 'Check it’s live' },
  shopifyLabel: 'Shopify address',
  shopifyPlaceholder: 'your-store.myshopify.com',
  shopifyHint: 'Find it in Shopify under Settings, then Domains.',
  shopifyContinue: 'Continue',
  domainLabel: 'Store address',
  domainPlaceholder: 'yourstore.com',
  domainHint: 'Your code only works on the addresses you add here. Add up to 5.',
  shopifyDomainHint: 'Add the address shoppers visit, like yourstore.com. Skip this if your store only uses its .myshopify.com address.',
  addDomain: 'Add',
  removeDomain: (domain) => `Remove ${domain}`,
  domainState: { live: (ago) => `Live, seen ${ago}`, waiting: 'Waiting for your code', proof: 'Needs proof' },
  proofTitle: 'Another account already uses this address. Show it is yours with either option, then check.',
  proofMeta: 'Add this tag inside your site’s <head>:',
  proofDns: 'Or add this DNS record:',
  proofDnsName: 'Name',
  proofDnsValue: 'Value',
  check: 'Check',
  codeLocked: 'Add your store address first. Your code appears here.',
  copyCode: 'Copy code',
  copied: 'Copied',
  pasteSteps: (step) => {
    switch (step.kind) {
      case 'open': return step.target === 'shopify_theme_editor' ? 'Open your theme editor.' : 'Open your site’s theme or HTML code.';
      case 'select': return step.target === 'footer' ? 'In the Footer, select Add section.' : 'Choose Custom Liquid.';
      case 'paste': return step.target === 'custom_liquid' ? 'Paste your code into the Custom Liquid box.' : 'Paste your code just before </body>.';
      case 'save': return 'Save.';
      case 'visit': return step.target === 'product_page' ? 'Open any product page on your store.' : 'Open your store.';
    }
  },
  openThemeEditor: 'Open theme editor',
  openStore: 'Open my store',
  waiting: 'Waiting for your store',
  waitingHint: 'Open a page on your store. This updates by itself.',
  chatLive: (domain) => `Your code is working on ${domain}.`,
  tryOnLive: 'Try-On shows on your product pages.',
  tryOnReason: (reason) => {
    switch (reason) {
      case 'preview': return 'Try-On is in preview, so only you see it.';
      case 'out_of_looks': return 'Try-On is paused: this month’s looks are used up.';
      case 'no_trusted_domain': return 'Add your store address to turn on Try-On.';
      case 'paste_not_connected': return 'Finish the steps above to turn on Try-On.';
      default: return 'Try-On is getting ready. We are on it.';
    }
  },
  goTryOnSetup: 'Try-On settings',
  doneForYou: 'Rather we do it? We install it for you, free.',
  doneForYouAction: 'Ask us to install it',
  resetTitle: 'Reset your code',
  resetBody: 'Use this if someone else saw your code. The old code stops working 15 minutes after you reset.',
  resetAction: 'Reset code',
  resetConfirm: 'Yes, reset',
  resetDone: (time) => `New code ready. Paste it before ${time}.`,
  cancel: 'Cancel',
  errors: {
    forbidden: 'Only the store owner can change this.',
    unavailable: 'This is not available right now. Try again in a minute.',
    schema_not_ready: 'Installing by code is almost ready. Check back soon.',
    rate_limited: 'Too many tries. Wait a moment, then try again.',
    invalid_domain: 'Enter an address like yourstore.com.',
    limit_reached: 'You can add up to 5 addresses. Remove one first.',
    not_found: 'That address is no longer on this store.',
    proof_required: 'Show this address is yours to use it here.',
    proof_failed: 'We could not find the tag or record yet. It can take a few minutes.',
    invalid_platform: 'Enter your address ending in .myshopify.com.',
    connection_conflict: 'This store is already connected another way.',
  },
};

const ar: PasteInstallCopy = {
  title: 'التثبيت على متجرك',
  intro: 'كود واحد يضيف دردشة المتجر والتجربة الافتراضية، بدون تطبيق.',
  platformLegend: 'أين متجرك؟',
  platforms: {
    shopify: { name: 'Shopify', body: 'الصق كوداً واحداً في القالب.' },
    woocommerce: { name: 'WooCommerce', body: 'ثبّت الإضافة الخاصة بنا.' },
    website: { name: 'أي موقع آخر', body: 'EasyOrders أو موقع مخصص أو أي منصة تقبل إضافة كود.' },
  },
  steps: { address: 'عنوان متجرك', code: 'انسخ الكود', paste: 'الصقه في متجرك', live: 'تأكد أنه يعمل' },
  shopifyLabel: 'عنوان Shopify',
  shopifyPlaceholder: 'your-store.myshopify.com',
  shopifyHint: 'تجده في Shopify من الإعدادات ثم النطاقات.',
  shopifyContinue: 'متابعة',
  domainLabel: 'عنوان المتجر',
  domainPlaceholder: 'yourstore.com',
  domainHint: 'يعمل الكود فقط على العناوين التي تضيفها هنا، حتى 5 عناوين.',
  shopifyDomainHint: 'أضف العنوان الذي يزوره المتسوقون، مثل yourstore.com. تخطَّ هذه الخطوة إذا كان متجرك يستخدم عنوان ‎.myshopify.com فقط.',
  addDomain: 'إضافة',
  removeDomain: (domain) => `إزالة ${domain}`,
  domainState: { live: (ago) => `يعمل، آخر ظهور ${ago}`, waiting: 'بانتظار الكود', proof: 'يحتاج إثباتاً' },
  proofTitle: 'هذا العنوان مستخدم في حساب آخر. أثبت أنه لك بإحدى الطريقتين ثم اضغط تحقق.',
  proofMeta: 'أضف هذا الوسم داخل <head> في موقعك:',
  proofDns: 'أو أضف سجل DNS هذا:',
  proofDnsName: 'الاسم',
  proofDnsValue: 'القيمة',
  check: 'تحقق',
  codeLocked: 'أضف عنوان متجرك أولاً، وسيظهر الكود هنا.',
  copyCode: 'انسخ الكود',
  copied: 'تم النسخ',
  pasteSteps: (step) => {
    switch (step.kind) {
      case 'open': return step.target === 'shopify_theme_editor' ? 'افتح محرر القالب.' : 'افتح كود القالب أو HTML في موقعك.';
      case 'select': return step.target === 'footer' ? 'في التذييل، اختر إضافة قسم.' : 'اختر Custom Liquid.';
      case 'paste': return step.target === 'custom_liquid' ? 'الصق الكود في مربع Custom Liquid.' : 'الصق الكود قبل </body> مباشرة.';
      case 'save': return 'احفظ.';
      case 'visit': return step.target === 'product_page' ? 'افتح أي صفحة منتج في متجرك.' : 'افتح متجرك.';
    }
  },
  openThemeEditor: 'افتح محرر القالب',
  openStore: 'افتح متجري',
  waiting: 'بانتظار متجرك',
  waitingHint: 'افتح أي صفحة في متجرك، وستتحدث هذه الحالة تلقائياً.',
  chatLive: (domain) => `الكود يعمل على ${domain}.`,
  tryOnLive: 'التجربة الافتراضية تظهر في صفحات منتجاتك.',
  tryOnReason: (reason) => {
    switch (reason) {
      case 'preview': return 'التجربة الافتراضية في وضع المعاينة، لذا تظهر لك وحدك.';
      case 'out_of_looks': return 'التجربة الافتراضية متوقفة: نفدت إطلالات هذا الشهر.';
      case 'no_trusted_domain': return 'أضف عنوان متجرك لتشغيل التجربة الافتراضية.';
      case 'paste_not_connected': return 'أكمل الخطوات أعلاه لتشغيل التجربة الافتراضية.';
      default: return 'نجهّز التجربة الافتراضية، ونعمل على ذلك.';
    }
  },
  goTryOnSetup: 'إعدادات التجربة الافتراضية',
  doneForYou: 'تفضّل أن نتولى ذلك؟ نثبّته لك مجاناً.',
  doneForYouAction: 'اطلب منا التثبيت',
  resetTitle: 'إعادة تعيين الكود',
  resetBody: 'استخدمها إذا اطّلع أحد على الكود. يتوقف الكود القديم بعد 15 دقيقة من إعادة التعيين.',
  resetAction: 'إعادة تعيين الكود',
  resetConfirm: 'نعم، أعد التعيين',
  resetDone: (time) => `الكود الجديد جاهز. الصقه قبل ${time}.`,
  cancel: 'إلغاء',
  errors: {
    forbidden: 'صاحب المتجر وحده يستطيع تغيير هذا.',
    unavailable: 'هذا غير متاح الآن. حاول بعد دقيقة.',
    schema_not_ready: 'التثبيت بالكود أوشك على الجاهزية. عُد قريباً.',
    rate_limited: 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.',
    invalid_domain: 'اكتب عنواناً مثل yourstore.com.',
    limit_reached: 'يمكنك إضافة 5 عناوين كحد أقصى. أزل عنواناً أولاً.',
    not_found: 'هذا العنوان لم يعد ضمن هذا المتجر.',
    proof_required: 'أثبت أن هذا العنوان لك لتستخدمه هنا.',
    proof_failed: 'لم نجد الوسم أو السجل بعد. قد يستغرق ذلك بضع دقائق.',
    invalid_platform: 'اكتب عنوانك المنتهي بـ ‎.myshopify.com.',
    connection_conflict: 'هذا المتجر متصل بطريقة أخرى بالفعل.',
  },
};

export function pasteInstallCopy(locale: string): PasteInstallCopy {
  return locale === 'ar' ? ar : en;
}
