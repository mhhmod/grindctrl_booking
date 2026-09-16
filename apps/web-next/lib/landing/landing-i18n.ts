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

interface Item {
  title: string;
  body: string;
}

interface SystemMapRow {
  shopper: string;
  grindctrl: string;
  business: string;
}

interface PlatformPillar {
  title: string;
  body: string;
  status: string;
}

export type PlatformEvidenceItemId =
  | 'operations'
  | 'automation'
  | 'integrations'
  | 'managed-implementation'
  | 'privacy-security';

export interface PlatformEvidenceItem {
  id: PlatformEvidenceItemId;
  kind: 'standard' | 'integrations';
  title: string;
  body: string;
  status: string;
}

interface LandingDict {
  brandHome: string;
  langToggleLabel: string;
  langSwitchTo: string;

  navHow: string;
  navDemo: string;
  navBenefits: string;
  navProductGroup: string;
  navProductShopping: string;
  navProductConversations: string;
  navProductOperations: string;
  navProductIntegrations: string;
  navPricing: string;
  signIn: string;
  bookCall: string;
  menu: string;
  closeMenu: string;

  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimary: string;
  heroSecondary: string;
  heroChips: string[];
  heroRevealCaption: string;
  heroRevealAlt: string;
  heroJourneyLabel: string;
  heroJourneyStages: string[];

  howEyebrow: string;
  howTitle: string;
  howBody: string;
  howMapColumns: [string, string, string];
  howMapRows: SystemMapRow[];

  demoEyebrow: string;
  demoTitle: string;
  demoBody: string;
  demoButton: string;
  demoNote: string;
  demoPreviewLabel: string;
  demoImageAlt: string;

  benefitsEyebrow: string;
  benefitsTitle: string;
  benefitsBody: string;
  benefitsStatusNote: string;
  platformPillars: PlatformPillar[];

  pricingEyebrow: string;
  pricingTitle: string;
  pricingBody: string;
  pricingPlanNames: Record<string, string>;
  pricingRenderLine: (renders: number) => string;
  pricingManagedLine: (renders: number) => string;
  pricingNote: string;
  pricingLink: string;

  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  proofButton: string;
  proofDisclaimer: string;
  proofJourneyLabel: string;
  proofJourneyStages: Item[];
  proofImageAlt: string;
  proofCaption: string;

  /* Render receipt card (replaces the old AiVisionFigure in #proof). */
  renderReceiptKicker: string;
  renderReceiptTitle: string;
  renderReceiptAlt: string;
  renderReceiptSourcePhotoLabel: string;
  renderReceiptSourcePhotoValue: string;
  renderReceiptSourceProductLabel: string;
  renderReceiptSourceProductValue: string;
  renderReceiptLine: string;
  renderReceiptBadge: string;

  testimonialsEyebrow: string;
  testimonialsTitle: string;
  testimonialsBody: string;
  testimonials: { quote: string; name: string; role: string; photo: string }[];

  integrationStateImplemented: string;
  integrationStateSetupRequired: string;
  integrationStateEvidenceRequired: string;
  integrationStatePlanned: string;
  integrationStateInfrastructure: string;

  platformEvidenceEyebrow: string;
  platformEvidenceTitle: string;
  platformEvidenceBody: string;
  platformEvidenceLabel: string;
  platformEvidenceItems: PlatformEvidenceItem[];

  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;

  footerTagline: string;
  footerHome: string;
  footerDemo: string;
  footerPricing: string;
  footerRoi: string;
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
  brandHome: 'GRINDCTRL home',
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  navHow: 'How it works',
  navDemo: 'Live demo',
  navBenefits: 'Why it matters',
  navProductGroup: 'Product',
  navProductShopping: 'AI Shopping',
  navProductConversations: 'Conversations',
  navProductOperations: 'Operations',
  navProductIntegrations: 'Integrations',
  navPricing: 'Pricing',
  signIn: 'Sign in',
  bookCall: 'Book a call',
  menu: 'Menu',
  closeMenu: 'Close menu',

