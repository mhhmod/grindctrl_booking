import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { IntegrationsDirectoryCopy } from './integrations-directory';
import type { TryOnSwitcherCopy } from './try-on-switcher';

export type StopKey = 'signal' | 'context' | 'action' | 'outcome';
export type ProofTabKey = 'shopping' | 'conversations' | 'leads' | 'operations' | 'reporting';
export type Maturity = 'live' | 'setup' | 'planned';

export type ProofCopy = {
  heroSubtitle: string;
  heroPrimary: string;
  heroSecondary: string;
  heroTrust: string[];
  heroVisualLabel: string;
  stops: Record<StopKey, { label: string; caption: string }>;
  demoNote: string;
  shopperGarment: string;

  systemEyebrow: string;
  systemTitle: string;
  systemBody: string;
  systemNodes: { key: 'storefront' | 'conversation' | 'customer' | 'workflow' | 'report'; title: string; body: string; maturity: Maturity; limit?: string }[];

  maturity: Record<Maturity, string>;

  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  proofTablistLabel: string;
  proofTabs: Record<ProofTabKey, { label: string; title: string; points: string[]; alt: string; limit?: string }>;
  demoDataBadge: string;

  tryOnEyebrow: string;
  tryOnTitle: string;
  tryOnBody: string;
  tryOnFacts: string[];
  tryOnDemoCta: string;
  tryOnSwitcher: TryOnSwitcherCopy;

  integrationsEyebrow: string;
  integrationsTitle: string;
  integrationsBody: string;
  integrationsLink: string;
  integrations: IntegrationsDirectoryCopy;

  closingTitle: string;
  closingBody: string;
};

