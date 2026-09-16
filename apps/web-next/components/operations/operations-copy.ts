import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface OperationsCopy {
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  bookCall: string;
  seeConversations: string;
  seeIntegrations: string;
  viewPricing: string;

  orderEyebrow: string;
  orderTitle: string;
  orderBody: string;
  orderPoints: string[];
  orderLink: string;

  teamEyebrow: string;
  teamTitle: string;
  teamBody: string;
  teamItems: Array<{ title: string; body: string }>;

  visibilityEyebrow: string;
  visibilityTitle: string;
  visibilityBody: string;
  visibilityConversationTitle: string;
  visibilityConversationBody: string;
  visibilityTryOnTitle: string;
  visibilityTryOnBody: string;

  implementationEyebrow: string;
  implementationTitle: string;
  implementationBody: string;
  merchantProvidesTitle: string;
  merchantProvidesItems: string[];
  grindctrlHandlesTitle: string;
  grindctrlHandlesItems: string[];
  intakeNote: string;

  notLiveEyebrow: string;
  notLiveTitle: string;
  notLiveCrm: { label: string; note: string; status: string };
  notLiveWorkflow: { label: string; note: string; status: string };
  notLiveAttribution: { label: string; note: string; status: string };
  notLiveChannels: { label: string; note: string; status: string };

  closingTitle: string;
  closingBody: string;
}

const en: OperationsCopy = {
  heroEyebrow: 'Commerce operations',
  heroTitle: 'Run support with your team and the AI together.',
  heroLead:
    'Order status inside the conversation, a shared queue your team can take over, and real visibility into what is happening, not a mocked-up dashboard.',
  bookCall: 'Book a call',
  seeConversations: 'See conversations',
  seeIntegrations: 'See integrations',
  viewPricing: 'View pricing',

  orderEyebrow: 'Built into chat',
  orderTitle: 'Order status without leaving the conversation',
  orderBody:
    'The AI can answer order-status questions using real Shopify order data, once a merchant grants order-read access.',
  orderPoints: [
    'Read-only: no refund, cancellation, or edit action exists in the product.',
    'Scoped to a verified customer, or an order number matched with the email on file.',
    'Runs inside the same Store Chat covered on the Conversations page.',
  ],
  orderLink: 'See how conversations work',

  teamEyebrow: 'Team workflow',
  teamTitle: 'Your team and the AI share one queue',
  teamBody:
    'Staff can take a conversation over from the AI, leave notes the shopper never sees, and reuse saved replies. Every staff and configuration action is recorded.',
  teamItems: [
    {
      title: 'Assignment and takeover',
      body: 'A conversation moves from AI to a staff member on request, and back again, with the state guarded end to end.',
    },
    {
      title: 'Private internal notes',
      body: 'Notes staff leave for each other are excluded from both the shopper thread and what the AI reads.',
    },
    {
      title: 'Saved replies',
      body: 'Reusable reply templates staff insert with one click instead of retyping the same answer.',
    },
    {
      title: 'Audit trail',
      body: 'Staff actions and configuration changes are recorded server-side. This trail is internal today, not a customer-facing report.',
    },
  ],

  visibilityEyebrow: 'See what is happening',
  visibilityTitle: 'Real activity, not sample numbers',
  visibilityBody:
    'Two reporting views are backed by real data today. Neither lives under a page or tab called "Analytics" yet.',
  visibilityConversationTitle: 'Conversation activity',
  visibilityConversationBody:
    'Conversation activity and escalations are visible in the dashboard inbox: how many widget opens turn into conversations, messages, leads, and handoffs to your team.',
  visibilityTryOnTitle: 'Try-on usage and cost',
  visibilityTryOnBody:
    'Job volume, success rate, and average render time over the last 7 and 14 days, broken down per shop, with spend tracked and any job of unknown cost flagged rather than guessed.',

  implementationEyebrow: 'Managed implementation',
  implementationTitle: 'We do not hand you a tool and disappear',
  implementationBody:
    'Set up, tuning, and ongoing care are part of the service. Discovery, brand rules, and integration work are scoped with you on a call, not sold as self-serve automation.',
  merchantProvidesTitle: 'You provide',
  merchantProvidesItems: [
    'Store access',
    'Brand and tone rules',
    'Product and customer policies',
    'Approved messaging',
    'Access to any systems you want connected',
  ],
  grindctrlHandlesTitle: 'We handle',
  grindctrlHandlesItems: [
    'Integration and configuration',
    'AI behavior setup and testing',
    'Launch and monitoring',
    'Ongoing tuning',
  ],
  intakeNote:
    'In your dashboard, the implementation intake form only prepares a summary on screen; it is not submitted anywhere. Booking a call is the step that actually reaches our team.',

  notLiveEyebrow: 'Honest about scope',
  notLiveTitle: "What's not live yet",
  notLiveCrm: {
    label: 'CRM / lead pipeline',
    note: 'Preview screens use illustrative sample data, not a connected pipeline.',
    status: 'Preview only',
  },
  notLiveWorkflow: {
    label: 'Workflow automation history',
    note: 'No stored execution history exists yet; automation is example-based today.',
    status: 'Preview only',
  },
  notLiveAttribution: {
    label: 'Order / revenue attribution',
    note: 'Try-on activity is not yet joined to order or revenue data.',
    status: 'Planned',
  },
  notLiveChannels: {
    label: 'Channels beyond your storefront',
    note: 'The Shopify storefront widget is the only live channel today; see Integrations for exact status by channel.',
    status: 'Not live',
  },

  closingTitle: 'See it running on your store',
  closingBody: 'Book a call and we will walk through order support, takeover, and reporting on your own data.',
};