  heroBadge: 'AI commerce for online stores',
  heroTitle: 'Turn every shopper signal into the next useful action.',
  heroSubtitle:
    'Start with virtual try-on, then explore how customer conversations, approved follow-up, workflows, and reporting can connect in English and Arabic.',
  heroPrimary: 'Try it yourself',
  heroSecondary: 'Book a call',
  heroChips: [
    'Built for Shopify',
    'Live try-on demo',
    'Arabic and English',
  ],
  heroRevealCaption: 'See it on before you buy',
  heroRevealAlt:
    'A cream ringer T-shirt appears on a shopper, showing how the garment looks when worn.',
  heroJourneyLabel: 'Illustrative connected journey',
  heroJourneyStages: ['Live try-on', 'Intent can be captured', 'Approved follow-up can run', 'Connected outcomes can be reported'],

  howEyebrow: 'Connected system',
  howTitle: 'One customer journey. One operating layer.',
  howBody:
    'This illustrative journey shows how a customer action can become useful context, support an approved next step, and contribute to a measurable outcome when the required systems are connected.',
  howMapColumns: ['Shopper', 'GrindCTRL', 'Business system'],
  howMapRows: [
    { shopper: 'Browses a product', grindctrl: 'Interest detected', business: 'Context prepared' },
    { shopper: 'Tries the product', grindctrl: 'Try-on generated', business: 'Interest signal recorded' },
    { shopper: 'Asks a question', grindctrl: 'Contextual answer prepared', business: 'Lead context enriched' },
    { shopper: 'Returns later', grindctrl: 'Approved follow-up can run', business: 'Journey continues' },
    { shopper: 'Places an order', grindctrl: 'Outcome captured where connected', business: 'Reporting can update' },
  ],

  demoEyebrow: 'Live demo',
  demoTitle: 'Try it on yourself, right now.',
  demoBody:
    'Open the live experience, choose the sample garment, and see the full shopper flow for yourself.',
  demoButton: 'Open the live try-on',
  demoNote: 'Bring a clear full-body or half-body photo. Processing time varies by image and provider availability.',
  demoPreviewLabel: 'AI render',
  demoImageAlt: 'Animation of a shopper photo being scanned and rendered into a virtual try-on',

  benefitsEyebrow: 'Platform pillars',
  benefitsTitle: 'Five capabilities. One customer journey.',
  benefitsBody:
    'GrindCTRL is being assembled as one operating layer across the storefront and the work that follows. Current maturity is shown instead of implied.',
  benefitsStatusNote: 'Status reflects current repository evidence, not confirmed deployment availability.',
  platformPillars: [
    {
      title: 'Shopping experiences',
      body: 'Virtual try-on and branded storefront entry points help shoppers understand products before checkout.',
      status: 'Implemented in source',
    },
    {
      title: 'Customer conversations',
      body: 'A configurable storefront assistant supports contextual customer questions and handoff paths.',
      status: 'Implemented in source',
    },
    {
      title: 'Lead handling',
      body: 'Customer and interest records exist, while scoring, ownership, and external CRM synchronization still need completion.',
      status: 'Foundation only',
    },
    {
      title: 'Operations',
      body: 'Workflow concepts and operator surfaces exist, but generalized production execution is not yet established.',
      status: 'Foundation only',
    },
    {
      title: 'Reporting',
      body: 'Journey and revenue attribution require a defined event model and verified commerce connections.',
      status: 'Planned layer',
    },
  ],

  pricingEyebrow: 'Pricing',
  pricingTitle: 'Start small, then scale with demand.',
  pricingBody:
    'Every plan includes a monthly render allowance. The managed tier adds setup and ongoing care.',
  pricingPlanNames: {
    'free-v1': 'Free',
    'launch-v1': 'Launch',
    'dfy-v1': 'Done-for-you',
  },
  pricingRenderLine: (renders) => `${renders} renders per month.`,
  pricingManagedLine: (renders) =>
    `${renders} renders per month, setup, and a monthly check-in.`,
  pricingNote: 'See the full comparison for plan terms, top-ups, and included service.',
  pricingLink: 'View full pricing',

