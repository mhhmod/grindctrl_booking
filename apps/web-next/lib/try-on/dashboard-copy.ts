/* Copy for the try-on dashboard page and its settings panel.

   Separate from settings-copy.ts on purpose: that module is shared with the
   Shopify embedded admin and must stay limited to the controls both surfaces
   render. This one is the dashboard's own scaffolding, which Shopify does not
   have. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface TryOnDashboardCopy {
  installedShops: string;
  recentGenerations: string;
  avgGenerationTime: string;
  noDataYet: string;
  providerSpend: string;

  merchantShops: string;
  merchantShopsBody: string;
  noShopsYet: string;
  columnShop: string;
  columnStatus: string;
  columnGenerations: string;
  columnLastGeneration: string;
  noneYet: string;

  planAndCredits: string;
  planAndCreditsBody: string;

  appearance: string;
  appearanceBody: string;

  recentGenerationsBody: string;
  noGenerationsYet: string;
  columnProduct: string;
  columnCost: string;
  columnTime: string;
  columnWhen: string;
  demoShop: string;
  noData: string;

  shopifyApp: string;
  shopifyAppBody: string;
  openShopifyApp: string;

  /** Glued to a number: `3.4s`. Not a standalone word. */
  secondsSuffix: string;

  statusInstalled: string;
  statusUninstalled: string;
  statusQueued: string;
  statusProcessing: string;
  statusCompleted: string;
  statusFailed: string;

  /* ── Settings panel ── */
  editing: string;
  globalDefaultsOption: string;
  /** Glued to a shop domain inside an <option>. Not a standalone word. */
  uninstalledSuffix: string;
  defaultsHelp: string;
  overridesHelp: (shop: string) => string;
  saveSettings: string;
  saving: string;
  savedLive: string;
  saveFailed: string;

  /* ── Plan control ── */
  plansBelongToShop: string;
  noPlan: string;
  planStatusActive: string;
  planStatusGrace: string;
  planStatusExpired: string;
  planStatusCancelled: string;
  planStatusNone: string;

  periodEnds: (date: string) => string;
  notActivated: string;
  downgradesTo: (planKey: string) => string;

  bannerExpired: string;
  bannerCancelled: string;
  bannerGrace: (days: number) => string;
  bannerUrgent: (days: number) => string;
  bannerRenewalDue: (days: number) => string;
  bannerExhausted: string;
  bannerCritical: (renders: number) => string;
  bannerLow: (renders: number) => string;

  planRendersLeft: (remaining: number, included: number) => string;
  plusFromTopUps: (renders: number) => string;
  rendersUsedAria: (percent: number) => string;

  paymentReference: string;
  /* An example of what to type, not a fixed format. Instapay is a product
     name and stays Latin; the month and currency are what the owner would
     actually write in their own language. */
  paymentReferencePlaceholder: string;
  paymentReferenceHelp: string;

  planLabel: string;
  topUpPackLabel: string;
  /** `${name}, ${price} for ${renders}` — name and price come from the catalog. */
  catalogOption: (name: string, price: string, renders: number) => string;

  activate: string;
  activateOrUpgrade: string;
  renew: string;
  renewUnavailable: string;
  scheduleDowngrade: string;
  addTopUp: string;
  topUpUnavailable: string;

  /* Action names are interpolated into actionInProgress and actionApplied,
     so each locale owns its own sentence shape around them. */
  actionActivation: string;
  actionRenewal: string;
  actionDowngrade: string;
  actionTopUp: string;
  actionInProgress: (action: string) => string;
  actionApplied: (action: string) => string;
  actionReplayed: string;
  actionFailed: string;
}

/* CLDR sorts Arabic counts into six categories, and Intl.PluralRules already
   knows which one a number falls into, so this only has to supply the forms.
   For one and two the numeral is dropped, because MSA carries the count in
   the noun itself.

   Four arms cover all six: zero (0) and other (100, 101, …) both take the
   bare singular, so they share the default. Anything routed to default that
   is neither still reads correctly. */
const arPlural = new Intl.PluralRules('ar-EG');

function arDays(n: number): string {
  switch (arPlural.select(n)) {
    case 'one':
      return 'يوم واحد';
    case 'two':
      return 'يومين';
    case 'few':
      return `${n} أيام`;
    case 'many':
      return `${n} يوماً`;
    default:
      return `${n} يوم`;
  }
}

