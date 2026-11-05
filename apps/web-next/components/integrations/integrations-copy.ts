import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** `id` matches a `lib/product-truth/public-integrations.ts` entry — its name
 *  and state badge come from there (single source of truth). `description`
 *  is this page's own public-facing sentence for that row. */
export interface IntegrationCopyRow {
  id: string;
  description: string;
  /** Replaces the register's name for a row that is not a brand, so it can be translated. */
  label?: string;
}

export interface IntegrationsCopy {
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  bookCall: string;
  seeOperations: string;
  viewPricing: string;

  storefrontEyebrow: string;
  storefrontTitle: string;
  storefrontBody: string;
  storefrontItems: IntegrationCopyRow[];

  channelsEyebrow: string;
  channelsTitle: string;
  channelsBody: string;
  channelsItems: IntegrationCopyRow[];

  crmEyebrow: string;
  crmTitle: string;
  crmBody: string;
  crmItems: IntegrationCopyRow[];

  automationEyebrow: string;
  automationTitle: string;
  automationBody: string;
  automationItems: IntegrationCopyRow[];

  aiEyebrow: string;
  aiTitle: string;
  aiBody: string;
  aiItems: IntegrationCopyRow[];

  notClaimsEyebrow: string;
  notClaimsTitle: string;
  notClaimsBody: string;
  notClaimsPoints: string[];

  closingEyebrow: string;
  closingTitle: string;
  closingBody: string;
}

const en: IntegrationsCopy = {
  heroEyebrow: 'Integrations',
  heroTitle: "See exactly what's live, what needs setup, and what's on the roadmap.",
  heroLead:
    'Every row below is checked against the code that ships it. Nothing is marked ready before it actually is.',
  bookCall: 'Book a call',
  seeOperations: 'See operations',
  viewPricing: 'View pricing',

  storefrontEyebrow: 'Storefront',
  storefrontTitle: 'Where GrindCTRL lives in your store',
  storefrontBody:
    'Shopify is live with Try-On, Store Chat, order lookup and billing. WooCommerce is live with Try-On, Store Chat and order lookup. Your website is in testing, for Store Chat only. Salla and Zid are planned.',
  storefrontItems: [
    {
      id: 'shopify',
      description:
        'Embedded app, App Proxy, webhooks, and theme-extension blocks. Paid plans are billed through Shopify.',
    },
    {
      id: 'woocommerce',
      description:
        'Live for Try-On, Store Chat and order status, through the GRINDCTRL WordPress plugin on a domain you verify with DNS. Paid plans are arranged with GRINDCTRL.',
    },
    {
      id: 'custom-website',
      label: 'Your website',
      description:
        'Store Chat only, by script tag on a domain you verify with DNS. Not available to merchants yet. No Try-On, order lookup or product sync.',
    },
    { id: 'salla', description: 'Next in the build order. No code connects a Salla store yet.' },
    { id: 'zid', description: 'After Salla in the build order. No code connects a Zid store yet.' },
  ],

  channelsEyebrow: 'Customer channels',
  channelsTitle: 'One live channel today, more on the roadmap',
  channelsBody: 'Store Chat runs on your storefront now. Other channels are not available yet.',
  channelsItems: [
    { id: 'whatsapp', description: 'No code path exists in the product yet.' },
    { id: 'instagram', description: 'No code path exists in the product yet.' },
    { id: 'telegram', description: 'On the roadmap. No code path exists yet.' },
  ],

  crmEyebrow: 'CRM',
  crmTitle: 'CRM connections are not built yet',
  crmBody: 'No CRM connector exists in the product today.',
  crmItems: [
    { id: 'hubspot', description: 'No HubSpot connector exists in the product yet.' },
    { id: 'notion', description: 'No code path exists in the product yet.' },
  ],

  automationEyebrow: 'Automation',
  automationTitle: 'Connect your own workflows',
  automationBody: 'n8n works through a documented pattern. Zapier and Make have no code path yet.',
  automationItems: [
    {
      id: 'n8n',
      description: 'Supported through a documented workflow-queue pattern, not a native one-click connector.',
    },
    { id: 'zapier', description: 'No code path exists in the product yet.' },
    { id: 'make', description: 'No code path exists in the product yet.' },
  ],

  aiEyebrow: 'AI infrastructure',
  aiTitle: 'The AI infrastructure behind GrindCTRL',
  aiBody:
    'A routing layer, not a single vendor, so the underlying model can change without disrupting your store.',
  aiItems: [
    {
      id: 'groq',
      description: 'Powers chat, speech-to-text, and text-to-speech.',
    },
    {
      id: 'openrouter',
      description: 'Routes Try-On image generation and photo-attachment triage to swappable underlying models.',
    },
  ],

  notClaimsEyebrow: "What we don't claim",
  notClaimsTitle: 'No single AI vendor lock-in',
  notClaimsBody: 'Two things worth stating plainly.',
  notClaimsPoints: [
    'No direct integration with any single AI model or model vendor. Model access runs through the infrastructure above and can change without a code change.',
    'Supabase and Redis are internal infrastructure for data storage and rate limiting, not tools you connect to your store.',
  ],

  closingEyebrow: 'Get started',
  closingTitle: 'Ask about a specific integration',
  closingBody: 'Book a call to talk through what setup a specific integration needs for your store.',
};