  proofEyebrow: 'Beyond the render',
  proofTitle: 'The customer journey does not end when the image is generated.',
  proofBody:
    'Try-on can become the first useful signal in a wider customer journey. Explore how each later step works when consent, business rules, and required integrations are configured.',
  proofButton: 'Test the shopper flow',
  proofDisclaimer:
    'The try-on button opens the live shopper demo. The downstream journey shown here is illustrative and configuration-dependent.',
  proofJourneyLabel: 'Illustrative downstream journey',
  proofJourneyStages: [
    { title: 'Try-on', body: 'The shopper generates a product preview in the storefront experience.' },
    { title: 'Intent', body: 'A product interaction can become a useful interest signal.' },
    { title: 'Customer', body: 'With consent and identifiers, the signal can be associated with a new or existing customer profile.' },
    { title: 'Conversation', body: 'Relevant product context can support the next customer question.' },
    { title: 'CRM', body: 'Configured customer systems can receive the approved context needed by the team.' },
    { title: 'Follow-up', body: 'A follow-up can run only under approved business rules and consent.' },
    { title: 'Order', body: 'Where commerce events are connected, an attributable outcome can be captured.' },
    { title: 'Reporting', body: 'Configured reporting can show how the journey progressed and where it stopped.' },
  ],
  proofImageAlt: 'Animation of AI scanning a shopper photo and rendering the garment onto it',
  proofCaption: 'What the AI does to a shopper’s photo — the render step, not a mockup.',

  renderReceiptKicker: 'Render provenance',
  renderReceiptTitle: 'The result keeps its receipt.',
  renderReceiptAlt:
    'A customer photo and the selected product converge into a stable AI portrait with a matched render receipt.',
  renderReceiptSourcePhotoLabel: 'Source 01',
  renderReceiptSourcePhotoValue: 'Your photo',
  renderReceiptSourceProductLabel: 'Source 02',
  renderReceiptSourceProductValue: 'Selected product',
  renderReceiptLine: 'Source + product matched',
  renderReceiptBadge: 'AI render',

  testimonialsEyebrow: 'What clients say',
  testimonialsTitle: 'Merchant stories will appear here after sign-off.',
  testimonialsBody: 'This section stays hidden until verified customer quotes are approved.',
  testimonials: [],

  integrationStateImplemented: 'Implemented',
  integrationStateSetupRequired: 'Setup required',
  integrationStateEvidenceRequired: 'Evidence required',
  integrationStatePlanned: 'Planned',
  integrationStateInfrastructure: 'Infrastructure',

  platformEvidenceEyebrow: 'Platform evidence',
  platformEvidenceTitle: 'One operating sequence, with the maturity visible.',
  platformEvidenceBody:
    'See what exists in the product, what depends on configuration, and what still needs live verification before it is treated as deployed capability.',
  platformEvidenceLabel: 'Platform capability and evidence sequence',
  platformEvidenceItems: [
    {
      id: 'operations',
      kind: 'standard',
      title: 'Operations',
      body: 'Conversation handling, intents, job states, and audit trails exist in the product foundation. Generalized cross-channel execution is not presented as production-proven.',
      status: 'Foundation in source',
    },
    {
      id: 'automation',
      kind: 'standard',
      title: 'Automation',
      body: 'Approved rules can connect customer context to a next step. Each workflow still depends on its configured trigger, destination, credentials, and human approval boundary.',
      status: 'Configuration dependent',
    },
    {
      id: 'integrations',
      kind: 'integrations',
      title: 'Integrations',
      body: 'Every connection is labelled by depth: implemented, setup-required, evidence-required, planned, or infrastructure. A logo alone is never treated as proof of a live merchant connection.',
      status: 'Depth disclosed',
    },
    {
      id: 'managed-implementation',
      kind: 'standard',
      title: 'Managed implementation',
      body: 'Discovery, setup, brand matching, and ongoing care can be scoped with the merchant. The exact service boundary is agreed for the selected engagement.',
      status: 'Scoped per engagement',
    },
    {
      id: 'privacy-security',
      kind: 'standard',
      title: 'Privacy and security',
      body: 'Tenant scoping, explicit failure paths, and durable Shopify privacy processing exist in source. Legal approval, authenticated live journeys, and deployed-environment evidence remain separate release gates.',
      status: 'Local safeguards',
    },
  ],

  ctaTitle: 'Give shoppers a reason to feel sure before checkout.',
  ctaBody:
    'Book a call and we will map the try-on experience to your Shopify theme, catalog, and customer journey.',
  ctaButton: 'Book a call',

  footerTagline: 'AI commerce experiences for Shopify fashion stores.',
  footerHome: 'Home',
  footerDemo: 'Live demo',
  footerPricing: 'Pricing',
  footerRoi: 'ROI calculator',
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
  brandHome: 'الصفحة الرئيسية GRINDCTRL',
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  navHow: 'كيف تعمل',
  navDemo: 'تجربة مباشرة',
  navBenefits: 'لماذا تهم المتاجر',
  navProductGroup: 'المنتج',
  navProductShopping: 'التسوق بالذكاء الاصطناعي',
  navProductConversations: 'المحادثات',
  navProductOperations: 'العمليات',
  navProductIntegrations: 'التكاملات',
  navPricing: 'الأسعار',
  signIn: 'تسجيل الدخول',
  bookCall: 'احجز مكالمة',
  menu: 'القائمة',
  closeMenu: 'إغلاق القائمة',

