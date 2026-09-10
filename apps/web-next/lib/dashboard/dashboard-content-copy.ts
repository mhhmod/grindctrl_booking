import type { SiteLocale } from '@/lib/landing/landing-i18n';

type Translator = (value: string) => string;

export interface LeadsPreviewCopy {
  translate: Translator;
  badge: string;
  title: string;
  description: string;
  columns: readonly string[];
}

export interface AgentsCopy {
  translate: Translator;
  hubTitle: string;
  hubDescription: string;
  catalogTitle: string;
  catalogDescription: string;
  inputs: string;
  outputsActions: string;
  configurePreview: string;
  requestImplementation: string;
  viewConversations: string;
  selectedPreview: string;
  sampleTrigger: string;
  sampleResponse: string;
  requiredIntegrations: string;
  nextStep: string;
  openPreviewInbox: string;
}

export interface ConversationsCopy {
  translate: Translator;
  previewInbox: string;
  readyToConnect: string;
  listTitle: string;
  listDescription: string;
  openPreview: string;
  selectedTitle: string;
  customerMessage: string;
  suggestedResponse: string;
  detectedIntent: string;
  leadScore: string;
  recommendedAction: string;
  contactPanel: string;
  contact: string;
  handoffPreview: string;
  handoffOnly: string;
  conversationsTitle: string;
  conversationsDescription: string;
  messagesTitle: string;
  messagesDescription: string;
}

export interface CrmCopy {
  translate: Translator;
  badge: string;
  title: string;
  description: string;
  selectedLead: string;
  detectedNeed: string;
  nextAction: string;
  score: (value: number) => string;
  owner: (value: string) => string;
  status: (value: string) => string;
  readinessPanel: string;
  readinessDescription: string;
  syncReadiness: string;
  syncReadinessBody: string;
  integrationsNeeded: string;
  integrationItems: readonly string[];
}

export interface WorkflowsCopy {
  translate: Translator;
  catalogTitle: string;
  catalogDescription: string;
  triggerInput: string;
  aiProcessing: string;
  preparedOutput: string;
  latestPreview: string;
  latestPreviewDescription: string;
  noPreview: string;
  confidence: (value: number) => string;
  recommendedAction: (value: string) => string;
  capturedAt: (value: string) => string;
  nextPhase: string;
  nextPhaseDescription: string;
  nextPhaseBody: string;
}

export interface AnalyticsCopy {
  translate: Translator;
  badge: string;
  funnel: string;
  funnelDescription: string;
  operations: string;
  operationsDescription: string;
  channels: string;
  channelsDescription: string;
  previewVolume: string;
}

export interface ImplementationCopy {
  translate: Translator;
  badge: string;
  title: string;
  description: string;
  companyName: string;
  workEmail: string;
  businessType: string;
  businessTypePlaceholder: string;
  primaryUseCase: string;
  selectUseCase: string;
  channelsNeeded: string;
  toolsToConnect: string;
  pain: string;
  painPlaceholder: string;
  notes: string;
  notesPlaceholder: string;
  urgency: string;
  selectUrgency: string;
  previewSummary: string;
  confidence: (value: number) => string;
  noPreview: string;
  companyRequired: string;
  emailInvalid: string;
  businessTypeRequired: string;
  useCaseRequired: string;
  urgencyRequired: string;
  channelRequired: string;
  toolRequired: string;
  success: string;
  submit: string;
}

const identity: Translator = (value) => value;

/* These values are static preview/catalog content, not merchant-authored data.
   Keeping them in the same dictionary prevents translated chrome from wrapping
   an English status, channel, metric, or option label. */