const en: TryOnDashboardCopy = {
  installedShops: 'Installed shops',
  recentGenerations: 'Recent generations',
  avgGenerationTime: 'Avg generation time',
  noDataYet: 'No data yet',
  providerSpend: 'Provider spend (recent)',

  merchantShops: 'Merchant shops',
  merchantShopsBody:
    'A shop appears the first time its admin opens the app, and drops to uninstalled when Shopify tells us it was removed.',
  noShopsYet:
    'No shop has opened the app yet. Once a merchant opens it from their Shopify admin, they appear here and can be configured individually.',
  columnShop: 'Shop',
  columnStatus: 'Status',
  columnGenerations: 'Generations',
  columnLastGeneration: 'Last generation',
  noneYet: 'None yet',

  planAndCredits: 'Plan and credits',
  planAndCreditsBody:
    'Payment is collected outside the app, so activating here is what grants credits. Every action is recorded in the ledger with its payment reference.',

  appearance: 'Appearance and journey',
  appearanceBody:
    'The same controls the merchant sees in their Shopify admin, writing to the same record. Changes go live within a minute.',

  recentGenerationsBody: 'The last 25 live jobs, newest first, with what each cost.',
  noGenerationsYet:
    'No generations yet. Run a try-on from a storefront and it lands here with its cost and timing.',
  columnProduct: 'Product',
  columnCost: 'Cost',
  columnTime: 'Time',
  columnWhen: 'When',
  demoShop: 'Demo',
  noData: 'No data',

  shopifyApp: 'Shopify app',
  shopifyAppBody:
    'Merchants install and configure from their own admin. This is what they open.',
  openShopifyApp: 'Open the Shopify app',

  secondsSuffix: 's',

  statusInstalled: 'Installed',
  statusUninstalled: 'Uninstalled',
  statusQueued: 'Queued',
  statusProcessing: 'Processing',
  statusCompleted: 'Completed',
  statusFailed: 'Failed',

  editing: 'Editing',
  globalDefaultsOption: 'Global defaults (every shop without its own settings)',
  uninstalledSuffix: ' (uninstalled)',
  defaultsHelp:
    'These values apply to every shop that has not overridden them. A merchant saving in their Shopify admin overrides them for that shop only.',
  overridesHelp: (shop) =>
    `Overrides the global defaults for ${shop}. This is the same record the merchant edits in their Shopify admin.`,
  saveSettings: 'Save settings',
  saving: 'Saving…',
  savedLive: 'Saved, live within a minute.',
  saveFailed: 'Could not save. Try again.',

  plansBelongToShop:
    'Plans belong to a shop. Pick a merchant shop above to see and change what it is entitled to.',
  noPlan: 'No plan',
  planStatusActive: 'Active',
  planStatusGrace: 'Grace',
  planStatusExpired: 'Expired',
  planStatusCancelled: 'Cancelled',
  planStatusNone: 'No subscription',

  periodEnds: (date) => `Period ends ${date}`,
  notActivated: 'Not activated',
  downgradesTo: (planKey) => `Downgrades to ${planKey} next period`,

  bannerExpired: 'Expired. Generation is stopped until this shop is renewed.',
  bannerCancelled: 'Cancelled. Generation is stopped.',
  bannerGrace: (days) =>
    `In grace for ${days} more day${days === 1 ? '' : 's'}. Collect payment before it stops.`,
  bannerUrgent: (days) => `Renews in ${days} day${days === 1 ? '' : 's'}. Invoice now.`,
  bannerRenewalDue: (days) => `Renews in ${days} day${days === 1 ? '' : 's'}.`,
  bannerExhausted: 'Out of credits. A top-up or renewal is needed.',
  bannerCritical: (renders) => `Almost out: ${renders} renders left.`,
  bannerLow: (renders) => `Running low: ${renders} renders left.`,

  planRendersLeft: (remaining, included) => `${remaining} of ${included} plan renders left`,
  plusFromTopUps: (renders) => `plus ${renders} from top-ups`,
  rendersUsedAria: (percent) => `${percent}% of plan renders used`,

  paymentReference: 'Payment reference',
  paymentReferencePlaceholder: 'Instapay 14 Jul, 15 USD',
  paymentReferenceHelp:
    'Stored with the ledger entry so any future question about this shop has an answer.',

  planLabel: 'Plan',
  topUpPackLabel: 'Top-up pack',
  catalogOption: (name, price, renders) => `${name}, ${price} for ${renders}`,

  activate: 'Activate',
  activateOrUpgrade: 'Activate or upgrade',
  renew: 'Renew',
  renewUnavailable: 'Renewal opens at the period boundary',
  scheduleDowngrade: 'Schedule downgrade',
  addTopUp: 'Add top-up',
  topUpUnavailable: 'Top-ups need an active or grace subscription',

  actionActivation: 'Activation',
  actionRenewal: 'Renewal',
  actionDowngrade: 'Downgrade',
  actionTopUp: 'Top-up',
  actionInProgress: (action) => `${action} in progress…`,
  actionApplied: (action) => `${action} applied. The merchant sees it immediately.`,
  actionReplayed: 'Already applied. Nothing changed.',
  actionFailed: 'The action failed.',
};

