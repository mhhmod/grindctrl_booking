import type { IntentsListQuery } from '@/lib/dashboard/intents-list-query';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface IntentsCopy {
  sortLabels: Record<IntentsListQuery['sort'], string>;
  actionLabels: Record<'send_message' | 'external_link' | 'escalate', string>;
  widgetIntents: string;
  widgetIntentsDescription: string;
  realBackendContract: string;
  editIntent: string;
  createIntent: string;
  editorHelp: string;
  cancelEdit: string;
  label: string;
  icon: string;
  actionType: string;
  sortOrder: string;
  messageText: string;
  externalUrl: string;
  savingChanges: string;
  creating: string;
  saving: string;
  saveIntent: string;
  searchIntents: string;
  searchPlaceholder: string;
  action: string;
  allActions: string;
  sortBy: string;
  rows: string;
  apply: string;
  clear: string;
  noIntents: string;
  noMatches: string;
  noIntentsHelp: string;
  noMatchesHelp: string;
  resultsSummary: (start: number, end: number, matched: number, total: number) => string;
  pageSummary: (page: number, pages: number) => string;
  priority: (value: number) => string;
  edit: string;
  up: string;
  down: string;
  moveUp: (label: string) => string;
  moveDown: (label: string) => string;
  delete: string;
  deleting: string;
  deleteConfirm: (label: string) => string;
  previous: string;
  next: string;
  intentSummary: string;
  configuredIntents: (count: number) => string;
  messageIntents: (count: number) => string;
  escalationIntents: (count: number) => string;
  actionGuidance: string;
  sendMessageHelp: string;
  externalLinkHelp: string;
  escalateHelp: string;
  externalLinkRequiresUrl: string;
  externalUrlProtocol: string;
  invalidExternalUrl: string;
  labelRequired: string;
  invalidActionType: string;
  messageTextRequired: string;
  invalidSortOrder: string;
}

const en: IntentsCopy = {
  sortLabels: {
    priority_asc: 'Priority (low to high)',
    priority_desc: 'Priority (high to low)',
    label_asc: 'Label (A-Z)',
    label_desc: 'Label (Z-A)',
  },
  actionLabels: { send_message: 'Send message', external_link: 'External link', escalate: 'Escalate' },
  widgetIntents: 'Widget intents',
  widgetIntentsDescription: 'Configure the quick actions that help visitors get routed to the right outcome faster.',
  realBackendContract: 'Real backend contract',
  editIntent: 'Edit intent',
  createIntent: 'Create intent',
  editorHelp: 'Uses the current widget intent RPCs only. No widget-site config authority is involved.',
  cancelEdit: 'Cancel edit',
  label: 'Label',
  icon: 'Icon',
  actionType: 'Action type',
  sortOrder: 'Sort order',
  messageText: 'Message text',
  externalUrl: 'External URL',
  savingChanges: 'Saving intent changes...',
  creating: 'Creating...',
  saving: 'Saving...',
  saveIntent: 'Save intent',
  searchIntents: 'Search intents',
  searchPlaceholder: 'Find by label, action, message, or URL',
  action: 'Action',
  allActions: 'All actions',
  sortBy: 'Sort by',
  rows: 'Rows',
  apply: 'Apply',
  clear: 'Clear',
  noIntents: 'No intents configured yet.',
  noMatches: 'No intents match the current filters.',
  noIntentsHelp: 'Add your first quick action to help visitors reach the right workflow faster.',
  noMatchesHelp: 'Try adjusting the search, action filter, or sorting.',
  resultsSummary: (start, end, matched, total) => `Showing ${start}-${end} of ${matched} matched intents${matched !== total ? ` (${total} total)` : ''}.`,
  pageSummary: (page, pages) => `Page ${page} of ${pages}`,
  priority: (value) => `Priority ${value}`,
  edit: 'Edit',
  up: 'Up',
  down: 'Down',
  moveUp: (label) => `Move ${label} up`,
  moveDown: (label) => `Move ${label} down`,
  delete: 'Delete',
  deleting: 'Deleting...',
  deleteConfirm: (label) => `Delete intent “${label}”?`,
  previous: 'Previous',
  next: 'Next',
  intentSummary: 'Intent summary',
  configuredIntents: (count) => `Configured intents: ${count}`,
  messageIntents: (count) => `Message intents: ${count}`,
  escalationIntents: (count) => `Escalation intents: ${count}`,
  actionGuidance: 'Action guidance',
  sendMessageHelp: 'Use for quick prompts that should immediately seed the conversation.',
  externalLinkHelp: 'Use when the visitor should be sent to a booking page, help center, or external tool.',
  escalateHelp: 'Use for human handoff or higher-touch support routes handled by the current backend workflow.',
  externalLinkRequiresUrl: 'External link intents require a URL.',
  externalUrlProtocol: 'External URL must use http or https.',
  invalidExternalUrl: 'Enter a valid external URL.',
  labelRequired: 'Intent label is required.',
  invalidActionType: 'Choose a valid action type.',
  messageTextRequired: 'Send message intents require message text.',
  invalidSortOrder: 'Sort order must be a number.',
};