const ar: OperationsCopy = {
  heroEyebrow: 'عمليات التجارة',
  heroTitle: 'شغّل الدعم بفريقك والذكاء الاصطناعي معًا.',
  heroLead:
    'حالة الطلب داخل المحادثة، وقائمة انتظار مشتركة يمكن لفريقك تولّيها، ورؤية حقيقية لما يحدث فعليًا، وليست لوحة معلومات تجريبية.',
  bookCall: 'احجز مكالمة',
  seeConversations: 'شاهد المحادثات',
  seeIntegrations: 'شاهد التكاملات',
  viewPricing: 'شاهد الأسعار',

  orderEyebrow: 'مدمج في المحادثة',
  orderTitle: 'حالة الطلب من دون مغادرة المحادثة',
  orderBody:
    'يمكن للذكاء الاصطناعي الإجابة عن أسئلة حالة الطلب باستخدام بيانات طلبات Shopify الفعلية، بعد أن يمنح المتجر صلاحية قراءة الطلبات.',
  orderPoints: [
    'للقراءة فقط: لا يوجد في المنتج أي إجراء استرداد أو إلغاء أو تعديل.',
    'مقيّد بعميل موثّق، أو رقم طلب مطابق للبريد الإلكتروني المسجل.',
    'يعمل داخل نفس محادثة المتجر الموضحة في صفحة المحادثات.',
  ],
  orderLink: 'شاهد كيف تعمل المحادثات',

  teamEyebrow: 'عمل الفريق',
  teamTitle: 'فريقك والذكاء الاصطناعي يعملان في قائمة واحدة',
  teamBody:
    'يمكن للموظفين تولّي محادثة من الذكاء الاصطناعي، وترك ملاحظات لا يراها العميل، وإعادة استخدام ردود جاهزة. يُسجَّل كل إجراء للموظفين والإعدادات.',
  teamItems: [
    {
      title: 'التولي والتحويل',
      body: 'تنتقل المحادثة من الذكاء الاصطناعي إلى موظف عند الطلب، وتعود مرة أخرى، مع ضبط الحالة في كل خطوة.',
    },
    {
      title: 'ملاحظات داخلية خاصة',
      body: 'الملاحظات التي يتركها الموظفون لبعضهم مستبعدة من محادثة العميل ومن السياق الذي يقرأه الذكاء الاصطناعي.',
    },
    {
      title: 'ردود جاهزة',
      body: 'قوالب ردود قابلة لإعادة الاستخدام يدرجها الموظف بنقرة واحدة بدلاً من كتابة نفس الإجابة مرارًا.',
    },
    {
      title: 'سجل تدقيق',
      body: 'تُسجَّل إجراءات الموظفين والتغييرات في الإعدادات على الخادم. هذا السجل داخلي اليوم، وليس تقريرًا يراه العميل.',
    },
  ],

  visibilityEyebrow: 'ما الذي يحدث الآن',
  visibilityTitle: 'نشاط حقيقي، لا أرقام توضيحية',
  visibilityBody:
    'يعتمد عرضان للتقارير اليوم على بيانات فعلية. لا يوجد أي منهما حاليًا ضمن صفحة أو تبويب باسم "التحليلات".',
  visibilityConversationTitle: 'نشاط المحادثات',
  visibilityConversationBody:
    'يظهر نشاط المحادثات وحالات التحويل إلى الفريق في صندوق الوارد بلوحة التحكم: كم عدد مرات فتح الأداة التي تحولت إلى محادثات ورسائل وعملاء محتملين وتحويلات لفريقك.',
  visibilityTryOnTitle: 'استخدام التجربة الافتراضية وتكلفتها',
  visibilityTryOnBody:
    'حجم المهام ومعدل النجاح ومتوسط وقت المعاينة خلال آخر 7 و14 يومًا، مقسّمة لكل متجر، مع تتبع الإنفاق ووضع علامة على أي مهمة مجهولة التكلفة بدلاً من تقديرها.',

  implementationEyebrow: 'التنفيذ المُدار',
  implementationTitle: 'لا نسلّمك أداة ونختفي',
  implementationBody:
    'الإعداد والضبط والمتابعة المستمرة جزء من الخدمة. يُحدَّد الاستكشاف وقواعد الهوية والتكاملات معك في مكالمة، وليست أتمتة ذاتية الخدمة تُباع جاهزة.',
  merchantProvidesTitle: 'تقدّمه أنت',
  merchantProvidesItems: [
    'الوصول إلى المتجر',
    'قواعد الهوية ونبرة الخطاب',
    'سياسات المنتج والعملاء',
    'الرسائل المعتمدة',
    'الوصول إلى أي أنظمة تريد ربطها',
  ],
  grindctrlHandlesTitle: 'نتولاه نحن',
  grindctrlHandlesItems: [
    'التكامل والإعداد',
    'ضبط سلوك الذكاء الاصطناعي واختباره',
    'الإطلاق والمراقبة',
    'الضبط المستمر',
  ],
  intakeNote:
    'في لوحة التحكم، يُعدّ نموذج طلب التنفيذ ملخصًا على الشاشة فقط، ولا يُرسل إلى أي جهة. حجز مكالمة هو الخطوة التي تصل فعليًا إلى فريقنا.',

  notLiveEyebrow: 'بصراحة عن النطاق',
  notLiveTitle: 'ما لم يُفعَّل بعد',
  notLiveCrm: {
    label: 'إدارة العملاء المحتملين (CRM)',
    note: 'شاشات المعاينة تستخدم بيانات توضيحية، وليست خط أنابيب متصلاً.',
    status: 'معاينة فقط',
  },
  notLiveWorkflow: {
    label: 'سجل تنفيذ مسارات العمل',
    note: 'لا يوجد بعد سجل تنفيذ محفوظ؛ الأتمتة اليوم قائمة على أمثلة فقط.',
    status: 'معاينة فقط',
  },
  notLiveAttribution: {
    label: 'إسناد الطلبات والإيرادات',
    note: 'لا يزال نشاط التجربة الافتراضية غير مرتبط ببيانات الطلبات أو الإيرادات.',
    status: 'مخطط له',
  },
  notLiveChannels: {
    label: 'القنوات خارج واجهة المتجر',
    note: 'أداة واجهة متجر Shopify هي القناة الوحيدة المفعّلة اليوم؛ راجع صفحة التكاملات لمعرفة حالة كل قناة بدقة.',
    status: 'غير مفعّلة',
  },

  closingTitle: 'شاهدها تعمل على متجرك',
  closingBody: 'احجز مكالمة ونستعرض معك دعم الطلبات والتولي والتقارير على بيانات متجرك الفعلية.',
};

export function getOperationsCopy(locale: SiteLocale): OperationsCopy {
  return locale === 'ar' ? ar : en;
}
