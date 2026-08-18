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

interface LandingDict {
  brandHome: string;
  langToggleLabel: string;
  langSwitchTo: string;

  navHow: string;
  navDemo: string;
  navBenefits: string;
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

  howEyebrow: string;
  howTitle: string;
  howBody: string;
  howSteps: Item[];

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
  returnBenefitLabel: string;
  returnBenefitTitle: string;
  returnBenefitBody: string;
  confidenceBenefitLabel: string;
  confidenceBenefitTitle: string;
  confidenceBenefitBody: string;
  merchantFeatures: Item[];

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

  integrationsEyebrow: string;
  integrationsTitle: string;
  integrations: string[];

  otherEyebrow: string;
  otherTitle: string;
  otherBody: string;
  otherItems: string[];
  /* Tools the automation work actually runs on. Rendered as brand chips. */
  opsStack: string[];

  /* Ops chain card, sits beside the otherItems list. */
  opsChainKicker: string;
  opsChainTitle: string;
  opsChainAlt: string;
  opsChainLiveLabel: string;
  /* Exactly 4: Capture, Act, Check, Log. title carries the "01 · " prefix. */
  opsChainSteps: Item[];
  opsChainFootStrong: string;
  opsChainFootRest: string;

  /* Messaging channels card, sits beside the ops chain card. */
  messagingKicker: string;
  messagingTitle: string;
  messagingAlt: string;
  messagingReplyLabel: string;
  messagingReplyText: string;
  messagingStatusReplied: string;
  messagingStatusDetail: string;
  messagingFootStrong: string;
  messagingFootRest: string;

  automationsEyebrow: string;
  automationsTitle: string;
  automationsBody: string;
  /* Exactly 3: the bar something had to clear before it appeared below. */
  automationsQualifiers: string[];
  automationsStatMessages: string;
  automationsStatLeads: string;
  automationsStatAutomations: string;
  automationsStatResponse: string;
  /* Exactly 4, matching CARDS order in automations-showcase.tsx: WhatsApp,
     operations, leads, inbox. */
  automationsCards: { label: string; caption: string }[];

  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;

  footerTagline: string;
  footerHome: string;
  footerDemo: string;
  footerPricing: string;
}