const AR_VALUES: Record<string, string> = {
  'Preview-ready': 'جاهز للمعاينة',
  'Needs connection': 'يحتاج إلى ربط',
  Planned: 'مخطط له',
  New: 'جديد',
  'In progress': 'قيد التنفيذ',
  'Handoff needed': 'يحتاج إلى تحويل',
  Resolved: 'تم الحل',
  Qualified: 'مؤهّل',
  'Needs follow-up': 'يحتاج إلى متابعة',
  'Implementation requested': 'طُلب التنفيذ',
  Closed: 'مغلق',
  Captured: 'تم الالتقاط',
  Proposal: 'عرض',
  Implementation: 'التنفيذ',
  Converted: 'تم التحويل',
  'Active preview': 'معاينة نشطة',
  'Ready to connect': 'جاهز للربط',
  Website: 'الموقع',
  Voice: 'الصوت',
  Files: 'الملفات',
  CRM: 'إدارة العملاء',
  Email: 'البريد الإلكتروني',
  Other: 'أخرى',
  'Website widget': 'أداة الموقع',
  'Voice lead capture': 'التقاط العملاء المحتملين صوتيًا',
  'Instagram DM': 'رسالة إنستغرام',
  'WhatsApp thread': 'محادثة واتساب',
  'File upload workflow': 'مسار رفع الملفات',
  'Ops Team': 'فريق العمليات',
  'AI Advisor': 'مستشار الذكاء الاصطناعي',
  'Implementation Team': 'فريق التنفيذ',
  Unassigned: 'غير معيّن',
  'Landing visit': 'زيارة صفحة الهبوط',
  'Guided preview': 'معاينة موجّهة',
  'Sign-up': 'إنشاء حساب',
  'Dashboard review': 'مراجعة لوحة التحكم',
  'Implementation request': 'طلب تنفيذ',
  'Conversations routed': 'المحادثات الموجّهة',
  'Leads prepared': 'العملاء المحتملون المجهّزون',
  'Files processed': 'الملفات المعالجة',
  'Handoffs recommended': 'التحويلات المقترحة',
  'Workflows previewed': 'مسارات العمل التي تمت معاينتها',
  'Customer support': 'دعم العملاء',
  'Customer service': 'خدمة العملاء',
  'Lead management': 'إدارة العملاء المحتملين',
  'CRM automation': 'أتمتة إدارة العملاء',
  'Social media AI agents': 'وكلاء ذكاء اصطناعي للتواصل الاجتماعي',
  'Website chat widget': 'أداة دردشة الموقع',
  'File/document intake': 'استقبال الملفات والمستندات',
  'Custom operations workflow': 'مسار عمليات مخصص',
  'Google Sheets': 'جداول بيانات Google',
  'This week': 'هذا الأسبوع',
  'This month': 'هذا الشهر',
  'Next quarter': 'الربع القادم',
  'Exploring timeline': 'استكشاف الجدول الزمني',
  'Workflow Planner': 'مخطط مسارات العمل',
  'Voice Lead Capture': 'التقاط العملاء المحتملين صوتيًا',
  'File/Image Intake': 'استقبال الملفات والصور',
  'AI Customer Support': 'دعم العملاء بالذكاء الاصطناعي',
  'CRM Lead Qualification': 'تأهيل العملاء المحتملين في نظام العملاء',
  'Social Inbox Routing': 'توجيه صندوق التواصل الاجتماعي',
  'Implementation Request': 'طلب التنفيذ',
  'Website Support Agent': 'وكيل دعم الموقع',
  'WhatsApp Agent': 'وكيل واتساب',
  'Instagram Agent': 'وكيل إنستغرام',
  'Facebook/Messenger Agent': 'وكيل فيسبوك وماسنجر',
  'Telegram Agent': 'وكيل تيليجرام',
  'Voice Lead Agent': 'وكيل العملاء المحتملين الصوتي',
  'File Intake Agent': 'وكيل استقبال الملفات',
  'CRM Follow-up Agent': 'وكيل متابعة إدارة العملاء',
};

const arabicValue: Translator = (value) => AR_VALUES[value] ?? value;

