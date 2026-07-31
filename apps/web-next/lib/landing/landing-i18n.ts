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
  demoPreviewLabel: 'Example result',
  demoImageAlt: 'Example virtual try-on result for the cream ringer T-shirt',

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
    'The image is an example preview. It is not a customer testimonial or a performance claim.',
  proofImageAlt: 'Example shopper wearing the cream ringer T-shirt in a virtual try-on preview',
  proofCaption: 'Example virtual try-on result using a sample shopper photo.',

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
  demoPreviewLabel: 'نتيجة توضيحية',
  demoImageAlt: 'نتيجة توضيحية لتجربة تيشيرت رينجر الكريمي افتراضيًا',

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
  pricingPlanNames: {
    'free-v1': 'Free',
    'launch-v1': 'Launch',
    'dfy-v1': 'Done-for-you',
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
    'هذه الصورة معاينة توضيحية، وليست شهادة عميل أو ادعاءً بشأن الأداء.',
  proofImageAlt: 'مثال لعميل يرتدي تيشيرت رينجر الكريمي في معاينة افتراضية',
  proofCaption: 'نتيجة توضيحية لتجربة الملابس باستخدام صورة عميل تجريبية.',

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