const ar: IntegrationsCopy = {
  heroEyebrow: 'التكاملات',
  heroTitle: 'اعرف بالضبط ما هو مُفعّل، وما يحتاج إعدادًا، وما هو على خارطة الطريق.',
  heroLead: 'كل صف بالأسفل مطابق للكود الفعلي الذي يشغّله. لا شيء يُعرض كجاهز قبل أن يكون كذلك فعلاً.',
  bookCall: 'احجز مكالمة',
  seeOperations: 'شاهد العمليات',
  viewPricing: 'شاهد الأسعار',

  storefrontEyebrow: 'المتجر',
  storefrontTitle: 'أين يعمل GrindCTRL داخل متجرك',
  storefrontBody:
    'Shopify مباشر بالتجربة الافتراضية ودردشة المتجر والاستعلام عن الطلبات والفوترة. وWooCommerce مباشر بالتجربة الافتراضية ودردشة المتجر والاستعلام عن الطلبات. وموقعك الخاص قيد الاختبار لدردشة المتجر فقط. وسلة وزد مخطط لهما.',
  storefrontItems: [
    {
      id: 'shopify',
      description:
        'تطبيق مدمج، وApp Proxy، وWebhooks، وأدوات ثيم جاهزة. تُحاسَب الخطط المدفوعة عبر Shopify.',
    },
    {
      id: 'woocommerce',
      description:
        'مباشر للتجربة الافتراضية ودردشة المتجر وحالة الطلب، عبر إضافة ووردبريس من GRINDCTRL على نطاق تتحقق منه عبر DNS. تُرتَّب الخطط المدفوعة مع GRINDCTRL.',
    },
    {
      id: 'custom-website',
      label: 'موقعك',
      description:
        'دردشة المتجر فقط، عبر وسم سكريبت على نطاق تتحقق منه عبر DNS. غير متاح للتجار بعد. بلا تجربة افتراضية أو استعلام عن الطلبات أو مزامنة للمنتجات.',
    },
    { id: 'salla', label: 'سلة', description: 'التالية في ترتيب البناء. لا يوجد كود يربط متجر سلة حتى الآن.' },
    { id: 'zid', label: 'زد', description: 'بعد سلة في ترتيب البناء. لا يوجد كود يربط متجر زد حتى الآن.' },
  ],

  channelsEyebrow: 'قنوات التواصل مع العملاء',
  channelsTitle: 'قناة واحدة مُفعّلة اليوم، والمزيد على خارطة الطريق',
  channelsBody: 'محادثة المتجر تعمل على واجهة متجرك الآن. باقي القنوات غير متاحة بعد.',
  channelsItems: [
    { id: 'whatsapp', description: 'لا يوجد مسار برمجي لها في المنتج حتى الآن.' },
    { id: 'instagram', description: 'لا يوجد مسار برمجي لها في المنتج حتى الآن.' },
    { id: 'telegram', description: 'على خارطة الطريق. لا يوجد مسار برمجي لها بعد.' },
  ],

  crmEyebrow: 'إدارة علاقات العملاء',
  crmTitle: 'ربط أنظمة إدارة علاقات العملاء غير مبني بعد',
  crmBody: 'لا يوجد في المنتج اليوم موصّل لأي نظام إدارة علاقات عملاء.',
  crmItems: [
    { id: 'hubspot', description: 'لا يوجد موصّل HubSpot في المنتج حتى الآن.' },
    { id: 'notion', description: 'لا يوجد مسار برمجي لها في المنتج حتى الآن.' },
  ],

  automationEyebrow: 'الأتمتة',
  automationTitle: 'اربط سير العمل الخاص بك',
  automationBody: 'يعمل n8n عبر نمط موثّق. ولا يوجد مسار برمجي لـ Zapier وMake حتى الآن.',
  automationItems: [
    {
      id: 'n8n',
      description: 'مدعوم عبر نمط طابور سير عمل موثّق، وليس موصّلًا جاهزًا بنقرة واحدة.',
    },
    { id: 'zapier', description: 'لا يوجد مسار برمجي لها في المنتج حتى الآن.' },
    { id: 'make', description: 'لا يوجد مسار برمجي لها في المنتج حتى الآن.' },
  ],

  aiEyebrow: 'البنية التحتية للذكاء الاصطناعي',
  aiTitle: 'البنية التحتية للذكاء الاصطناعي خلف GrindCTRL',
  aiBody: 'طبقة توجيه، لا مزوّد واحد، بحيث يمكن تغيير النموذج المستخدم دون تعطيل متجرك.',
  aiItems: [
    {
      id: 'groq',
      description: 'يشغّل المحادثة، وتحويل الصوت إلى نص، وتحويل النص إلى صوت.',
    },
    {
      id: 'openrouter',
      description: 'يوجّه توليد صور التجربة الافتراضية وفرز مرفقات الصور إلى نماذج قابلة للاستبدال.',
    },
  ],

  notClaimsEyebrow: 'ما لا ندّعيه',
  notClaimsTitle: 'لا ارتباط حصري بمزوّد ذكاء اصطناعي واحد',
  notClaimsBody: 'أمران نوضحهما بصراحة.',
  notClaimsPoints: [
    'لا يوجد تكامل مباشر مع نموذج أو مزوّد ذكاء اصطناعي واحد بعينه. الوصول للنماذج يمر عبر البنية التحتية أعلاه، ويمكن أن يتغير دون تعديل في الكود.',
    'Supabase وRedis بنية تحتية داخلية لتخزين البيانات وإدارة حدود الاستخدام، وليسا أداتين تربطهما بمتجرك.',
  ],

  closingEyebrow: 'ابدأ الآن',
  closingTitle: 'اسأل عن تكامل محدد',
  closingBody: 'احجز مكالمة لمعرفة الإعداد الذي يحتاجه تكامل محدد في متجرك.',
};

export function getIntegrationsCopy(locale: SiteLocale): IntegrationsCopy {
  return locale === 'ar' ? ar : en;
}
