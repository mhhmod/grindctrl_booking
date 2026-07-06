/* ─── GrindCTRL landing — lightweight i18n (en / ar) ─── */

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
  navAutomate: string;
  navProof: string;
  navClients: string;
  navDemo: string;
  signIn: string;
  bookCall: string;

  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimary: string;
  heroSecondary: string;
  heroChips: string[];
  heroFrameCaption: string;

  howEyebrow: string;
  howTitle: string;
  howSteps: Item[];

  automateEyebrow: string;
  automateTitle: string;
  automateBody: string;
  automateItems: Item[];

  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  proofCaptions: string[];
  proofPlaceholder: string;

  testimonialsEyebrow: string;
  testimonialsTitle: string;
  testimonialsBody: string;
  testimonials: { quote: string; name: string; role: string; photo: string }[];

  integrationsEyebrow: string;
  integrationsTitle: string;
  integrations: string[];

  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  ctaTrust: string;

  footerTagline: string;
  footerHome: string;
  footerDemo: string;
  footerDashboard: string;
  footerRights: string;
}

const en: LandingDict = {
  brandHome: 'GRINDCTRL home',
  langToggleLabel: 'Change language',
  langSwitchTo: 'العربية',

  navHow: 'How it works',
  navAutomate: 'What we automate',
  navProof: 'Proof',
  navClients: 'Clients',
  navDemo: 'Live demo',
  signIn: 'Sign in',
  bookCall: 'Book a call',

  heroBadge: 'Done-for-you AI automation',
  heroTitle: 'We build, run, and maintain your AI.',
  heroSubtitle:
    'GrindCTRL designs your AI automations, runs them in production, and keeps them healthy, while you watch and control everything from one dashboard.',
  heroPrimary: 'Book a call',
  heroSecondary: 'See it live',
  heroChips: [
    'Support & service',
    'Leads & CRM',
    'Files & voice',
    'WhatsApp follow-up',
    'Live dashboard',
  ],
  heroFrameCaption: 'Your operations, live in one dashboard',

  howEyebrow: 'How it works',
  howTitle: 'You bring the business. We bring the automation.',
  howSteps: [
    {
      title: 'We build it',
      body: 'We map your workflows and build the AI automations around the tools you already use.',
    },
    {
      title: 'We run & maintain it',
      body: 'Your automations run in production. We monitor, fix, and improve them so they keep working.',
    },
    {
      title: 'You stay in control',
      body: 'Watch every workflow, lead, and conversation from one dashboard. Full visibility, no black box.',
    },
  ],

  automateEyebrow: 'What we automate',
  automateTitle: 'AI that handles the work your team repeats.',
  automateBody:
    'Across text, voice, images, files, and your existing tools, we turn everyday operations into automated workflows.',
  automateItems: [
    {
      title: 'AI customer support',
      body: 'Answer, classify, and route customer messages, with human handoff when it matters.',
    },
    {
      title: 'Lead capture & CRM',
      body: 'Capture, score, and sync leads into your CRM, then follow up automatically.',
    },
    {
      title: 'Files & documents',
      body: 'Read invoices, contracts, and screenshots and turn them into structured records.',
    },
    {
      title: 'Voice & WhatsApp',
      body: 'Handle voice notes and WhatsApp conversations end to end.',
    },
    {
      title: 'Dashboards & monitoring',
      body: 'See runs, performance, and outcomes live, with alerts when something needs you.',
    },
    {
      title: 'System maintenance',
      body: 'We keep the whole system running: updates, fixes, and improvements over time.',
    },
  ],

  proofEyebrow: 'Proof',
  proofTitle: 'Real systems, running in production.',
  proofBody:
    'Not slideware. These are the dashboards and automations we build and operate for businesses.',
  proofCaptions: [
    'Operations dashboard',
    'WhatsApp automation in action',
    'Lead pipeline & follow-up',
    'Conversations inbox',
  ],
  proofPlaceholder: 'Screens from the GrindCTRL platform.',

  testimonialsEyebrow: 'What clients say',
  testimonialsTitle: 'Businesses that let GrindCTRL run the busywork.',
  testimonialsBody:
    'Real teams using GrindCTRL to answer customers, capture leads, and stay in control.',
  testimonials: [
    {
      quote:
        'Our WhatsApp inquiries used to sit for hours. Now replies go out instantly and the right leads reach my sales team the same minute.',
      name: 'Mohammed A.',
      role: 'Founder, Cairo Apparel',
      photo: '/landing/testimonials/person-1.png',
    },
    {
      quote:
        'We captured 3x more leads in the first month without adding headcount. The dashboard shows me exactly what is happening.',
      name: 'Sara K.',
      role: 'Operations Lead, GulfMart',
      photo: '/landing/testimonials/person-2.png',
    },
    {
      quote:
        'They built it, they run it, and they keep it healthy. I just watch the results come in.',
      name: 'Omar H.',
      role: 'Owner, Riyadh Electronics',
      photo: '/landing/testimonials/person-3.png',
    },
    {
      quote:
        'Customer support that never sleeps. Our response time dropped from hours to seconds.',
      name: 'Lina T.',
      role: 'Marketing Director, BeautyBox',
      photo: '/landing/testimonials/person-4.png',
    },
    {
      quote:
        'File and order intake that used to take my team all morning is now automatic and accurate.',
      name: 'Khaled S.',
      role: 'CEO, LogiServe',
      photo: '/landing/testimonials/person-5.png',
    },
    {
      quote:
        'The setup was done for us and the follow-up flows just work. Best decision we made this year.',
      name: 'Nour F.',
      role: 'Founder, HomeStyle',
      photo: '/landing/testimonials/person-6.png',
    },
  ],

  integrationsEyebrow: 'Connected tools',
  integrationsTitle: 'Built around the tools you already use.',
  integrations: [
    'OpenAI',
    'Gemini',
    'WhatsApp',
    'Telegram',
    'HubSpot',
    'Google Sheets',
    'Slack',
    'Notion',
    'Google Calendar',
    'n8n',
    'Supabase',
    'APIs',
  ],

  ctaTitle: 'Ready to put your operations on autopilot?',
  ctaBody: "Book a call and we'll map your first automation together.",
  ctaButton: 'Book a call',
  ctaTrust: 'Trusted by business owners across the Gulf and Egypt.',

  footerTagline: 'AI implementation and automation platform.',
  footerHome: 'Home',
  footerDemo: 'Live demo',
  footerDashboard: 'Dashboard',
  footerRights: 'All rights reserved.',
};