  heroBadge: 'تجارة ذكية للمتاجر الإلكترونية',
  heroTitle: 'حوّل كل إشارة من المتسوق إلى الخطوة المفيدة التالية.',
  heroSubtitle:
    'ابدأ بالتجربة الافتراضية، ثم استكشف كيف يمكن ربط محادثات العملاء والمتابعة المعتمدة ومسارات العمل والتقارير بالعربية والإنجليزية.',
  heroPrimary: 'جرّبها بنفسك',
  heroSecondary: 'احجز مكالمة',
  heroChips: [
    'مصممة لمتاجر Shopify',
    'تجربة افتراضية مباشرة',
    'العربية والإنجليزية',
  ],
  heroRevealCaption: 'شاهدها عليك قبل الشراء',
  heroRevealAlt: 'تيشيرت رينجر كريمي يظهر على العميل ليوضح شكل القطعة أثناء ارتدائها.',
  heroJourneyLabel: 'رحلة مترابطة توضيحية',
  heroJourneyStages: ['تجربة افتراضية مباشرة', 'يمكن تسجيل الاهتمام', 'يمكن تشغيل متابعة معتمدة', 'يمكن إظهار النتائج عند الربط'],

  howEyebrow: 'نظام مترابط',
  howTitle: 'رحلة عميل واحدة. طبقة تشغيل واحدة.',
  howBody:
    'توضح هذه الرحلة كيف يمكن أن يتحوّل تصرف العميل إلى سياق مفيد، وأن يدعم خطوة تالية معتمدة، وأن يساهم في نتيجة قابلة للقياس عند ربط الأنظمة المطلوبة.',
  howMapColumns: ['المتسوق', 'GrindCTRL', 'نظام العمل'],
  howMapRows: [
    { shopper: 'يتصفح منتجاً', grindctrl: 'اكتشاف الاهتمام', business: 'تجهيز السياق' },
    { shopper: 'يجرّب المنتج', grindctrl: 'إنشاء التجربة الافتراضية', business: 'تسجيل إشارة الاهتمام' },
    { shopper: 'يطرح سؤالاً', grindctrl: 'تجهيز إجابة بالسياق', business: 'إثراء سياق العميل المحتمل' },
    { shopper: 'يعود لاحقاً', grindctrl: 'إمكانية تشغيل متابعة معتمدة', business: 'استمرار الرحلة' },
    { shopper: 'ينفّذ طلباً', grindctrl: 'تسجيل النتيجة عند الربط', business: 'إمكانية تحديث التقارير' },
  ],

  demoEyebrow: 'تجربة مباشرة',
  demoTitle: 'جرّبها على نفسك الآن.',
  demoBody:
    'افتح التجربة المباشرة، واختر القطعة التجريبية، وشاهد رحلة العميل كاملة بنفسك.',
  demoButton: 'افتح تجربة الملابس',
  demoNote: 'جهّز صورة واضحة لكامل الجسم أو نصفه. يختلف وقت المعالجة حسب الصورة وتوفر مزود الخدمة.',
  demoPreviewLabel: 'معاينة بالذكاء الاصطناعي',
  demoImageAlt: 'رسوم متحركة توضح مسح صورة العميل وتحويلها إلى معاينة افتراضية للملابس',