const leadsEn: LeadsPreviewCopy = {
  translate: identity,
  badge: 'CRM-ready preview',
  title: 'Leads preview',
  description: 'Connect HubSpot/Salesforce/Pipedrive/Sheets later.',
  columns: ['Source', 'Name / company', 'Score', 'Status', 'Detected need', 'Owner', 'Next action', 'Source channel', 'Created time'],
};

const leadsAr: LeadsPreviewCopy = {
  translate: arabicValue,
  badge: 'معاينة جاهزة لنظام إدارة العملاء',
  title: 'معاينة العملاء المحتملين',
  description: 'يمكن ربط HubSpot وSalesforce وPipedrive وجداول البيانات لاحقًا.',
  columns: ['المصدر', 'الاسم / الشركة', 'التقييم', 'الحالة', 'الاحتياج المكتشف', 'المسؤول', 'الإجراء التالي', 'قناة المصدر', 'وقت الإنشاء'],
};

const agentsEn: AgentsCopy = {
  translate: identity,
  hubTitle: 'AI Agents Hub',
  hubDescription: 'Manage preview-ready and implementation-ready AI agents across website, social channels, voice, files, and CRM follow-up flows.',
  catalogTitle: 'Agent catalog',
  catalogDescription: 'Website Support, WhatsApp, Instagram, Messenger, Telegram, Voice, File Intake, CRM Follow-up.',
  inputs: 'Inputs',
  outputsActions: 'Outputs / actions',
  configurePreview: 'Configure preview',
  requestImplementation: 'Request implementation',
  viewConversations: 'View conversations',
  selectedPreview: 'Selected agent preview',
  sampleTrigger: 'Sample trigger',
  sampleResponse: 'Sample response / action',
  requiredIntegrations: 'Required integrations',
  nextStep: 'Next step',
  openPreviewInbox: 'Open conversations',
};

const agentsAr: AgentsCopy = {
  translate: arabicValue,
  hubTitle: 'مركز وكلاء الذكاء الاصطناعي',
  hubDescription: 'أدِر وكلاء الذكاء الاصطناعي الجاهزين للمعاينة أو التنفيذ عبر الموقع وقنوات التواصل والصوت والملفات ومسارات متابعة العملاء.',
  catalogTitle: 'دليل الوكلاء',
  catalogDescription: 'دعم الموقع وواتساب وإنستغرام وماسنجر وتيليجرام والصوت واستقبال الملفات ومتابعة العملاء.',
  inputs: 'المدخلات',
  outputsActions: 'المخرجات / الإجراءات',
  configurePreview: 'إعداد المعاينة',
  requestImplementation: 'طلب التنفيذ',
  viewConversations: 'عرض المحادثات',
  selectedPreview: 'معاينة الوكيل المحدد',
  sampleTrigger: 'مثال على المشغّل',
  sampleResponse: 'مثال على الرد / الإجراء',
  requiredIntegrations: 'التكاملات المطلوبة',
  nextStep: 'الخطوة التالية',
  openPreviewInbox: 'فتح المحادثات',
};

const conversationsEn: ConversationsCopy = {
  translate: identity,
  previewInbox: 'Preview inbox',
  readyToConnect: 'Ready to connect.',
  listTitle: 'Conversation list',
  listDescription: 'Website + social channels in one queue (preview data).',
  openPreview: 'Open preview',
  selectedTitle: 'Selected conversation preview',
  customerMessage: 'Customer message',
  suggestedResponse: 'AI suggested response',
  detectedIntent: 'Detected intent',
  leadScore: 'Lead score',
  recommendedAction: 'Recommended action',
  contactPanel: 'Lead/contact side panel',
  contact: 'Contact',
  handoffPreview: 'Handoff preview',
  handoffOnly: 'Handoff (Preview only)',
  conversationsTitle: 'Conversations',
  conversationsDescription: 'Unified queue for website chat and social agent conversations.',
  messagesTitle: 'Messages',
  messagesDescription: 'Preview message thread handling and AI response suggestions before channel connections.',
};

