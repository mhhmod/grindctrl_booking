/* Copy for the v16 Store Chat Set up tab (04-dashboard.md, the ChatStudio
   board). The board's strings are drafts; the pull request lists the ones
   written here. The Arabic is simple Modern Standard Arabic in neutral
   forms, with Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

type Pair = { label: string; body: string };

export interface ChatStudioCopy {
  subtitle: string;
  storeChatOn: string;
  storeChatOff: string;
  changesLabel: string;
  notLive: (n: number) => string;
  changesSaved: string;
  saving: string;
  saveFailed: string;
  reviewChanges: string;
  discard: string;
  publish: string;
  publishing: string;
  published: string;
  before: string;
  after: string;
  on: string;
  off: string;
  empty: string;
  close: string;
  whereItAppears: Pair;
  chatBubble: Pair;
  sides: Record<'bottom-left' | 'bottom-right', string>;
  sideLabel: string;
  hidePages: Pair;
  hidePlaceholder: string;
  add: string;
  remove: (value: string) => string;
  firstHello: string;
  firstHelloBody: (seconds: number) => string;
  look: Pair;
  launcherIcon: string;
  icons: Record<'chat' | 'message' | 'help', string>;
  brandColour: Pair;
  corners: string;
  radii: Record<'soft' | 'rounded' | 'sharp', string>;
  theme: string;
  themes: Record<'auto' | 'light' | 'dark', string>;
  launcherLabel: Pair;
  english: string;
  arabic: string;
  inEnglish: (what: string) => string;
  inArabic: (what: string) => string;
  welcome: Pair;
  welcomeTitle: string;
  welcomeMessage: string;
  inputHint: Pair;
  assistant: Pair;
  assistantReplies: Pair;
  tone: string;
  tones: Record<'friendly' | 'professional' | 'concise' | 'warm', string>;
  replyLanguage: string;
  replyLanguages: Record<'auto' | 'en' | 'ar', string>;
  dialect: string;
  dialects: Record<'egyptian' | 'gulf' | 'levantine' | 'msa', string>;
  instructions: Pair;
  count: (used: number, max: number) => string;
  person: Pair;
  offerPerson: Pair;
  ruleOrderChanges: Pair;
  ruleUpset: string;
  ruleBigOrder: string;
  ruleBigOrderBody: (amount: string, pieces: number) => string;
  askWhere: Pair;
  askOutsideHours: string;
  photosOrders: Pair;
  photos: Pair;
  describePhotos: Pair;
  orderLookup: Pair;
  orderAccess: string;
  noOrderAccess: string;
  alerted: Pair;
  emailAlerts: Pair;
  alertEmails: string;
  addEmail: string;
  badEmail: string;
  tooManyEmails: string;
  hours: string;
  businessHours: string;
  hoursAfter: string;
  change: string;
  installation: string;
  lastCheck: (ago: string) => string;
  neverChecked: string;
  ago: (minutes: number) => string;
  openThemeEditor: string;
  testNow: string;
  notShopify: string;
  copyScript: string;
  copied: string;
  publishedVersion: (n: number) => string;
  revert: string;
  revertConfirm: string;
  disconnect: Pair;
  disconnectConfirm: string;
  cancel: string;
  moreSettings: Pair;
  openMoreSettings: string;
  preview: string;
  previewCaption: string;
  failed: string;
}

const en: ChatStudioCopy = {
  subtitle: 'Every change shows in the preview first. Shoppers see it when you publish.',
  storeChatOn: 'Store Chat is on',
  storeChatOff: 'Store Chat is off',
  changesLabel: 'Changes not live yet',
  notLive: (n) => (n === 1 ? '1 change not live yet' : `${n} changes not live yet`),
  changesSaved: 'Your changes are saved. Shoppers still see the published version.',
  saving: 'Saving…',
  saveFailed: 'Your last change didn’t save. Try again in a minute.',
  reviewChanges: 'Review changes',
  discard: 'Discard',
  publish: 'Publish to your store',
  publishing: 'Publishing…',
  published: 'Published. Your store is serving the new version.',
  before: 'Before',
  after: 'After',
  on: 'On',
  off: 'Off',
  empty: 'Empty',
  close: 'Close',
  whereItAppears: { label: 'Where it appears', body: 'Where shoppers find the chat on your store.' },
  chatBubble: { label: 'Chat bubble', body: 'Bottom corner of every page, except checkout.' },
  sides: { 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right' },
  sideLabel: 'Chat bubble side',
  hidePages: { label: 'Hide on some pages', body: 'Hide the chat on pages whose address contains' },
  hidePlaceholder: '/collections/sale',
  add: 'Add',
  remove: (value) => `Remove ${value}`,
  firstHello: 'First hello',
  firstHelloBody: (seconds) => `A small bubble ${seconds} seconds after the page loads.`,
  look: { label: 'Look', body: 'How the chat looks on your store.' },
  launcherIcon: 'Launcher icon',
  icons: { chat: 'Chat', message: 'Message', help: 'Help' },
  brandColour: { label: 'Brand colour', body: 'Used for the chat bubble and buttons.' },
  corners: 'Corners',
  radii: { soft: 'Soft', rounded: 'Round', sharp: 'Sharp' },
  theme: 'Theme',
  themes: { auto: 'Automatic', light: 'Light', dark: 'Dark' },
  launcherLabel: { label: 'Launcher label', body: 'Leave empty for an icon-only button.' },
  english: 'English',
  arabic: 'Arabic',
  inEnglish: (what) => `${what} in English`,
  inArabic: (what) => `${what} in Arabic`,
  welcome: { label: 'Welcome screen', body: 'What shoppers see when they open the chat. Write it once in each language.' },
  welcomeTitle: 'Title',
  welcomeMessage: 'Message',
  inputHint: { label: 'Message box hint', body: 'Shown in the empty message box.' },
  assistant: { label: 'Assistant', body: 'How the assistant answers shoppers.' },
  assistantReplies: {
    label: 'Assistant replies',
    body: 'The assistant answers first. Turn it off and every question waits for your team.',
  },
  tone: 'Tone',
  tones: { friendly: 'Friendly', professional: 'Professional', concise: 'Concise', warm: 'Warm' },
  replyLanguage: 'Reply language',
  replyLanguages: { auto: 'Match the shopper', en: 'English', ar: 'Arabic' },
  dialect: 'Arabic dialect',
  dialects: { egyptian: 'Egyptian', gulf: 'Gulf', levantine: 'Levantine', msa: 'Formal Arabic' },
  instructions: {
    label: 'Anything the assistant should always know',
    body: 'About how you support customers. Facts and rules work best.',
  },
  count: (used, max) => `${used.toLocaleString('en')} of ${max.toLocaleString('en')}`,
  person: {
    label: 'When to bring in a person',
    body: 'The assistant tells the shopper a person will reply, and your team gets an email.',
  },
  offerPerson: { label: 'Offer a person when the shopper asks', body: 'The chat moves to your team in the inbox.' },
  ruleOrderChanges: {
    label: 'Requests to refund, exchange or change an order',
    body: 'It still answers questions about your policies, like how long exchanges take.',
  },
  ruleUpset: 'The shopper seems upset',
  ruleBigOrder: 'Big orders',
  ruleBigOrderBody: (amount, pieces) => `Over ${amount}, or ${pieces} or more of one piece`,
  askWhere: {
    label: 'Ask where to reply when nobody can answer now',
    body: 'The assistant asks once for an email address, so your team can reply later.',
  },
  askOutsideHours: 'Also ask outside opening hours',
  photosOrders: {
    label: 'Photos and orders',
    body: 'Shoppers can show a problem and check an order without waiting for your team.',
  },
  photos: {
    label: 'Let shoppers send a photo',
    body: 'JPEG, PNG or WebP up to 5 MB. Location data is removed and photos are kept 90 days.',
  },
  describePhotos: {
    label: 'Describe what the photo shows',
    body: 'Labels like Looks damaged or Looks like a size problem, for your team.',
  },
  orderLookup: { label: 'Look up order status and tracking', body: 'With the order number and the email on the order.' },
  orderAccess: 'Order access approved for this store',
  noOrderAccess: 'Order access isn’t approved for this store yet.',
  alerted: { label: 'Who gets alerted', body: 'When a shopper needs a person.' },
  emailAlerts: { label: 'Email when a shopper needs a person', body: 'Up to 5 addresses, at most 10 emails an hour.' },
  alertEmails: 'Alert emails',
  addEmail: 'Add an email address',
  badEmail: 'Enter a full email address.',
  tooManyEmails: 'Up to 5 addresses.',
  hours: 'Opening hours',
  businessHours: 'Business hours',
  hoursAfter: 'Outside them the assistant keeps answering and asks where the team should reply.',
  change: 'Change',
  installation: 'Installation',
  lastCheck: (ago) => `Last storefront check ${ago}.`,
  neverChecked: 'Not seen on your storefront yet.',
  ago: (minutes) =>
    minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${minutes} min ago`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)} h ago`
          : `${Math.floor(minutes / 1440)} days ago`,
  openThemeEditor: 'Open theme editor',
  testNow: 'Test it now',
  notShopify: 'Not on Shopify?',
  copyScript: 'Copy the script',
  copied: 'Copied',
  publishedVersion: (n) => `Published version ${n}`,
  revert: 'Revert to previous version',
  revertConfirm: 'Shoppers see the previous version again. Your current version is kept as the one before.',
  disconnect: { label: 'Disconnect this store', body: 'Store Chat in Shopify and your data stay in place.' },
  disconnectConfirm: 'Disconnect this store from your dashboard? Store Chat in Shopify and your data stay in place.',
  cancel: 'Cancel',
  moreSettings: {
    label: 'More settings',
    body: 'Saved replies, the second reminder, the widget’s language and a custom icon are still on the earlier screens.',
  },
  openMoreSettings: 'Open them',
  preview: 'Preview',
  previewCaption: 'A preview of your store with your changes.',
  failed: 'That didn’t work. Try again in a minute.',
};

const ar: ChatStudioCopy = {
  subtitle: 'يظهر كل تغيير في المعاينة أولًا. ويراه المتسوقون عندما تنشر.',
  storeChatOn: 'دردشة المتجر تعمل',
  storeChatOff: 'دردشة المتجر متوقفة',
  changesLabel: 'تغييرات لم تُنشر بعد',
  notLive: (n) =>
    arCount(n, {
      one: 'تغيير واحد لم يُنشر بعد',
      two: 'تغييران لم يُنشرا بعد',
      few: (k) => `${k} تغييرات لم تُنشر بعد`,
      many: (k) => `${k} تغييراً لم يُنشر بعد`,
    }),
  changesSaved: 'تم حفظ تغييراتك. وما زال المتسوقون يرون النسخة المنشورة.',
  saving: 'جارٍ الحفظ…',
  saveFailed: 'لم يُحفظ تغييرك الأخير. حاول مجدداً بعد دقيقة.',
  reviewChanges: 'راجع التغييرات',
  discard: 'تجاهل',
  publish: 'انشر في متجرك',
  publishing: 'جارٍ النشر…',
  published: 'تم النشر. متجرك يعرض النسخة الجديدة الآن.',
  before: 'قبل',
  after: 'بعد',
  on: 'مفعّل',
  off: 'متوقف',
  empty: 'فارغ',
  close: 'إغلاق',
  whereItAppears: { label: 'أين تظهر', body: 'أين يجد المتسوقون الدردشة في متجرك.' },
  chatBubble: { label: 'فقاعة الدردشة', body: 'الزاوية السفلية من كل صفحة، عدا صفحة الدفع.' },
  sides: { 'bottom-left': 'أسفل اليسار', 'bottom-right': 'أسفل اليمين' },
  sideLabel: 'جهة فقاعة الدردشة',
  hidePages: { label: 'أخفِها في بعض الصفحات', body: 'أخفِ الدردشة في الصفحات التي يحتوي عنوانها على' },
  hidePlaceholder: '/collections/sale',
  add: 'إضافة',
  remove: (value) => `أزل ${value}`,
  firstHello: 'التحية الأولى',
  firstHelloBody: (seconds) =>
    `فقاعة صغيرة تظهر بعد ${arCount(seconds, { one: 'ثانية واحدة', two: 'ثانيتين', few: (k) => `${k} ثوانٍ`, many: (k) => `${k} ثانية` })} من تحميل الصفحة.`,
  look: { label: 'الشكل', body: 'شكل الدردشة في متجرك.' },
  launcherIcon: 'أيقونة زر الدردشة',
  icons: { chat: 'الدردشة', message: 'رسالة', help: 'المساعدة' },
  brandColour: { label: 'لون العلامة', body: 'يُستخدم لفقاعة الدردشة والأزرار.' },
  corners: 'الحواف',
  radii: { soft: 'ناعمة', rounded: 'دائرية', sharp: 'حادة' },
  theme: 'المظهر',
  themes: { auto: 'تلقائي', light: 'فاتح', dark: 'داكن' },
  launcherLabel: { label: 'نص زر الدردشة', body: 'اتركه فارغًا ليظهر الزر بأيقونة فقط.' },
  english: 'الإنجليزية',
  arabic: 'العربية',
  inEnglish: (what) => `${what} بالإنجليزية`,
  inArabic: (what) => `${what} بالعربية`,
  welcome: { label: 'شاشة الترحيب', body: 'ما يراه المتسوقون عند فتح الدردشة. اكتبه مرة واحدة بكل لغة.' },
  welcomeTitle: 'العنوان',
  welcomeMessage: 'الرسالة',
  inputHint: { label: 'تلميح خانة الرسالة', body: 'يظهر في خانة الرسالة وهي فارغة.' },
  assistant: { label: 'المساعد', body: 'طريقة رد المساعد على المتسوقين.' },
  assistantReplies: { label: 'ردود المساعد', body: 'يرد المساعد أولًا. وإذا أوقفته، ينتظر كل سؤال فريقك.' },
  tone: 'نبرة الرد',
  tones: { friendly: 'ودودة', professional: 'مهنية', concise: 'موجزة', warm: 'دافئة' },
  replyLanguage: 'لغة الرد',
  replyLanguages: { auto: 'حسب لغة المتسوق', en: 'الإنجليزية', ar: 'العربية' },
  dialect: 'اللهجة العربية',
  dialects: { egyptian: 'المصرية', gulf: 'الخليجية', levantine: 'الشامية', msa: 'الفصحى' },
  instructions: { label: 'ما يجب أن يعرفه المساعد دائمًا', body: 'عن طريقة دعمك لعملائك. الحقائق والقواعد تعطي أفضل النتائج.' },
  count: (used, max) => `${used.toLocaleString('en')} من ${max.toLocaleString('en')}`,
  person: { label: 'متى يتدخل شخص من الفريق', body: 'يخبر المساعد المتسوق بأن شخصًا من الفريق سيرد، ويصل إلى فريقك بريد إلكتروني.' },
  offerPerson: { label: 'اعرض شخصًا من الفريق عندما يطلب المتسوق', body: 'تنتقل المحادثة إلى فريقك في الرسائل.' },
  ruleOrderChanges: {
    label: 'طلبات الاسترداد أو الاستبدال أو تعديل الطلب',
    body: 'يظل المساعد يجيب عن أسئلة سياساتك، مثل المدة التي يستغرقها الاستبدال.',
  },
  ruleUpset: 'يبدو المتسوق منزعجًا',
  ruleBigOrder: 'الطلبات الكبيرة',
  ruleBigOrderBody: (amount, pieces) => `أكثر من ${amount}، أو ${pieces} قطع أو أكثر من القطعة نفسها`,
  askWhere: { label: 'اسأل أين نرد عندما لا يتوفر أحد للرد الآن', body: 'يطلب المساعد عنوان البريد الإلكتروني مرة واحدة، ليتمكن فريقك من الرد لاحقًا.' },
  askOutsideHours: 'اسأل أيضًا خارج ساعات العمل',
  photosOrders: { label: 'الصور والطلبات', body: 'يمكن للمتسوقين عرض المشكلة ومتابعة الطلب دون انتظار فريقك.' },
  photos: { label: 'اسمح للمتسوقين بإرسال صورة', body: 'JPEG أو PNG أو WebP حتى 5 ميجابايت. تُحذف بيانات الموقع وتُحفظ الصور 90 يومًا.' },
  describePhotos: { label: 'صِف ما تُظهره الصورة', body: 'تصنيفات لفريقك مثل «يبدو تالفًا» أو «تبدو مشكلة مقاس».' },
  orderLookup: { label: 'استعلم عن حالة الطلب وتتبّعه', body: 'برقم الطلب والبريد الإلكتروني المسجل في الطلب.' },
  orderAccess: 'تمت الموافقة على الوصول إلى الطلبات لهذا المتجر',
  noOrderAccess: 'لم تتم الموافقة على الوصول إلى الطلبات لهذا المتجر بعد.',
  alerted: { label: 'من يصله التنبيه', body: 'عندما يحتاج متسوق إلى شخص من الفريق.' },
  emailAlerts: { label: 'أرسل بريدًا إلكترونيًا عندما يحتاج متسوق إلى شخص من الفريق', body: 'حتى 5 عناوين، وبحد أقصى 10 رسائل في الساعة.' },
  alertEmails: 'عناوين بريد التنبيهات',
  addEmail: 'أضف عنوان بريد إلكتروني',
  badEmail: 'أدخل عنوان بريد إلكتروني كاملاً.',
  tooManyEmails: 'حتى 5 عناوين.',
  hours: 'ساعات العمل',
  businessHours: 'مواعيد العمل',
  hoursAfter: 'خارج هذه الساعات يواصل المساعد الرد، ويسأل أين يرد الفريق.',
  change: 'تغيير',
  installation: 'التثبيت',
  lastCheck: (ago) => `آخر فحص لواجهة المتجر ${ago}.`,
  neverChecked: 'لم تُرصد في واجهة متجرك بعد.',
  ago: (minutes) =>
    minutes < 1
      ? 'الآن'
      : minutes < 60
        ? `قبل ${arCount(minutes, { one: 'دقيقة', two: 'دقيقتين', few: (k) => `${k} دقائق`, many: (k) => `${k} دقيقة` })}`
        : minutes < 1440
          ? `قبل ${arCount(Math.floor(minutes / 60), { one: 'ساعة', two: 'ساعتين', few: (k) => `${k} ساعات`, many: (k) => `${k} ساعة` })}`
          : `قبل ${arCount(Math.floor(minutes / 1440), { one: 'يوم', two: 'يومين', few: (k) => `${k} أيام`, many: (k) => `${k} يوماً` })}`,
  openThemeEditor: 'افتح محرر القالب',
  testNow: 'اختبرها الآن',
  notShopify: 'متجرك ليس على Shopify؟',
  copyScript: 'انسخ الكود',
  copied: 'تم النسخ',
  publishedVersion: (n) => `النسخة المنشورة ${n}`,
  revert: 'استعد النسخة السابقة',
  revertConfirm: 'سيرى المتسوقون النسخة السابقة مجدداً. وتُحفظ نسختك الحالية على أنها السابقة.',
  disconnect: { label: 'افصل هذا المتجر', body: 'تبقى دردشة المتجر في Shopify وبياناتك كما هي.' },
  disconnectConfirm: 'هل تفصل هذا المتجر عن لوحة التحكم؟ تبقى دردشة المتجر في Shopify وبياناتك كما هي.',
  cancel: 'إلغاء',
  moreSettings: {
    label: 'إعدادات أخرى',
    body: 'الردود المحفوظة والتذكير الثاني ولغة الأداة والأيقونة المخصصة ما زالت في الشاشات السابقة.',
  },
  openMoreSettings: 'افتحها',
  preview: 'معاينة',
  previewCaption: 'معاينة لمتجرك مع تغييراتك.',
  failed: 'لم ينجح ذلك. حاول مجدداً بعد دقيقة.',
};

export function getChatStudioCopy(locale: SiteLocale): ChatStudioCopy {
  return locale === 'ar' ? ar : en;
}