const en: LandingDict = {
  brandHome: 'GRINDCTRL home',
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  navHow: 'How it works',
  navDemo: 'Live demo',
  navBenefits: 'Why it matters',
  navPricing: 'Pricing',
  signIn: 'Sign in',
  bookCall: 'Book a call',
  menu: 'Menu',
  closeMenu: 'Close menu',

  heroBadge: 'AI systems for online stores, built and run for you',
  heroTitle: 'Let shoppers see it on themselves before they buy.',
  heroSubtitle:
    'Virtual try-on is where most stores start with us. From there we build the rest: shopper support, follow-up, and the repeat work behind the scenes. We set it up, run it, and keep it working in English and Arabic.',
  heroPrimary: 'Book a call',
  heroSecondary: 'Try it yourself',
  heroChips: [
    'Built for Shopify',
    'Managed setup',
    'Arabic and English',
  ],
  heroRevealCaption: 'See it on before you buy',
  heroRevealAlt:
    'A cream ringer T-shirt appears on a shopper, showing how the garment looks when worn.',

  howEyebrow: 'How it works',
  howTitle: 'From product page to a more confident cart.',
  howBody:
    'The experience stays close to the shopping journey, with no detour into a separate app.',
  howSteps: [
    {
      title: 'Shopper opens a product',
      body: 'The try-on action appears on product pages and collection grids as they browse.',
    },
    {
      title: 'They upload a photo',
      body: 'A short, private flow guides them to add a clear full-body or half-body photo.',
    },
    {
      title: 'They see it, then shop',
      body: 'The preview shows the item on their photo and brings them back to add it to cart.',
    },
  ],

  demoEyebrow: 'Live demo',
  demoTitle: 'Try it on yourself, right now.',
  demoBody:
    'Open the live experience, choose the sample garment, and see the full shopper flow for yourself.',
  demoButton: 'Open the live try-on',
  demoNote: 'Bring a clear full-body or half-body photo. A preview takes about 9 seconds.',
  demoPreviewLabel: 'AI render',
  demoImageAlt: 'Animation of a shopper photo being scanned and rendered into a virtual try-on',

  benefitsEyebrow: 'Why merchants care',
  benefitsTitle: 'Give shoppers more certainty without changing how they shop.',
  benefitsBody:
    'The try-on sits inside your storefront, follows your brand, and supports the moments where purchase decisions happen.',
  returnBenefitLabel: 'Fewer avoidable returns',
  returnBenefitTitle: 'Less guessing after delivery.',
  returnBenefitBody:
    'A visual preview can help reduce returns caused by shoppers feeling unsure about how a garment will look on them.',
  confidenceBenefitLabel: 'More confidence',
  confidenceBenefitTitle: 'A clearer decision before checkout.',
  confidenceBenefitBody:
    'Shoppers can picture the product on themselves while purchase intent is still high.',
  merchantFeatures: [
    {
      title: 'Product pages and collection grids',
      body: 'The try-on entry point can appear where shoppers view one item or compare many.',
    },
    {
      title: 'Native to Shopify',
      body: 'The experience works with the storefront journey and returns shoppers to the product and cart.',
    },
    {
      title: 'Matched to your brand',
      body: 'Colors, corner radius, labels, and calls to action are tuned to feel at home in your store.',
    },
    {
      title: 'Arabic and English',
      body: 'Shopper-facing copy and direction adapt for both RTL and LTR storefronts.',
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

  proofEyebrow: 'Product proof',
  proofTitle: 'Built for the storefront, managed behind the scenes.',
  proofBody:
    'The shopper sees a simple visual flow. GrindCTRL handles configuration, brand matching, monitoring, and ongoing care.',
  proofButton: 'Test the shopper flow',
  proofDisclaimer:
    'This animation illustrates the render step. It is not a customer testimonial or a performance claim.',
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

  integrationsEyebrow: 'Storefront fit',
  integrationsTitle: 'Made for the Shopify surfaces that matter.',
  integrations: [
    'Shopify',
    'Product pages',
    'Collection grids',
    'Theme editor',
    'Storefront API',
    'Gemini',
  ],

  otherEyebrow: 'AI operations',
  otherTitle: 'Try-on sells the product. The rest of the AI runs the business.',
  otherBody:
    'Try-on is the storefront. Behind it we build and run the operations layer: shopper support that answers in Arabic and English, leads captured and routed the moment they land, orders and follow-up handled without anyone retyping them, and reporting that arrives on its own. Same team, same dashboard.',
  otherItems: [
    'AI customer support across WhatsApp, Instagram, and web chat',
    'Lead capture, scoring, and routing into your CRM',
    'Order and follow-up automation',
    'Document and back-office workflows',
    'Reporting that builds itself',
  ],
  opsStack: [
    'WhatsApp',
    'Instagram',
    'Telegram',
    'Zapier',
    'Make',
    'n8n',
    'Gemini',
    'Claude',
    'Notion',
    'HubSpot',
    'Supabase',
  ],

  opsChainKicker: 'Managed operations',
  opsChainTitle: 'Nothing disappears into a black box.',
  opsChainAlt:
    'A continuous operations path captures a request, runs the automation, checks the outcome, and logs it to the dashboard.',
  opsChainLiveLabel: 'Control live',
  opsChainSteps: [
    { title: '01 · Capture', body: 'Request received' },
    { title: '02 · Act', body: 'Automation runs' },
    { title: '03 · Check', body: 'Outcome verified' },
    { title: '04 · Log', body: 'Dashboard updated' },
  ],
  opsChainFootStrong: 'Handled end to end.',
  opsChainFootRest: 'Visible to you.',

  messagingKicker: 'One operating voice',
  messagingTitle: 'Every inbox follows the same rules.',
  messagingAlt:
    'One governed AI response is delivered consistently across WhatsApp, Instagram, and Facebook.',
  messagingReplyLabel: 'AI reply · approved tone',
  messagingReplyText: 'Yes, it is available. Would you like me to reserve it for you?',
  messagingStatusReplied: 'Replied',
  messagingStatusDetail: 'Tone checked',
  messagingFootStrong: 'Same rules. Same tone.',
  messagingFootRest: 'Every channel.',

  automationsEyebrow: 'Real automations',
  automationsTitle: 'Not mockups. What actually runs today.',
  automationsBody:
    'Every screen below is a live GrindCTRL account — the same automations we build behind your try-on. Nothing made this page unless it cleared three bars.',
  automationsQualifiers: [
    'Runs without a person watching it',
    'Working on real customer conversations',
    'Reports its own results',
  ],
  automationsStatMessages: 'Messages handled',
  automationsStatLeads: 'Leads captured',
  automationsStatAutomations: 'Automations live',
  automationsStatResponse: 'Avg. response time',
  automationsCards: [
    {
      label: 'WhatsApp automation',
      caption: 'Reads intent, drafts the reply, tags the lead — before a person opens the chat.',
    },
    {
      label: 'Live operations',
      caption: '1,284 runs this week. 92% finished with nobody watching.',
    },
    {
      label: 'Lead pipeline',
      caption: 'Every lead sorted and staged the moment it lands.',
    },
    {
      label: 'Unified inbox',
      caption: 'One inbox for every channel a customer messages from.',
    },
  ],

  ctaTitle: 'Give shoppers a reason to feel sure before checkout.',
  ctaBody:
    'Book a call and we will map the try-on experience to your Shopify theme, catalog, and customer journey.',
  ctaButton: 'Book a call',

  footerTagline: 'Managed AI virtual try-on for Shopify fashion stores.',
  footerHome: 'Home',
  footerDemo: 'Live demo',
  footerPricing: 'Pricing',
};

const ar: LandingDict = {
  brandHome: 'الصفحة الرئيسية GRINDCTRL',
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  navHow: 'كيف تعمل',
  navDemo: 'تجربة مباشرة',
  navBenefits: 'لماذا تهم المتاجر',
  navPricing: 'الأسعار',
  signIn: 'تسجيل الدخول',
  bookCall: 'احجز مكالمة',
  menu: 'القائمة',
  closeMenu: 'إغلاق القائمة',

  heroBadge: 'أنظمة ذكاء اصطناعي للمتاجر الإلكترونية، نبنيها ونشغّلها لك',
  heroTitle: 'دع عملاءك يرون القطعة عليهم قبل الشراء.',
  heroSubtitle:
    'التجربة الافتراضية هي نقطة البداية مع معظم المتاجر. بعدها نبني الباقي: خدمة العملاء، والمتابعة، والمهام المتكررة خلف الكواليس. نتولى الإعداد والتشغيل والمتابعة بالعربية والإنجليزية.',
  heroPrimary: 'احجز مكالمة',
  heroSecondary: 'جرّبها بنفسك',
  heroChips: [
    'مصممة لمتاجر Shopify',
    'إعداد وإدارة بالكامل',
    'العربية والإنجليزية',
  ],
  heroRevealCaption: 'شاهدها عليك قبل الشراء',
  heroRevealAlt: 'تيشيرت رينجر كريمي يظهر على العميل ليوضح شكل القطعة أثناء ارتدائها.',

  howEyebrow: 'كيف تعمل',
  howTitle: 'من صفحة المنتج إلى سلة شراء بثقة أكبر.',
  howBody:
    'تبقى التجربة داخل رحلة التسوق نفسها دون تحويل العميل إلى تطبيق منفصل.',
  howSteps: [
    {
      title: 'يفتح العميل منتجًا',
      body: 'يظهر زر التجربة في صفحات المنتجات وشبكات المجموعات أثناء التصفح.',
    },
    {
      title: 'يرفع صورته',
      body: 'توجهه خطوات قصيرة وخاصة لرفع صورة واضحة لكامل الجسم أو نصفه.',
    },
    {
      title: 'يرى القطعة ثم يشتري',
      body: 'تظهر المعاينة القطعة على صورته ثم تعيده إلى المنتج لإضافته إلى السلة.',
    },
  ],

  demoEyebrow: 'تجربة مباشرة',
  demoTitle: 'جرّبها على نفسك الآن.',
  demoBody:
    'افتح التجربة المباشرة، واختر القطعة التجريبية، وشاهد رحلة العميل كاملة بنفسك.',
  demoButton: 'افتح تجربة الملابس',
  demoNote: 'جهّز صورة واضحة لكامل الجسم أو نصفه. تستغرق المعاينة نحو 9 ثوانٍ.',
  demoPreviewLabel: 'معاينة بالذكاء الاصطناعي',
  demoImageAlt: 'رسوم متحركة توضح مسح صورة العميل وتحويلها إلى معاينة افتراضية للملابس',

  benefitsEyebrow: 'لماذا تهم المتاجر',
  benefitsTitle: 'امنح العملاء وضوحًا أكبر دون تغيير طريقة تسوقهم.',
  benefitsBody:
    'تعمل التجربة داخل واجهة متجرك، وتتبع هويتك، وتظهر في اللحظات التي يتخذ فيها العميل قرار الشراء.',
  returnBenefitLabel: 'مرتجعات أقل يمكن تجنبها',
  returnBenefitTitle: 'تخمين أقل بعد الاستلام.',
  returnBenefitBody:
    'يمكن للمعاينة البصرية أن تساعد في تقليل المرتجعات الناتجة عن تردد العميل بشأن شكل القطعة عليه.',
  confidenceBenefitLabel: 'ثقة أكبر',
  confidenceBenefitTitle: 'قرار أوضح قبل الدفع.',
  confidenceBenefitBody:
    'يستطيع العميل تصور المنتج عليه بينما لا تزال رغبته في الشراء مرتفعة.',
  merchantFeatures: [
    {
      title: 'صفحات المنتجات وشبكات المجموعات',
      body: 'يمكن أن يظهر مدخل التجربة عند مشاهدة منتج واحد أو مقارنة عدة منتجات.',
    },
    {
      title: 'متكاملة مع Shopify',
      body: 'تعمل التجربة مع رحلة المتجر وتعيد العميل إلى المنتج والسلة.',
    },
    {
      title: 'متناسقة مع علامتك',
      body: 'نضبط الألوان والزوايا والنصوص وأزرار الإجراء لتبدو جزءًا طبيعيًا من متجرك.',
    },
    {
      title: 'العربية والإنجليزية',
      body: 'تتكيف النصوص والاتجاهات الظاهرة للعميل مع واجهات RTL وLTR.',
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

  proofEyebrow: 'دليل المنتج',
  proofTitle: 'مصممة لواجهة المتجر، ومدارة بالكامل خلف الكواليس.',
  proofBody:
    'يرى العميل خطوات بصرية بسيطة، بينما يتولى GrindCTRL الإعداد وتنسيق الهوية والمراقبة والمتابعة المستمرة.',
  proofButton: 'جرّب رحلة العميل',
  proofDisclaimer:
    'هذه الرسوم المتحركة توضح خطوة المعاينة، وليست شهادة عميل أو ادعاءً بشأن الأداء.',
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

  integrationsEyebrow: 'تكامل واجهة المتجر',
  integrationsTitle: 'مصممة لأهم نقاط التفاعل في Shopify.',
  integrations: [
    'Shopify',
    'صفحات المنتجات',
    'شبكات المجموعات',
    'محرر القالب',
    'Storefront API',
    'Gemini',
  ],

  otherEyebrow: 'تشغيل بالذكاء الاصطناعي',
  otherTitle: 'التجربة الافتراضية تبيع المنتج. وباقي الذكاء الاصطناعي يدير العمل.',
  otherBody:
    'التجربة الافتراضية هي الواجهة. وخلفها نبني ونشغّل طبقة العمليات: خدمة عملاء ترد بالعربية والإنجليزية، وعملاء محتملون يُلتقطون ويُوجّهون فور وصولهم، وطلبات ومتابعة تُدار دون إعادة إدخال يدوي، وتقارير تصل من تلقاء نفسها. الفريق نفسه واللوحة نفسها.',
  otherItems: [
    'دعم عملاء بالذكاء الاصطناعي عبر واتساب وإنستغرام والدردشة',
    'جمع العملاء المحتملين وتقييمهم وتوجيههم إلى نظامك',
    'أتمتة الطلبات والمتابعة',
    'أتمتة المستندات والأعمال الخلفية',
    'تقارير تُبنى تلقائيًا',
  ],
  opsStack: [
    'WhatsApp',
    'Instagram',
    'Telegram',
    'Zapier',
    'Make',
    'n8n',
    'Gemini',
    'Claude',
    'Notion',
    'HubSpot',
    'Supabase',
  ],

  opsChainKicker: 'عمليات مُدارة',
  opsChainTitle: 'لا شيء يختفي في صندوق أسود.',
  opsChainAlt:
    'مسار عمليات متواصل يستقبل الطلب، يشغّل الأتمتة، يتحقق من النتيجة، ثم يسجّلها في لوحة التحكم.',
  opsChainLiveLabel: 'التحكم مباشر',
  opsChainSteps: [
    { title: '01 · استقبال', body: 'تم استلام الطلب' },
    { title: '02 · تنفيذ', body: 'الأتمتة تعمل' },
    { title: '03 · تحقق', body: 'تم التأكد من النتيجة' },
    { title: '04 · تسجيل', body: 'تم تحديث اللوحة' },
  ],
  opsChainFootStrong: 'تُدار من البداية للنهاية.',
  opsChainFootRest: 'وتظهر لك بالكامل.',

  messagingKicker: 'صوت واحد موحّد',
  messagingTitle: 'كل صندوق وارد يتبع القواعد نفسها.',
  messagingAlt:
    'رد واحد من الذكاء الاصطناعي يصل بثبات عبر واتساب وإنستغرام وفيسبوك.',
  messagingReplyLabel: 'رد الذكاء الاصطناعي · بأسلوب معتمد',
  messagingReplyText: 'نعم، متوفر. هل تحب أن أحجزه لك؟',
  messagingStatusReplied: 'تم الرد',
  messagingStatusDetail: 'تم ضبط الأسلوب',
  messagingFootStrong: 'القواعد نفسها. الأسلوب نفسه.',
  messagingFootRest: 'في كل قناة.',

  automationsEyebrow: 'أتمتة حقيقية',
  automationsTitle: 'ليست نماذج تجريبية. هذا ما يعمل فعليًا اليوم.',
  automationsBody:
    'كل شاشة أدناه من حساب GrindCTRL حقيقي وفعّال — نفس الأتمتة التي نبنيها خلف تجربة الملابس لديك. لا تظهر أي أتمتة هنا إلا إذا اجتازت ثلاثة شروط.',
  automationsQualifiers: [
    'تعمل دون إشراف بشري',
    'تتعامل مع محادثات عملاء حقيقية',
    'تُصدر تقاريرها بنفسها',
  ],
  automationsStatMessages: 'رسالة تمت معالجتها',
  automationsStatLeads: 'عميل محتمل تم جمعه',
  automationsStatAutomations: 'أتمتة نشطة',
  automationsStatResponse: 'متوسط زمن الاستجابة',
  automationsCards: [
    {
      label: 'أتمتة واتساب',
      caption: 'يقرأ النية، يصيغ الرد، ويصنّف العميل المحتمل — قبل أن يفتح أي موظف المحادثة.',
    },
    {
      label: 'العمليات المباشرة',
      caption: '1,284 عملية هذا الأسبوع. اكتمل 92٪ منها دون مراقبة أحد.',
    },
    {
      label: 'مسار العملاء المحتملين',
      caption: 'يُصنَّف كل عميل محتمل ويُوجَّه لحظة وصوله.',
    },
    {
      label: 'صندوق وارد موحّد',
      caption: 'صندوق واحد لكل قناة قد يراسل منها العميل.',
    },
  ],

  ctaTitle: 'امنح عملاءك سببًا للثقة قبل إتمام الشراء.',
  ctaBody:
    'احجز مكالمة وسنحدد كيف تتكامل تجربة الملابس مع قالب Shopify والكتالوج ورحلة عملائك.',
  ctaButton: 'احجز مكالمة',

  footerTagline: 'تجربة ملابس افتراضية مدارة لمتاجر الأزياء على Shopify.',
  footerHome: 'الرئيسية',
  footerDemo: 'تجربة مباشرة',
  footerPricing: 'الأسعار',
};

export const LANDING_DICTIONARIES: Record<SiteLocale, LandingDict> = { en, ar };
export type LandingTranslator = LandingDict;

export function getLandingDictionary(locale: SiteLocale): LandingDict {
  return LANDING_DICTIONARIES[locale] ?? en;
}