const conversationsAr: ConversationsCopy = {
  translate: arabicValue,
  previewInbox: 'معاينة صندوق الوارد',
  readyToConnect: 'جاهز للربط.',
  listTitle: 'قائمة المحادثات',
  listDescription: 'محادثات الموقع وقنوات التواصل في قائمة واحدة (بيانات معاينة).',
  openPreview: 'فتح المعاينة',
  selectedTitle: 'معاينة المحادثة المحددة',
  customerMessage: 'رسالة العميل',
  suggestedResponse: 'الرد المقترح بالذكاء الاصطناعي',
  detectedIntent: 'النية المكتشفة',
  leadScore: 'تقييم العميل المحتمل',
  recommendedAction: 'الإجراء المقترح',
  contactPanel: 'لوحة العميل المحتمل وبيانات الاتصال',
  contact: 'بيانات الاتصال',
  handoffPreview: 'معاينة التحويل',
  handoffOnly: 'تحويل (معاينة فقط)',
  conversationsTitle: 'المحادثات',
  conversationsDescription: 'قائمة موحّدة لمحادثات الموقع ووكلاء التواصل الاجتماعي.',
  messagesTitle: 'الرسائل',
  messagesDescription: 'معاينة معالجة سلاسل الرسائل واقتراحات الرد قبل ربط القنوات.',
};

const crmEn: CrmCopy = {
  translate: identity,
  badge: 'CRM-ready preview',
  title: 'CRM pipeline preview',
  description: 'Stages: Captured, Qualified, Proposal, Implementation, Converted.',
  selectedLead: 'Selected lead detail',
  detectedNeed: 'Detected need',
  nextAction: 'Next action',
  score: (value) => `Score ${value}`,
  owner: (value) => `Owner: ${value}`,
  status: (value) => `Status: ${value}`,
  readinessPanel: 'CRM sync readiness panel',
  readinessDescription: 'Preview-only state. No live CRM sync action is executed yet.',
  syncReadiness: 'Sync readiness',
  syncReadinessBody: 'Lead mappings, owner fields, and stage updates are prepared for implementation.',
  integrationsNeeded: 'Integrations needed panel',
  integrationItems: ['HubSpot / Salesforce / Pipedrive credentials', 'Google Sheets fallback mapping (optional)', 'n8n workflow connection for write actions'],
};

const crmAr: CrmCopy = {
  translate: arabicValue,
  badge: 'معاينة جاهزة لنظام إدارة العملاء',
  title: 'معاينة مسار إدارة العملاء',
  description: 'المراحل: الالتقاط، التأهيل، العرض، التنفيذ، التحويل.',
  selectedLead: 'تفاصيل العميل المحتمل المحدد',
  detectedNeed: 'الاحتياج المكتشف',
  nextAction: 'الإجراء التالي',
  score: (value) => `التقييم ${value}`,
  owner: (value) => `المسؤول: ${arabicValue(value)}`,
  status: (value) => `الحالة: ${arabicValue(value)}`,
  readinessPanel: 'لوحة جاهزية مزامنة إدارة العملاء',
  readinessDescription: 'حالة للمعاينة فقط. لا تُنفّذ أي مزامنة فعلية مع نظام إدارة العملاء بعد.',
  syncReadiness: 'جاهزية المزامنة',
  syncReadinessBody: 'تعيينات العملاء وحقول المسؤولين وتحديثات المراحل جاهزة للتنفيذ.',
  integrationsNeeded: 'التكاملات المطلوبة',
  integrationItems: ['بيانات دخول HubSpot أو Salesforce أو Pipedrive', 'تعيين احتياطي لجداول بيانات Google (اختياري)', 'ربط مسار n8n لإجراءات الكتابة'],
};

