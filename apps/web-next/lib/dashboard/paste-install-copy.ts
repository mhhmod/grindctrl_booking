import type { PasteDomainVerificationReason, PasteErrorCode, PasteShopCheckOutcome, PasteStep } from '@/lib/paste/types';

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
  domainState: { live: (ago: string) => string; waiting: string; proof: string; verified: string };
  domainReason: (reason: PasteDomainVerificationReason) => string;
  otherProof: string;
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
  installedTitle: (host: string) => string;
  chatShown: string;
  chatPreview: string;
  tryOnOn: (looks: number) => string;
  tryOnOff: string;
  codeOutdated: string;
  codeOutdatedAction: string;
  seeOnStore: string;
  showSteps: string;
  hideSteps: string;
  shopCheckTitle: string;
  shopCheck: (outcome: PasteShopCheckOutcome | 'rate_limited' | null, retryAfter: number | null) => string;
  checkStore: string;
  passwordLabel: string;
  passwordHint: string;
  appHeld: string;
  provenElsewhere: string;
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
  domainState: { live: (ago) => `Live, seen ${ago}`, waiting: 'Waiting for your code', proof: 'Needs proof', verified: 'Code found' },
  domainReason: (reason) => {
    switch (reason) {
      case 'awaiting_code': return 'We’ll confirm automatically once your code is live.';
      case 'code_not_found': return 'We couldn’t find your code on this address yet. Check it’s saved, then check again.';
      case 'wrong_site': return 'This address shows code from another account. Replace it with your code, then check again.';
      case 'unreachable': return 'We couldn’t open this address’s home page. If your site blocks automated visits, confirm it another way.';
      case 'held_elsewhere': return 'Another account uses this address. Paste your code and we’ll move it here once we find it.';
      case 'proven_elsewhere': return 'Another account confirmed this address. If it’s yours, paste your code, then check again.';
    }
  },
  otherProof: 'Other ways to confirm',
  proofTitle: 'Add either of these, then check.',
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
      case 'not_installed': return 'Turning on your free looks. This takes a moment.';
      case 'plan_inactive': return 'Your plan isn’t active. Choose a plan to turn on Try-On.';
      case 'unavailable': return 'Try-On is unavailable right now. We’re looking into it.';
      case 'shop_proof_pending': return 'Confirm it’s your store to turn on Try-On.';
      case 'domain_unverified': return 'Try-On turns on once we find your code on your store. We check by ourselves.';
      case 'shopify_app_installed': return 'This store uses the GRINDCTRL Shopify app, so Try-On runs from the app.';
      default: return 'Try-On is getting ready. We are on it.';
    }
  },
  goTryOnSetup: 'Try-On settings',
  installedTitle: (host) => `You’re installed on ${host}`,
  chatShown: 'Shoppers see Store Chat on every page.',
  chatPreview: 'Store Chat is in preview, so only you see it.',
  tryOnOn: (looks) => `Try-On is on your product pages. ${looks} looks left this month.`,
  tryOnOff: 'Try-On is switched off, so shoppers don’t see the button. Turn it on in Try-On settings.',
  codeOutdated: 'New: Try on pills on your collection pages. Copy your updated code and paste it over the old one to turn them on.',
  codeOutdatedAction: 'Get my updated code',
  seeOnStore: 'See it on your store',
  showSteps: 'Show the install steps',
  hideSteps: 'Hide the install steps',
  shopCheckTitle: 'Confirm it’s your store',
  shopCheck: (outcome, retryAfter) => {
    switch (outcome) {
      case 'awaiting_visit': return 'We found your code. Open any page on your store to finish.';
      case 'not_found': return 'We couldn’t find your code on your store yet. Check it’s saved in the theme, then try again.';
      case 'outdated_code': return 'Your store has an older copy of your code. Copy it again and replace it.';
      case 'wrong_site': return 'Your store shows code from another account. Replace it with your code, then check again.';
      case 'password_required': return 'Your store has a password page. Enter the storefront password so we can check it.';
      case 'password_rejected': return 'That password didn’t open your store. Find it in Shopify under Online Store, then Preferences.';
      case 'unreachable': return 'We couldn’t reach your store. Try again in a minute.';
      case 'rate_limited': return retryAfter ? `Too many checks. Try again in ${retryAfter} seconds.` : 'Too many checks. Try again shortly.';
      default: return 'After you paste and save your code, check your store. We confirm the code is on it before Try-On turns on.';
    }
  },
  checkStore: 'Check my store',
  passwordLabel: 'Storefront password',
  passwordHint: 'We use it once for this check and never keep it.',
  appHeld: 'This store uses the GRINDCTRL Shopify app. Manage Store Chat and Try-On from the app instead.',
  provenElsewhere: 'Another account confirmed this store first. If it’s yours, paste your code and check your store to move it here.',
  doneForYou: 'Rather we do it? We install it for you, free.',
  doneForYouAction: 'Ask us to install it',
  resetTitle: 'Reset your code',
  resetBody: 'Use this if someone else saw your code. The old code stops working 15 minutes after you reset.',
  resetAction: 'Reset code',
  resetConfirm: 'Yes, reset',
  resetDone: (time) => `New code ready. Paste it before ${time}.`,
  cancel: 'Cancel',
  errors: {
    invalid_request: 'Check the request details and try again.',
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
  domainState: { live: (ago) => `يعمل، آخر ظهور ${ago}`, waiting: 'بانتظار الكود', proof: 'يحتاج إثباتاً', verified: 'تم العثور على الكود' },
  domainReason: (reason) => {
    switch (reason) {
      case 'awaiting_code': return 'سنؤكد تلقائياً بمجرد أن يعمل الكود في متجرك.';
      case 'code_not_found': return 'لم نجد الكود على هذا العنوان بعد. تأكد من حفظه ثم تحقق مجدداً.';
      case 'wrong_site': return 'يظهر على هذا العنوان كود من حساب آخر. استبدله بالكود الخاص بك ثم تحقق مجدداً.';
      case 'unreachable': return 'لم نتمكن من فتح الصفحة الرئيسية لهذا العنوان. إذا كان موقعك يحجب الزيارات الآلية، أكّده بطريقة أخرى.';
      case 'held_elsewhere': return 'هذا العنوان مستخدم في حساب آخر. الصق الكود الخاص بك وسننقله إلى هنا بمجرد أن نجده.';
      case 'proven_elsewhere': return 'حساب آخر أكّد هذا العنوان. إذا كان لك، الصق الكود الخاص بك ثم تحقق مجدداً.';
    }
  },
  otherProof: 'طرق أخرى للتأكيد',
  proofTitle: 'أضف أحد هذين ثم اضغط تحقق.',
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
      case 'not_installed': return 'نشغّل إطلالاتك المجانية. يستغرق ذلك لحظات.';
      case 'plan_inactive': return 'خطتك غير مفعّلة. اختر خطة لتشغيل التجربة الافتراضية.';
      case 'unavailable': return 'التجربة الافتراضية غير متاحة الآن. نعمل على ذلك.';
      case 'shop_proof_pending': return 'أكّد أن المتجر لك لتشغيل التجربة الافتراضية.';
      case 'domain_unverified': return 'تعمل التجربة الافتراضية بمجرد أن نجد الكود في متجرك، ونتحقق من ذلك تلقائياً.';
      case 'shopify_app_installed': return 'هذا المتجر يستخدم تطبيق GRINDCTRL على Shopify، لذا تعمل التجربة الافتراضية من التطبيق.';
      default: return 'نجهّز التجربة الافتراضية، ونعمل على ذلك.';
    }
  },
  goTryOnSetup: 'إعدادات التجربة الافتراضية',
  installedTitle: (host) => `تم التثبيت على ${host}`,
  chatShown: 'يرى المتسوقون دردشة المتجر في كل الصفحات.',
  chatPreview: 'دردشة المتجر في وضع المعاينة، لذا تظهر لك وحدك.',
  tryOnOn: (looks) => `التجربة الافتراضية تعمل في صفحات منتجاتك. متبقٍ هذا الشهر: ${looks} ${looks >= 3 && looks <= 10 ? 'إطلالات' : 'إطلالة'}.`,
  tryOnOff: 'التجربة الافتراضية متوقفة، لذا لا يرى المتسوقون الزر. فعّلها من إعدادات التجربة الافتراضية.',
  codeOutdated: 'جديد: أزرار التجربة على صفحات المجموعات. انسخ الكود المحدّث والصقه مكان القديم لتفعيلها.',
  codeOutdatedAction: 'احصل على الكود المحدّث',
  seeOnStore: 'شاهدها في متجرك',
  showSteps: 'إظهار خطوات التثبيت',
  hideSteps: 'إخفاء خطوات التثبيت',
  shopCheckTitle: 'أكّد أن المتجر لك',
  shopCheck: (outcome, retryAfter) => {
    switch (outcome) {
      case 'awaiting_visit': return 'وجدنا الكود. افتح أي صفحة في متجرك لإكمال التأكيد.';
      case 'not_found': return 'لم نجد الكود في متجرك بعد. تأكد من حفظه في القالب ثم حاول مجدداً.';
      case 'outdated_code': return 'في متجرك نسخة قديمة من الكود. انسخه من جديد واستبدلها.';
      case 'wrong_site': return 'يظهر في متجرك كود من حساب آخر. استبدله بالكود الخاص بك ثم تحقق مجدداً.';
      case 'password_required': return 'لمتجرك صفحة كلمة مرور. أدخل كلمة مرور واجهة المتجر لنتحقق منه.';
      case 'password_rejected': return 'لم تفتح كلمة المرور هذه متجرك. تجدها في Shopify من المتجر الإلكتروني ثم التفضيلات.';
      case 'unreachable': return 'لم نتمكن من الوصول إلى متجرك. حاول بعد دقيقة.';
      case 'rate_limited': return retryAfter ? `محاولات كثيرة. حاول بعد ${retryAfter} ثانية.` : 'محاولات كثيرة. حاول بعد قليل.';
      default: return 'بعد لصق الكود وحفظه، تحقق من متجرك. نتأكد من وجود الكود قبل تشغيل التجربة الافتراضية.';
    }
  },
  checkStore: 'تحقق من متجري',
  passwordLabel: 'كلمة مرور واجهة المتجر',
  passwordHint: 'نستخدمها مرة واحدة لهذا التحقق ولا نحتفظ بها.',
  appHeld: 'هذا المتجر يستخدم تطبيق GRINDCTRL على Shopify. أدر دردشة المتجر والتجربة الافتراضية من التطبيق.',
  provenElsewhere: 'حساب آخر أكّد هذا المتجر أولاً. إذا كان المتجر لك، الصق الكود الخاص بك وتحقق من متجرك لنقله إلى هنا.',
  doneForYou: 'تفضّل أن نتولى ذلك؟ نثبّته لك مجاناً.',
  doneForYouAction: 'اطلب منا التثبيت',
  resetTitle: 'إعادة تعيين الكود',
  resetBody: 'استخدمها إذا اطّلع أحد على الكود. يتوقف الكود القديم بعد 15 دقيقة من إعادة التعيين.',
  resetAction: 'إعادة تعيين الكود',
  resetConfirm: 'نعم، أعد التعيين',
  resetDone: (time) => `الكود الجديد جاهز. الصقه قبل ${time}.`,
  cancel: 'إلغاء',
  errors: {
    invalid_request: 'تحقق من تفاصيل الطلب وحاول مجدداً.',
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