const en: ProofCopy = {
  heroSubtitle:
    'Try-on, store chat, your team and reporting work as one system, so every shopper signal reaches the right next step.',
  heroPrimary: 'See it working',
  heroSecondary: 'Book a call',
  heroTrust: ['Native Shopify app', 'Arabic and English', 'Set up and run by our team'],
  heroVisualLabel: 'One shopper moving through GrindCTRL: try-on, store chat, team inbox and report.',
  stops: {
    signal: { label: 'Shopper signal', caption: 'Salma tries the linen shirt on' },
    context: { label: 'Customer context', caption: 'She asks about size. The assistant answers.' },
    action: { label: 'Team action', caption: 'Handed to Omar with a private note' },
    outcome: { label: 'Outcome', caption: 'The Store Chat report counts it' },
  },
  demoNote: 'Real product screens with demo data. The try-on image is a real GrindCTRL result on an AI-generated model.',
  shopperGarment: 'Sage linen shirt',

  systemEyebrow: 'One system',
  systemTitle: 'Five connected parts, one shopper journey.',
  systemBody: 'Each part below is a real screen from the product. Where a part is not finished, it says so.',
  systemNodes: [
    { key: 'storefront', title: 'Storefront', body: 'AI try-on on your product pages.', maturity: 'live' },
    { key: 'conversation', title: 'Conversation', body: 'Store Chat answers from your store knowledge and hands off when needed.', maturity: 'live' },
    { key: 'customer', title: 'Customer', body: 'Name, email and the full thread stay together in your inbox.', maturity: 'live', limit: 'CRM sync is planned' },
    { key: 'workflow', title: 'Workflow', body: 'Handoffs, assignment, private notes and saved replies for your team.', maturity: 'live', limit: 'Custom automations are set up per store' },
    { key: 'report', title: 'Report', body: 'Store Chat and try-on activity in your dashboard.', maturity: 'live', limit: 'Revenue attribution is planned' },
  ],

  maturity: { live: 'Live', setup: 'Set up per store', planned: 'Planned' },

  proofEyebrow: 'See it working',
  proofTitle: 'The product, not a description of it.',
  proofBody: 'Switch between the parts of GrindCTRL. Every panel is the real interface.',
  proofTablistLabel: 'Parts of GrindCTRL',
  proofTabs: {
    shopping: {
      label: 'Shopping',
      title: 'Shoppers see the garment on themselves.',
      points: ['One photo, any product page with the try-on block', 'Failed generations are designed not to use a credit', 'Result images are deleted after about 30 minutes'],
      alt: 'Real GrindCTRL try-on result of a woman wearing a sage linen shirt, beside her original photo and the garment image.',
    },
    conversations: {
      label: 'Conversations',
      title: 'Answers from your store, handoff when it matters.',
      points: ['Replies are grounded in the knowledge you add', 'Shoppers can ask for a person at any time', 'Arabic and English, right to left included'],
      alt: 'The GrindCTRL Store Chat panel: a shopper asks about sizing, the assistant answers, and the chat connects her with the team.',
    },
    leads: {
      label: 'Leads',
      title: 'Every shopper who writes in is in one list.',
      points: ['Name, email and status on each conversation', 'Filter by needs a reply, in progress or resolved', 'See who on your team owns it'],
      alt: 'The GrindCTRL inbox listing conversations with status, unread count and the assigned teammate.',
      limit: 'A lead pipeline and CRM sync are not live yet.',
    },
    operations: {
      label: 'Operations',
      title: 'See what ran, what failed and why.',
      points: ['Try-on generations per day and success rate', 'Recent failures with the reason the shopper saw', 'Average render time per week'],
      alt: 'The GrindCTRL try-on usage view with generation counts, success rate, daily activity and recent failures.',
    },
    reporting: {
      label: 'Reporting',
      title: 'Know what the assistant handled and what needed you.',
      points: ['Conversations, AI-closed and handed off', 'Median first reply time', 'Shopper satisfaction from reply ratings'],
      alt: 'The GrindCTRL Store Chat report with conversation counts, handoffs, response time and satisfaction.',
    },
  },
  demoDataBadge: 'Demo data',

  tryOnEyebrow: 'Try-on',
  tryOnTitle: 'One capability, shown with real results.',
  tryOnBody: 'Pick a garment. Each image is generated by the same pipeline your shoppers use.',
  tryOnFacts: [
    'Works on any product page where the try-on block is added',
    'A clear, front-facing photo of one person works best',
    'Photos go to our AI provider for processing and are not stored by GrindCTRL',
  ],
  tryOnDemoCta: 'Try it yourself',
  tryOnSwitcher: {
    pickerLabel: 'Choose a garment',
    resultAlt: (garment) => `Real GrindCTRL try-on result wearing the ${garment}.`,
    beforeLabel: 'Shopper photo',
    garmentLabel: 'Product image',
    provenance: 'Real outputs from the GrindCTRL try-on pipeline. The models are AI-generated.',
  },

  integrationsEyebrow: 'Integrations',
  integrationsTitle: 'Connected by job, labeled by depth.',
  integrationsBody: 'Each tool shows how it connects today, so nothing looks more finished than it is.',
  integrationsLink: 'See all integrations',
  integrations: {
    groups: { commerce: 'Commerce', channels: 'Channels', automation: 'Automation', data: 'CRM and data', ai: 'AI infrastructure' },
    depth: {
      native: 'Native app',
      builtIn: 'Built in',
      automation: 'Automation layer',
      custom: 'Custom setup',
      internal: 'Internal technology',
      planned: 'Planned',
      notYet: 'Not available yet',
    },
    webChat: 'Store web chat',
    aiNote: 'OpenRouter and Groq route the AI models behind try-on and chat.',
    disclaimer: 'Logos belong to their owners. Listing a tool does not mean a partnership or endorsement.',
  },

  closingTitle: 'See the whole system on your store.',
  closingBody: 'We set up try-on, store chat, team handoffs and reporting for your catalog, then keep it running.',
};