const workflowsEn: WorkflowsCopy = {
  translate: identity,
  catalogTitle: 'Workflow catalog',
  catalogDescription: 'Preview modules explain trigger, AI processing, and prepared output/action.',
  triggerInput: 'Trigger / input',
  aiProcessing: 'AI processing',
  preparedOutput: 'Prepared output / action',
  latestPreview: 'Latest trial preview',
  latestPreviewDescription: 'Read from local handoff storage only. No database history is fabricated.',
  noPreview: 'No saved preview yet. Run a guided preview from the landing playground to populate this section.',
  confidence: (value) => `${value}% confidence`,
  recommendedAction: (value) => `Recommended action: ${value}`,
  capturedAt: (value) => `Captured at ${value}`,
  nextPhase: 'Next phase',
  nextPhaseDescription: 'Preview history persistence roadmap.',
  nextPhaseBody: 'Saved workflow history will be stored in your workspace after persistence is enabled.',
};

const workflowsAr: WorkflowsCopy = {
  translate: arabicValue,
  catalogTitle: 'دليل مسارات العمل',
  catalogDescription: 'توضح وحدات المعاينة المشغّل ومعالجة الذكاء الاصطناعي والمخرج أو الإجراء المجهّز.',
  triggerInput: 'المشغّل / المدخل',
  aiProcessing: 'معالجة الذكاء الاصطناعي',
  preparedOutput: 'المخرج / الإجراء المجهّز',
  latestPreview: 'أحدث معاينة تجريبية',
  latestPreviewDescription: 'تُقرأ من التخزين المحلي فقط، من دون إنشاء سجل وهمي في قاعدة البيانات.',
  noPreview: 'لا توجد معاينة محفوظة بعد. شغّل معاينة موجّهة من مساحة التجربة في صفحة الهبوط لإظهارها هنا.',
  confidence: (value) => `الثقة ${value}%`,
  recommendedAction: (value) => `الإجراء المقترح: ${value}`,
  capturedAt: (value) => `تم الالتقاط في ${value}`,
  nextPhase: 'المرحلة التالية',
  nextPhaseDescription: 'خطة حفظ سجل المعاينات.',
  nextPhaseBody: 'سيُحفظ سجل مسارات العمل في مساحة عملك بعد تفعيل التخزين الدائم.',
};

const analyticsEn: AnalyticsCopy = {
  translate: identity,
  badge: 'Sample / preview metrics',
  funnel: 'Trial funnel',
  funnelDescription: 'Landing visit → Guided preview → Sign-up → Dashboard review → Implementation request.',
  operations: 'Operations metrics',
  operationsDescription: 'Preview labels only. Real values require persistence + event pipelines.',
  channels: 'Channel breakdown',
  channelsDescription: 'Website, WhatsApp, Instagram, Messenger, Telegram, Voice, Files.',
  previewVolume: 'Preview volume',
};

const analyticsAr: AnalyticsCopy = {
  translate: arabicValue,
  badge: 'مؤشرات تجريبية / للمعاينة',
  funnel: 'مسار التجربة',
  funnelDescription: 'زيارة صفحة الهبوط ← معاينة موجّهة ← إنشاء حساب ← مراجعة لوحة التحكم ← طلب تنفيذ.',
  operations: 'مؤشرات التشغيل',
  operationsDescription: 'تسميات للمعاينة فقط. تتطلب القيم الفعلية تخزينًا دائمًا ومسارات للأحداث.',
  channels: 'توزيع القنوات',
  channelsDescription: 'الموقع وواتساب وإنستغرام وماسنجر وتيليجرام والصوت والملفات.',
  previewVolume: 'حجم المعاينة',
};