const ar: IntentsCopy = {
  sortLabels: {
    priority_asc: 'الأولوية (من الأقل إلى الأعلى)',
    priority_desc: 'الأولوية (من الأعلى إلى الأقل)',
    label_asc: 'التسمية (أ-ي)',
    label_desc: 'التسمية (ي-أ)',
  },
  actionLabels: { send_message: 'إرسال رسالة', external_link: 'رابط خارجي', escalate: 'تصعيد' },
  widgetIntents: 'نوايا الأداة',
  widgetIntentsDescription: 'اضبط الإجراءات السريعة التي توجه الزوار إلى النتيجة المناسبة بسرعة أكبر.',
  realBackendContract: 'متصل بالنظام الفعلي',
  editIntent: 'تعديل النية',
  createIntent: 'إنشاء نية',
  editorHelp: 'يستخدم إجراءات نوايا الأداة الحالية فقط، من دون صلاحية لتعديل إعدادات الموقع.',
  cancelEdit: 'إلغاء التعديل',
  label: 'التسمية',
  icon: 'الأيقونة',
  actionType: 'نوع الإجراء',
  sortOrder: 'ترتيب الأولوية',
  messageText: 'نص الرسالة',
  externalUrl: 'الرابط الخارجي',
  savingChanges: 'جارٍ حفظ تغييرات النوايا...',
  creating: 'جارٍ الإنشاء...',
  saving: 'جارٍ الحفظ...',
  saveIntent: 'حفظ النية',
  searchIntents: 'البحث في النوايا',
  searchPlaceholder: 'ابحث بالتسمية أو الإجراء أو الرسالة أو الرابط',
  action: 'الإجراء',
  allActions: 'كل الإجراءات',
  sortBy: 'الترتيب حسب',
  rows: 'الصفوف',
  apply: 'تطبيق',
  clear: 'مسح',
  noIntents: 'لا توجد نوايا مضافة بعد.',
  noMatches: 'لا توجد نوايا تطابق عوامل التصفية الحالية.',
  noIntentsHelp: 'أضف أول إجراء سريع لمساعدة الزوار على الوصول إلى المسار المناسب بسرعة أكبر.',
  noMatchesHelp: 'جرّب تعديل البحث أو تصفية الإجراءات أو الترتيب.',
  resultsSummary: (start, end, matched, total) => `عرض ${start}-${end} من ${matched} نوايا مطابقة${matched !== total ? ` (${total} إجمالًا)` : ''}.`,
  pageSummary: (page, pages) => `الصفحة ${page} من ${pages}`,
  priority: (value) => `الأولوية ${value}`,
  edit: 'تعديل',
  up: 'لأعلى',
  down: 'لأسفل',
  moveUp: (label) => `نقل ${label} لأعلى`,
  moveDown: (label) => `نقل ${label} لأسفل`,
  delete: 'حذف',
  deleting: 'جارٍ الحذف...',
  deleteConfirm: (label) => `هل تريد حذف النية «${label}»؟`,
  previous: 'السابق',
  next: 'التالي',
  intentSummary: 'ملخص النوايا',
  configuredIntents: (count) => `النوايا المضافة: ${count}`,
  messageIntents: (count) => `نوايا الرسائل: ${count}`,
  escalationIntents: (count) => `نوايا التصعيد: ${count}`,
  actionGuidance: 'إرشادات الإجراءات',
  sendMessageHelp: 'استخدمه للمطالبات السريعة التي تبدأ المحادثة مباشرة.',
  externalLinkHelp: 'استخدمه لتوجيه الزائر إلى صفحة حجز أو مركز مساعدة أو أداة خارجية.',
  escalateHelp: 'استخدمه للتحويل إلى موظف أو لمسارات الدعم التي تتطلب متابعة أكبر عبر النظام الحالي.',
  externalLinkRequiresUrl: 'تتطلب نوايا الروابط الخارجية إدخال رابط.',
  externalUrlProtocol: 'يجب أن يستخدم الرابط الخارجي بروتوكول http أو https.',
  invalidExternalUrl: 'أدخل رابطًا خارجيًا صالحًا.',
  labelRequired: 'تسمية النية مطلوبة.',
  invalidActionType: 'اختر نوع إجراء صالحًا.',
  messageTextRequired: 'تتطلب نوايا إرسال الرسائل نصًا للرسالة.',
  invalidSortOrder: 'يجب أن يكون ترتيب الأولوية رقمًا.',
};

export function getIntentsCopy(locale: SiteLocale): IntentsCopy {
  return locale === 'ar' ? ar : en;
}