const ar: ProofCopy = {
  heroSubtitle:
    'التجربة الافتراضية ودردشة المتجر وفريقك والتقارير تعمل كنظام واحد، فتصل كل إشارة من المتسوق إلى الخطوة الصحيحة.',
  heroPrimary: 'شاهده يعمل',
  heroSecondary: 'احجز مكالمة',
  heroTrust: ['تطبيق Shopify أصلي', 'العربية والإنجليزية', 'نجهّزه ونديره لك'],
  heroVisualLabel: 'متسوقة واحدة عبر GrindCTRL: التجربة الافتراضية، ثم دردشة المتجر، ثم صندوق الفريق، ثم التقرير.',
  stops: {
    signal: { label: 'إشارة المتسوق', caption: 'سلمى تجرب قميص الكتان' },
    context: { label: 'سياق العميل', caption: 'تسأل عن المقاس فيجيب المساعد' },
    action: { label: 'إجراء الفريق', caption: 'تحويل إلى عمر مع ملاحظة خاصة' },
    outcome: { label: 'النتيجة', caption: 'تقرير دردشة المتجر يسجلها' },
  },
  demoNote: 'شاشات حقيقية من المنتج ببيانات تجريبية. صورة التجربة نتيجة حقيقية من GrindCTRL على عارضة مولّدة بالذكاء الاصطناعي.',
  shopperGarment: 'قميص كتان أخضر',

  systemEyebrow: 'نظام واحد',
  systemTitle: 'خمسة أجزاء مترابطة، ورحلة متسوق واحدة.',
  systemBody: 'كل جزء هنا شاشة حقيقية من المنتج. وإذا لم يكتمل جزء، نذكر ذلك بوضوح.',
  systemNodes: [
    { key: 'storefront', title: 'واجهة المتجر', body: 'تجربة افتراضية بالذكاء الاصطناعي على صفحات منتجاتك.', maturity: 'live' },
    { key: 'conversation', title: 'المحادثة', body: 'دردشة المتجر تجيب من معرفة متجرك وتحوّل للفريق عند الحاجة.', maturity: 'live' },
    { key: 'customer', title: 'العميل', body: 'الاسم والبريد والمحادثة كاملة في صندوقك.', maturity: 'live', limit: 'المزامنة مع CRM مخطط لها' },
    { key: 'workflow', title: 'سير العمل', body: 'تحويل وتعيين وملاحظات خاصة وردود محفوظة لفريقك.', maturity: 'live', limit: 'الأتمتة المخصصة تُجهَّز لكل متجر' },
    { key: 'report', title: 'التقرير', body: 'نشاط دردشة المتجر والتجربة الافتراضية في لوحة التحكم.', maturity: 'live', limit: 'نسبة الإيرادات مخطط لها' },
  ],

  maturity: { live: 'مفعّل', setup: 'يُجهَّز لكل متجر', planned: 'مخطط له' },

  proofEyebrow: 'شاهده يعمل',
  proofTitle: 'المنتج نفسه، لا وصفًا له.',
  proofBody: 'تنقّل بين أجزاء GrindCTRL. كل لوحة هي الواجهة الحقيقية.',
  proofTablistLabel: 'أجزاء GrindCTRL',
  proofTabs: {
    shopping: {
      label: 'التسوق',
      title: 'يرى المتسوق القطعة عليه.',
      points: ['صورة واحدة، وأي صفحة منتج عليها زر التجربة', 'التوليد الفاشل مصمم ألا يستهلك رصيدًا', 'تُحذف صور النتائج بعد نحو 30 دقيقة'],
      alt: 'نتيجة تجربة حقيقية من GrindCTRL لامرأة ترتدي قميص كتان أخضر، بجانب صورتها الأصلية وصورة القطعة.',
    },
    conversations: {
      label: 'المحادثات',
      title: 'إجابات من متجرك، وتحويل للفريق حين يلزم.',
      points: ['الردود مبنية على المعرفة التي تضيفها', 'يمكن للمتسوق طلب شخص في أي وقت', 'العربية والإنجليزية مع الكتابة من اليمين'],
      alt: 'لوحة دردشة المتجر من GrindCTRL: متسوقة تسأل عن المقاس، والمساعد يجيب، ثم تُحوَّل إلى الفريق.',
    },
    leads: {
      label: 'العملاء',
      title: 'كل من يراسلك في قائمة واحدة.',
      points: ['الاسم والبريد والحالة لكل محادثة', 'تصفية حسب يحتاج ردًا أو قيد المعالجة أو مغلق', 'معرفة من في فريقك يتولاها'],
      alt: 'صندوق GrindCTRL يعرض المحادثات مع الحالة وعدد غير المقروء وعضو الفريق المسؤول.',
      limit: 'مسار العملاء والمزامنة مع CRM غير مفعّلين بعد.',
    },
    operations: {
      label: 'العمليات',
      title: 'اعرف ما نُفذ وما فشل ولماذا.',
      points: ['عدد التوليدات يوميًا ونسبة النجاح', 'آخر الإخفاقات مع السبب الذي رآه المتسوق', 'متوسط وقت التوليد أسبوعيًا'],
      alt: 'شاشة استخدام التجربة الافتراضية في GrindCTRL بعدد التوليدات ونسبة النجاح والنشاط اليومي وآخر الإخفاقات.',
    },
    reporting: {
      label: 'التقارير',
      title: 'اعرف ما تولاه المساعد وما احتاجك.',
      points: ['المحادثات وما أغلقه الذكاء الاصطناعي وما حُوّل', 'متوسط زمن أول رد', 'رضا المتسوقين من تقييم الردود'],
      alt: 'تقرير دردشة المتجر في GrindCTRL بعدد المحادثات والتحويلات وزمن الرد والرضا.',
    },
  },
  demoDataBadge: 'بيانات تجريبية',

  tryOnEyebrow: 'التجربة الافتراضية',
  tryOnTitle: 'قدرة واحدة، بنتائج حقيقية.',
  tryOnBody: 'اختر قطعة. كل صورة مولّدة بنفس المسار الذي يستخدمه متسوقوك.',
  tryOnFacts: [
    'تعمل على أي صفحة منتج أُضيف إليها زر التجربة',
    'أفضل نتيجة مع صورة واضحة لشخص واحد من الأمام',
    'تُرسل الصور إلى مزوّد الذكاء الاصطناعي للمعالجة ولا تخزنها GrindCTRL',
  ],
  tryOnDemoCta: 'جرّبها بنفسك',
  tryOnSwitcher: {
    pickerLabel: 'اختر قطعة',
    resultAlt: (garment) => `نتيجة تجربة حقيقية من GrindCTRL بارتداء ${garment}.`,
    beforeLabel: 'صورة المتسوق',
    garmentLabel: 'صورة المنتج',
    provenance: 'نتائج حقيقية من مسار التجربة الافتراضية في GrindCTRL. العارضون مولّدون بالذكاء الاصطناعي.',
  },

  integrationsEyebrow: 'التكاملات',
  integrationsTitle: 'مرتبة حسب الوظيفة، وموضّح عمق كل ربط.',
  integrationsBody: 'كل أداة توضح كيف ترتبط اليوم، حتى لا يبدو شيء أكثر اكتمالًا مما هو.',
  integrationsLink: 'كل التكاملات',
  integrations: {
    groups: { commerce: 'التجارة', channels: 'القنوات', automation: 'الأتمتة', data: 'CRM والبيانات', ai: 'بنية الذكاء الاصطناعي' },
    depth: {
      native: 'تطبيق أصلي',
      builtIn: 'مدمج',
      automation: 'عبر طبقة الأتمتة',
      custom: 'إعداد مخصص',
      internal: 'تقنية داخلية',
      planned: 'مخطط له',
      notYet: 'غير متاح بعد',
    },
    webChat: 'دردشة المتجر',
    aiNote: 'OpenRouter وGroq يوجّهان نماذج الذكاء الاصطناعي خلف التجربة والدردشة.',
    disclaimer: 'الشعارات ملك أصحابها. ذكر أداة لا يعني شراكة أو تأييدًا.',
  },

  closingTitle: 'شاهد النظام كاملًا على متجرك.',
  closingBody: 'نجهّز التجربة الافتراضية ودردشة المتجر وتحويل الفريق والتقارير لكتالوجك، ثم نبقيها تعمل.',
};

export function getProofCopy(locale: SiteLocale): ProofCopy {
  return locale === 'ar' ? ar : en;
}
