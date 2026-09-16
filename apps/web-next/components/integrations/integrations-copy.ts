import type { SiteLocale } from '@/lib/landing/landing-i18n';

/** `id` matches a `lib/product-truth/public-integrations.ts` entry — its name
 *  and state badge come from there (single source of truth). `description`
 *  is this page's own public-facing sentence for that row. */
export interface IntegrationCopyRow {
  id: string;
  description: string;
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
  storefrontBody: 'The core storefront integration is implemented and shipping today.',
  storefrontItems: [
    {
      id: 'shopify',
      description: 'Embedded app, App Proxy, webhooks, and theme-extension blocks.',
    },
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
  crmTitle: 'Send conversations to your CRM',
  crmBody: 'One CRM is available through implementation today; another is on the roadmap.',
  crmItems: [
    {
      id: 'hubspot',
      description: 'Available through implementation. Not pre-connected automatically for every store.',
    },
    { id: 'notion', description: 'On the roadmap. No code path exists yet.' },
  ],

  automationEyebrow: 'Automation',
  automationTitle: 'Connect your own workflows',
  automationBody: 'n8n is supported today through a documented pattern; two others are on the roadmap.',
  automationItems: [
    {
      id: 'n8n',
      description: 'Supported through a documented workflow-queue pattern, not a native one-click connector.',
    },
    { id: 'zapier', description: 'On the roadmap. No code path exists yet.' },
    { id: 'make', description: 'On the roadmap. No code path exists yet.' },
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
  storefrontBody: 'تكامل المتجر الأساسي مُفعّل ويعمل اليوم.',
  storefrontItems: [
    {
      id: 'shopify',
      description: 'تطبيق مدمج، وApp Proxy، وWebhooks، وأدوات ثيم جاهزة.',
    },
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
  crmTitle: 'أرسل المحادثات إلى نظام إدارة علاقات العملاء',
  crmBody: 'نظام واحد متاح عبر التنفيذ اليوم، وآخر على خارطة الطريق.',
  crmItems: [
    {
      id: 'hubspot',
      description: 'متاح عبر التنفيذ. غير متصل تلقائيًا بشكل جاهز لكل متجر.',
    },
    { id: 'notion', description: 'على خارطة الطريق. لا يوجد مسار برمجي لها بعد.' },
  ],

  automationEyebrow: 'الأتمتة',
  automationTitle: 'اربط سير العمل الخاص بك',
  automationBody: 'n8n مدعوم اليوم عبر نمط موثّق، واثنان آخران على خارطة الطريق.',
  automationItems: [
    {
      id: 'n8n',
      description: 'مدعوم عبر نمط طابور سير عمل موثّق، وليس موصّلًا جاهزًا بنقرة واحدة.',
    },
    { id: 'zapier', description: 'على خارطة الطريق. لا يوجد مسار برمجي لها بعد.' },
    { id: 'make', description: 'على خارطة الطريق. لا يوجد مسار برمجي لها بعد.' },
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