  benefitsEyebrow: 'ركائز المنصة',
  benefitsTitle: 'خمس قدرات. رحلة عميل واحدة.',
  benefitsBody:
    'يجري بناء GrindCTRL كطبقة تشغيل واحدة تجمع واجهة المتجر والعمل الذي يليها. نعرض مستوى النضج الحالي بدلاً من الإيحاء به.',
  benefitsStatusNote: 'تعكس الحالة أدلة المستودع الحالية، وليست تأكيداً لتوفر النشر الفعلي.',
  platformPillars: [
    {
      title: 'تجارب التسوق',
      body: 'تساعد التجربة الافتراضية ومداخل المتجر المتناسقة مع الهوية العميل على فهم المنتج قبل الدفع.',
      status: 'منفذة في المصدر',
    },
    {
      title: 'محادثات العملاء',
      body: 'يدعم مساعد واجهة المتجر القابل للتهيئة أسئلة العملاء المرتبطة بالسياق ومسارات التحويل.',
      status: 'منفذة في المصدر',
    },
    {
      title: 'إدارة العملاء المحتملين',
      body: 'توجد سجلات العملاء والاهتمام، بينما لا يزال التقييم والملكية والمزامنة الخارجية بحاجة إلى استكمال.',
      status: 'أساس فقط',
    },
    {
      title: 'العمليات',
      body: 'توجد مفاهيم لمسارات العمل وواجهات للمشغل، لكن التنفيذ الإنتاجي العام لم يثبت بعد.',
      status: 'أساس فقط',
    },
    {
      title: 'التقارير',
      body: 'يتطلب إسناد رحلة العميل والإيرادات نموذج أحداث محدداً وروابط تجارة موثقة.',
      status: 'طبقة مخططة',
    },
  ],

  pricingEyebrow: 'الأسعار',
  pricingTitle: 'ابدأ بحجم صغير ثم توسع مع الطلب.',
  pricingBody:
    'تتضمن كل خطة عددًا شهريًا من المعاينات. وتضيف خطة الإدارة الكاملة الإعداد والمتابعة المستمرة.',
  /* Must stay identical to the names in components/pricing/pricing-copy.ts.
     This dictionary feeds the pricing section on the home page; that one feeds
     the /pricing page. Two Arabic names for one plan is worse than the English
     they replaced, so these are copied from there rather than reinvented. */
  pricingPlanNames: {
    'free-v1': 'مجاني',
    'launch-v1': 'انطلاق',
    'dfy-v1': 'خدمة متكاملة',
  },
  pricingRenderLine: (renders) => `${renders} معاينة شهريًا.`,
  pricingManagedLine: (renders) =>
    `${renders} معاينة شهريًا، مع الإعداد ومراجعة شهرية.`,
  pricingNote: 'شاهد المقارنة الكاملة لمعرفة شروط الخطط والباقات الإضافية والخدمة المتضمنة.',
  pricingLink: 'شاهد الأسعار كاملة',

  proofEyebrow: 'ما بعد المعاينة',
  proofTitle: 'رحلة العميل لا تنتهي عند إنشاء الصورة.',
  proofBody:
    'يمكن أن تصبح التجربة الافتراضية أول إشارة مفيدة في رحلة عميل أوسع. استكشف ما يحدث في كل خطوة لاحقة عند إعداد الموافقات وقواعد العمل والتكاملات المطلوبة.',
  proofButton: 'جرّب رحلة العميل',
  proofDisclaimer:
    'يفتح الزر تجربة المتسوق المباشرة. أما الرحلة اللاحقة المعروضة هنا فتوضيحية وتعتمد على الإعداد.',
  proofJourneyLabel: 'رحلة لاحقة توضيحية',
  proofJourneyStages: [
    { title: 'التجربة', body: 'ينشئ المتسوق معاينة للمنتج داخل تجربة واجهة المتجر.' },
    { title: 'الاهتمام', body: 'يمكن أن يتحول التفاعل مع المنتج إلى إشارة اهتمام مفيدة.' },
    { title: 'العميل', body: 'عند وجود الموافقة والمعرّفات، يمكن ربط الإشارة بملف عميل جديد أو موجود.' },
    { title: 'المحادثة', body: 'يمكن أن يساعد سياق المنتج المناسب في الإجابة عن سؤال العميل التالي.' },
    { title: 'CRM', body: 'يمكن لأنظمة العملاء المهيأة استقبال السياق المعتمد الذي يحتاجه الفريق.' },
    { title: 'المتابعة', body: 'لا تعمل المتابعة إلا وفق قواعد العمل المعتمدة وموافقة العميل.' },
    { title: 'الطلب', body: 'عند ربط أحداث التجارة، يمكن تسجيل نتيجة قابلة للإسناد.' },
    { title: 'التقارير', body: 'يمكن للتقارير المهيأة إظهار تقدم الرحلة والنقطة التي توقفت عندها.' },
  ],
  proofImageAlt: 'رسوم متحركة توضح مسح الذكاء الاصطناعي لصورة العميل وعرض القطعة عليها',
  proofCaption: 'هذا ما يفعله الذكاء الاصطناعي بصورة العميل — خطوة المعاينة الفعلية، وليست نموذجًا.',