const ar: TryOnDashboardCopy = {
  installedShops: 'المتاجر المثبَّتة',
  recentGenerations: 'أحدث عمليات التوليد',
  avgGenerationTime: 'متوسط زمن التوليد',
  noDataYet: 'لا توجد بيانات بعد',
  providerSpend: 'تكلفة المزود (الأخيرة)',

  merchantShops: 'متاجر التجار',
  merchantShopsBody:
    'يظهر المتجر أول مرة يفتح فيها مسؤوله التطبيق، ويتحول إلى غير مثبَّت عندما تخبرنا شوبيفاي بإزالته.',
  noShopsYet:
    'لم يفتح أي متجر التطبيق بعد. بمجرد أن يفتحه تاجر من لوحة شوبيفاي الخاصة به، سيظهر هنا ويمكن ضبطه بشكل منفصل.',
  columnShop: 'المتجر',
  columnStatus: 'الحالة',
  columnGenerations: 'عمليات التوليد',
  columnLastGeneration: 'آخر عملية توليد',
  noneYet: 'لا شيء بعد',

  planAndCredits: 'الخطة والأرصدة',
  planAndCreditsBody:
    'يتم تحصيل الدفع خارج التطبيق، لذا فإن التفعيل من هنا هو ما يمنح الأرصدة. كل إجراء يُسجَّل في السجل مع مرجع الدفع الخاص به.',

  appearance: 'المظهر ورحلة العميل',
  appearanceBody:
    'نفس عناصر التحكم التي يراها التاجر في لوحة شوبيفاي، وتكتب في السجل نفسه. تظهر التغييرات خلال دقيقة.',

  recentGenerationsBody: 'آخر ٢٥ عملية مباشرة، الأحدث أولاً، مع تكلفة كل منها.',
  noGenerationsYet:
    'لا توجد عمليات توليد بعد. شغّل تجربة قياس من أي متجر وستظهر هنا مع تكلفتها وزمنها.',
  columnProduct: 'المنتج',
  columnCost: 'التكلفة',
  columnTime: 'الزمن',
  columnWhen: 'التوقيت',
  demoShop: 'تجريبي',
  noData: 'لا توجد بيانات',

  shopifyApp: 'تطبيق شوبيفاي',
  shopifyAppBody: 'يقوم التجار بالتثبيت والضبط من لوحاتهم الخاصة. هذا ما يفتحونه.',
  openShopifyApp: 'افتح تطبيق شوبيفاي',

  secondsSuffix: 'ث',

  statusInstalled: 'مثبَّت',
  statusUninstalled: 'غير مثبَّت',
  statusQueued: 'في الانتظار',
  statusProcessing: 'قيد المعالجة',
  statusCompleted: 'مكتمل',
  statusFailed: 'فشل',

  /* Not 'التعديل على': that is a dangling preposition, and this label stands
     alone above the select rather than running into the shop name. */
  editing: 'نطاق التعديل',
  globalDefaultsOption: 'الإعدادات الافتراضية العامة (كل متجر بلا إعدادات خاصة)',
  uninstalledSuffix: ' (غير مثبَّت)',
  defaultsHelp:
    'تنطبق هذه القيم على كل متجر لم يتجاوزها بإعدادات خاصة. وعندما يحفظ التاجر إعداداته في لوحة شوبيفاي، فإنها تتجاوزها لمتجره وحده.',
  overridesHelp: (shop) =>
    `يتجاوز الإعدادات الافتراضية العامة لمتجر ${shop}. وهذا هو السجل نفسه الذي يعدّله التاجر في لوحة شوبيفاي.`,
  saveSettings: 'حفظ الإعدادات',
  saving: 'جارٍ الحفظ…',
  savedLive: 'تم الحفظ، ويظهر خلال دقيقة.',
  saveFailed: 'تعذّر الحفظ. حاول مرة أخرى.',

  plansBelongToShop:
    'ترتبط الخطط بمتجر بعينه. اختر متجر تاجر من الأعلى لعرض صلاحياته وتغييرها.',
  noPlan: 'لا توجد خطة',
  planStatusActive: 'نشط',
  planStatusGrace: 'مهلة سماح',
  planStatusExpired: 'منتهٍ',
  planStatusCancelled: 'ملغى',
  planStatusNone: 'بلا اشتراك',

  periodEnds: (date) => `تنتهي الفترة في ${date}`,
  notActivated: 'غير مُفعَّل',
  downgradesTo: (planKey) => `يُخفَّض إلى ${planKey} في الفترة القادمة`,

  bannerExpired: 'انتهت الصلاحية. توقّف التوليد حتى يُجدَّد هذا المتجر.',
  bannerCancelled: 'تم الإلغاء. توقّف التوليد.',
  bannerGrace: (days) => `مهلة سماح لمدة ${arDays(days)}. حصّل الدفع قبل أن يتوقف.`,
  bannerUrgent: (days) => `يتجدد خلال ${arDays(days)}. أرسل الفاتورة الآن.`,
  bannerRenewalDue: (days) => `يتجدد خلال ${arDays(days)}.`,
  bannerExhausted: 'نفد الرصيد. يلزم شحن إضافي أو تجديد.',
  /* Arabic agrees the noun with the count, so a running total is written as a
     label and a number instead of a counted noun. */
  bannerCritical: (renders) => `أوشك الرصيد على النفاد. المتبقي: ${renders}.`,
  bannerLow: (renders) => `الرصيد منخفض. المتبقي: ${renders}.`,

  planRendersLeft: (remaining, included) =>
    `المتبقي من عمليات الخطة: ${remaining} من ${included}`,
  plusFromTopUps: (renders) => `بالإضافة إلى ${renders} من الشحن الإضافي`,
  rendersUsedAria: (percent) => `تم استخدام ${percent}% من عمليات الخطة`,

  paymentReference: 'مرجع الدفع',
  paymentReferencePlaceholder: 'Instapay 14 يوليو، 15 دولار',
  paymentReferenceHelp: 'يُحفظ مع قيد السجل ليكون لأي سؤال لاحق عن هذا المتجر إجابة.',

  planLabel: 'الخطة',
  topUpPackLabel: 'باقة شحن إضافي',
  catalogOption: (name, price, renders) => `${name}، ${price} مقابل ${renders}`,

  activate: 'تفعيل',
  activateOrUpgrade: 'تفعيل أو ترقية',
  renew: 'تجديد',
  renewUnavailable: 'يتاح التجديد عند نهاية الفترة',
  scheduleDowngrade: 'جدولة الخفض',
  addTopUp: 'إضافة شحن',
  topUpUnavailable: 'يتطلب الشحن الإضافي اشتراكاً نشطاً أو في مهلة السماح',

  actionActivation: 'التفعيل',
  actionRenewal: 'التجديد',
  actionDowngrade: 'خفض الخطة',
  actionTopUp: 'شحن الرصيد',
  actionInProgress: (action) => `جارٍ ${action}…`,
  actionApplied: (action) => `تم ${action}. يراه التاجر فوراً.`,
  actionReplayed: 'مطبَّق بالفعل. لم يتغير شيء.',
  actionFailed: 'فشل الإجراء.',
};