const implementationEn: ImplementationCopy = {
  translate: identity,
  badge: 'UI-only submission',
  title: 'Implementation request',
  description: 'Validate form locally, then prepare request summary. No network call happens in this phase.',
  companyName: 'Company name', workEmail: 'Work email', businessType: 'Business type',
  businessTypePlaceholder: 'e.g. Healthcare, Ecommerce, Services', primaryUseCase: 'Primary use case',
  selectUseCase: 'Select use case', channelsNeeded: 'Channels needed', toolsToConnect: 'Tools to connect',
  pain: 'Current process / pain', painPlaceholder: 'Describe current bottlenecks and handoff issues.',
  notes: 'Notes', notesPlaceholder: 'Extra context for implementation team.', urgency: 'Urgency',
  selectUrgency: 'Select urgency', previewSummary: 'Selected preview summary',
  confidence: (value) => `${value}% confidence`, noPreview: 'No saved preview found yet.',
  companyRequired: 'Company name is required.', emailInvalid: 'Work email must be valid.',
  businessTypeRequired: 'Business type is required.', useCaseRequired: 'Primary use case is required.',
  urgencyRequired: 'Urgency is required.', channelRequired: 'Select at least one channel.',
  toolRequired: 'Select at least one tool.',
  success: 'Implementation request prepared. The next phase will connect this to workspace storage and team notification.',
  submit: 'Prepare implementation request',
};

const implementationAr: ImplementationCopy = {
  translate: arabicValue,
  badge: 'إرسال تجريبي داخل الواجهة',
  title: 'طلب التنفيذ',
  description: 'تحقق من النموذج محليًا ثم جهّز ملخص الطلب. لا يجري أي اتصال بالشبكة في هذه المرحلة.',
  companyName: 'اسم الشركة', workEmail: 'بريد العمل الإلكتروني', businessType: 'نوع النشاط',
  businessTypePlaceholder: 'مثال: الرعاية الصحية، التجارة الإلكترونية، الخدمات', primaryUseCase: 'حالة الاستخدام الأساسية',
  selectUseCase: 'اختر حالة الاستخدام', channelsNeeded: 'القنوات المطلوبة', toolsToConnect: 'الأدوات المطلوب ربطها',
  pain: 'العملية الحالية / المشكلة', painPlaceholder: 'صِف الاختناقات الحالية ومشكلات التحويل.',
  notes: 'ملاحظات', notesPlaceholder: 'سياق إضافي لفريق التنفيذ.', urgency: 'مدى الاستعجال',
  selectUrgency: 'اختر مدى الاستعجال', previewSummary: 'ملخص المعاينة المحددة',
  confidence: (value) => `الثقة ${value}%`, noPreview: 'لا توجد معاينة محفوظة بعد.',
  companyRequired: 'اسم الشركة مطلوب.', emailInvalid: 'يجب إدخال بريد عمل إلكتروني صالح.',
  businessTypeRequired: 'نوع النشاط مطلوب.', useCaseRequired: 'حالة الاستخدام الأساسية مطلوبة.',
  urgencyRequired: 'مدى الاستعجال مطلوب.', channelRequired: 'اختر قناة واحدة على الأقل.',
  toolRequired: 'اختر أداة واحدة على الأقل.',
  success: 'تم تجهيز طلب التنفيذ. ستربطه المرحلة التالية بتخزين مساحة العمل وإشعارات الفريق.',
  submit: 'تجهيز طلب التنفيذ',
};

export const getLeadsPreviewCopy = (locale: SiteLocale) => locale === 'ar' ? leadsAr : leadsEn;
export const getAgentsCopy = (locale: SiteLocale) => locale === 'ar' ? agentsAr : agentsEn;
export const getConversationsCopy = (locale: SiteLocale) => locale === 'ar' ? conversationsAr : conversationsEn;
export const getCrmCopy = (locale: SiteLocale) => locale === 'ar' ? crmAr : crmEn;
export const getWorkflowsCopy = (locale: SiteLocale) => locale === 'ar' ? workflowsAr : workflowsEn;
export const getAnalyticsCopy = (locale: SiteLocale) => locale === 'ar' ? analyticsAr : analyticsEn;
export const getImplementationCopy = (locale: SiteLocale) => locale === 'ar' ? implementationAr : implementationEn;