  renderReceiptKicker: 'مصدر النتيجة',
  renderReceiptTitle: 'لكل نتيجة إيصالها.',
  renderReceiptAlt:
    'صورة العميل والمنتج المختار يندمجان في معاينة ذكاء اصطناعي مستقرة، مع إيصال يوثّق تطابقهما.',
  renderReceiptSourcePhotoLabel: 'المصدر 1',
  renderReceiptSourcePhotoValue: 'صورتك',
  renderReceiptSourceProductLabel: 'المصدر 2',
  renderReceiptSourceProductValue: 'المنتج المختار',
  renderReceiptLine: 'تطابق المصدر والمنتج',
  renderReceiptBadge: 'معاينة بالذكاء الاصطناعي',

  testimonialsEyebrow: 'آراء العملاء',
  testimonialsTitle: 'ستظهر قصص المتاجر هنا بعد اعتمادها.',
  testimonialsBody: 'يبقى هذا القسم مخفيًا حتى اعتماد اقتباسات موثقة من العملاء.',
  testimonials: [],

  integrationStateImplemented: 'مطبق',
  integrationStateSetupRequired: 'يتطلب إعدادًا',
  integrationStateEvidenceRequired: 'يتطلب دليلاً',
  integrationStatePlanned: 'مخطط له',
  integrationStateInfrastructure: 'بنية تحتية',

  platformEvidenceEyebrow: 'أدلة المنصة',
  platformEvidenceTitle: 'مسار تشغيل واحد، ومستوى النضج ظاهر بوضوح.',
  platformEvidenceBody:
    'اطّلع على ما هو موجود في المنتج، وما يعتمد على الإعداد، وما يحتاج إلى تحقق فعلي قبل اعتباره قدرة منشورة.',
  platformEvidenceLabel: 'تسلسل قدرات المنصة وأدلتها',
  platformEvidenceItems: [
    {
      id: 'operations',
      kind: 'standard',
      title: 'العمليات',
      body: 'توجد في أساس المنتج إدارة المحادثات والنوايا وحالات المهام وسجلات التدقيق. ولا نقدّم التنفيذ العام عبر القنوات على أنه مثبت في الإنتاج.',
      status: 'أساس موجود في المصدر',
    },
    {
      id: 'automation',
      kind: 'standard',
      title: 'الأتمتة',
      body: 'يمكن للقواعد المعتمدة ربط سياق العميل بالخطوة التالية. ويظل كل مسار معتمداً على المشغّل والوجهة وبيانات الاعتماد وحدود الموافقة البشرية التي تم إعدادها.',
      status: 'تعتمد على الإعداد',
    },
    {
      id: 'integrations',
      kind: 'integrations',
      title: 'التكاملات',
      body: 'يظهر عمق كل اتصال بوضوح: مطبق، أو يتطلب إعداداً، أو مخطط له، أو ضمن البنية التحتية. ولا يُعد الشعار وحده دليلاً على اتصال فعلي لمتجر.',
      status: 'عمق الاتصال موضح',
    },
    {
      id: 'managed-implementation',
      kind: 'standard',
      title: 'التنفيذ المُدار',
      body: 'يمكن تحديد نطاق الاستكشاف والإعداد ومواءمة الهوية والرعاية المستمرة مع المتجر. ويُتفق على حدود الخدمة الدقيقة لكل تعاقد.',
      status: 'يُحدد لكل تعاقد',
    },
    {
      id: 'privacy-security',
      kind: 'standard',
      title: 'الخصوصية والأمان',
      body: 'توجد في المصدر ضوابط نطاق المستأجر ومسارات الفشل الصريحة والمعالجة الدائمة لطلبات خصوصية Shopify. وتبقى الموافقات القانونية والرحلات الفعلية الموثقة وأدلة بيئة النشر بوابات إصدار منفصلة.',
      status: 'ضوابط محلية',
    },
  ],

  ctaTitle: 'امنح عملاءك سببًا للثقة قبل إتمام الشراء.',
  ctaBody:
    'احجز مكالمة وسنحدد كيف تتكامل تجربة الملابس مع قالب Shopify والكتالوج ورحلة عملائك.',
  ctaButton: 'احجز مكالمة',

  footerTagline: 'تجارب تجارة بالذكاء الاصطناعي لمتاجر الأزياء على Shopify.',
  footerHome: 'الرئيسية',
  footerDemo: 'تجربة مباشرة',
  footerPricing: 'الأسعار',
  footerRoi: 'حاسبة العائد',
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