export function getTryOnDashboardCopy(locale: SiteLocale): TryOnDashboardCopy {
  return locale === 'ar' ? ar : en;
}

/* A BCP-47 tag for toLocaleString/toLocaleDateString, deliberately not a
   dictionary value: it is an identifier, not copy, and the Arabic dictionary
   is swept for Latin letters.

   Arabic month and day names, but Latin digits: a column of dates is read by
   comparing it down the page, and Arabic-Indic digits make that harder.
   Dropping -u-nu-latn switches them back. */
export function getDateLocale(locale: SiteLocale): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
}

/* Status badges render a database value, so they need translating at the
   point of display rather than in a dictionary lookup the page does inline.

   tryon_shops.status is 'installed' | 'uninstalled' (the TryOnShopStatus
   union, and the only two values its writers set). tryon_jobs.status is
   fixed by a CHECK constraint to 'processing' | 'completed' | 'failed';
   'queued' is declared by TryOnJobStatus but the constraint rejects it
   today, so it is mapped here in case the constraint is relaxed.

   Anything unmapped falls through to the raw value: a status we have not
   seen should show up as visible English, never as an empty badge. */
export function statusLabel(c: TryOnDashboardCopy, status: string): string {
  switch (status) {
    case 'installed':
      return c.statusInstalled;
    case 'uninstalled':
      return c.statusUninstalled;
    case 'queued':
      return c.statusQueued;
    case 'processing':
      return c.statusProcessing;
    case 'completed':
      return c.statusCompleted;
    case 'failed':
      return c.statusFailed;
    default:
      return status;
  }
}

/* Kept apart from statusLabel because it maps a different enum:
   tryon_subscriptions.status (the SubscriptionStatus union), which the plan
   badge renders raw. Same fall-through rule — an unknown status shows up as
   visible English rather than an empty badge. */
export function planStatusLabel(c: TryOnDashboardCopy, status: string): string {
  switch (status) {
    case 'active':
      return c.planStatusActive;
    case 'grace':
      return c.planStatusGrace;
    case 'expired':
      return c.planStatusExpired;
    case 'cancelled':
      return c.planStatusCancelled;
    case 'none':
      return c.planStatusNone;
    default:
      return status;
  }
}