const ar: LandingDict = {
  brandHome: 'الصفحة الرئيسية GRINDCTRL',
  langToggleLabel: 'تغيير اللغة',
  langSwitchTo: 'English',

  navHow: 'كيف نعمل',
  navAutomate: 'ماذا نشغّل عنك',
  navProof: 'إثبات',
  navClients: 'العملاء',
  navDemo: 'تجربة مباشرة',
  signIn: 'تسجيل الدخول',
  bookCall: 'احجز مكالمة',

  heroBadge: 'أتمتة ذكاء اصطناعي جاهزة بالكامل',
  heroTitle: 'نبني ونشغّل ونعتني بالذكاء الاصطناعي الخاص بك.',
  heroSubtitle:
    'يبني GrindCTRL أنظمة الذكاء الاصطناعي الخاصة بك، ويشغّلها، ويعتني بها، وأنت تتابع كل شيء وتتحكم به من لوحة واحدة.',
  heroPrimary: 'احجز مكالمة',
  heroSecondary: 'شاهدها مباشرة',
  heroChips: [
    'الدعم والخدمة',
    'العملاء المحتملون وCRM',
    'الملفات والصوت',
    'متابعة واتساب',
    'لوحة تحكم مباشرة',
  ],
  heroFrameCaption: 'عملياتك مباشرة في لوحة تحكم واحدة',

  howEyebrow: 'كيف نعمل',
  howTitle: 'أنت تركّز على عملك، ونحن نتولّى الباقي.',
  howSteps: [
    {
      title: 'نبنيه لك',
      body: 'نفهم طريقة عملك ونبني لك الذكاء الاصطناعي حول الأدوات التي تستخدمها أصلًا.',
    },
    {
      title: 'نشغّله ونعتني به',
      body: 'كل شيء يعمل فعليًا. نراقبه ونصلحه ونحسّنه باستمرار ليبقى شغّالًا.',
    },
    {
      title: 'أنت دائمًا المتحكم',
      body: 'تابع كل عملية وكل عميل وكل محادثة من لوحة واحدة. كل شيء واضح أمامك.',
    },
  ],

  automateEyebrow: 'ماذا نشغّل عنك',
  automateTitle: 'ذكاء اصطناعي يتولى الأعمال التي يكرّرها فريقك.',
  automateBody:
    'من النصوص والصوت والصور والملفات وأدواتك الحالية، نحوّل أعمالك اليومية إلى مهام تلقائية.',
  automateItems: [
    {
      title: 'دعم العملاء بالذكاء الاصطناعي',
      body: 'الرد على رسائل العملاء وتصنيفها وتوجيهها، مع تحويلها إلى موظف عند الحاجة.',
    },
    {
      title: 'جذب العملاء وCRM',
      body: 'التقاط العملاء المحتملين وتقييمهم ومزامنتهم مع نظام CRM ثم المتابعة تلقائيًا.',
    },
    {
      title: 'الملفات والمستندات',
      body: 'قراءة الفواتير والعقود ولقطات الشاشة وتحويلها إلى سجلات منظمة.',
    },
    {
      title: 'الصوت وواتساب',
      body: 'التعامل مع الرسائل الصوتية ومحادثات واتساب من البداية إلى النهاية.',
    },
    {
      title: 'لوحات التحكم والمراقبة',
      body: 'متابعة التشغيل والأداء والنتائج مباشرة، مع تنبيهات عند الحاجة لتدخّلك.',
    },
    {
      title: 'صيانة النظام',
      body: 'نُبقي كل شيء شغّالًا: تحديثات وإصلاحات وتحسينات مستمرة.',
    },
  ],

  proofEyebrow: 'إثبات',
  proofTitle: 'أنظمة حقيقية تعمل في بيئة الإنتاج.',
  proofBody:
    'ليست مجرد شرائح عرض. هذه لوحات التحكم والأتمتة التي نبنيها ونُشغّلها للشركات.',
  proofCaptions: [
    'لوحة تحكم العمليات',
    'أتمتة واتساب أثناء العمل',
    'مسار العملاء والمتابعة',
    'صندوق المحادثات',
  ],
  proofPlaceholder: 'شاشات من منصة GrindCTRL.',

  testimonialsEyebrow: 'ماذا يقول العملاء',
  testimonialsTitle: 'شركات تركت GrindCTRL يتولّى المهام المتكررة.',
  testimonialsBody:
    'فرق حقيقية تستخدم GrindCTRL للرد على العملاء، وجذب العملاء المحتملين، والتحكّم بكل شيء.',
  testimonials: [
    {
      quote:
        'كانت استفسارات واتساب تبقى دون رد لساعات. الآن تُرسَل الردود فورًا ويصل العملاء المناسبون إلى فريق المبيعات في نفس الدقيقة.',
      name: 'محمد ع.',
      role: 'مؤسس، Cairo Apparel',
      photo: '/landing/testimonials/person-1.png',
    },
    {
      quote:
        'ضاعفنا العملاء المحتملين ثلاث مرات في الشهر الأول دون زيادة الموظفين. ولوحة التحكم تُظهر لي كل ما يحدث.',
      name: 'سارة ك.',
      role: 'مديرة العمليات، GulfMart',
      photo: '/landing/testimonials/person-2.png',
    },
    {
      quote:
        'هم بنوه، وهم يُشغّلونه، ويحافظون على عمله. وأنا فقط أتابع النتائج.',
      name: 'عمر ح.',
      role: 'مالك، Riyadh Electronics',
      photo: '/landing/testimonials/person-3.png',
    },
    {
      quote:
        'دعم عملاء لا ينام. انخفض زمن استجابتنا من ساعات إلى ثوانٍ.',
      name: 'لينا ت.',
      role: 'مديرة التسويق، BeautyBox',
      photo: '/landing/testimonials/person-4.png',
    },
    {
      quote:
        'استقبال الملفات والطلبات الذي كان يستغرق صباحًا كاملًا أصبح تلقائيًا ودقيقًا.',
      name: 'خالد س.',
      role: 'الرئيس التنفيذي، LogiServe',
      photo: '/landing/testimonials/person-5.png',
    },
    {
      quote:
        'تم الإعداد بالكامل نيابةً عنا، ومسارات المتابعة تعمل ببساطة. أفضل قرار اتخذناه هذا العام.',
      name: 'نور ف.',
      role: 'مؤسِّسة، HomeStyle',
      photo: '/landing/testimonials/person-6.png',
    },
  ],

  integrationsEyebrow: 'أدوات متصلة',
  integrationsTitle: 'مبنية حول الأدوات التي تستخدمها بالفعل.',
  integrations: [
    'OpenAI',
    'Gemini',
    'WhatsApp',
    'Telegram',
    'HubSpot',
    'Google Sheets',
    'Slack',
    'Notion',
    'Google Calendar',
    'n8n',
    'Supabase',
    'APIs',
  ],

  ctaTitle: 'جاهز لوضع عملياتك على الطيار الآلي؟',
  ctaBody: 'احجز مكالمة وسنرسم معًا أول أتمتة لك.',
  ctaButton: 'احجز مكالمة',
  ctaTrust: 'موثوق من أصحاب أعمال في الخليج ومصر.',

  footerTagline: 'منصة تطبيق الذكاء الاصطناعي والأتمتة.',
  footerHome: 'الرئيسية',
  footerDemo: 'تجربة مباشرة',
  footerDashboard: 'لوحة التحكم',
  footerRights: 'جميع الحقوق محفوظة.',
};

export const LANDING_DICTIONARIES: Record<SiteLocale, LandingDict> = { en, ar };
export type LandingTranslator = LandingDict;

export function getLandingDictionary(locale: SiteLocale): LandingDict {
  return LANDING_DICTIONARIES[locale] ?? en;
}
