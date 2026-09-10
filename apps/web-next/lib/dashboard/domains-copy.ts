import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { DomainsListQuery } from '@/lib/dashboard/domains-list-query';
import type { WidgetDomain } from '@/lib/types';

type DomainStatus = WidgetDomain['verification_status'];

export interface DomainsCopy {
  sortLabels: Record<DomainsListQuery['sort'], string>;
  statusLabels: Record<DomainStatus, string>;
  allowedDomains: string;
  allowedDomainsDescription: string;
  realBackendContract: string;
  addDomain: string;
  adding: string;
  hostnamePlaceholder: string;
  hostnameHelp: string;
  invalidHostname: string;
  savingChanges: string;
  searchDomains: string;
  searchPlaceholder: string;
  statusFilter: string;
  allStatuses: string;
  sortBy: string;
  rows: string;
  apply: string;
  clear: string;
  noDomains: string;
  noMatches: string;
  noDomainsHelp: string;
  noMatchesHelp: string;
  resultsSummary: (start: number, end: number, matched: number, total: number) => string;
  pageSummary: (page: number, pages: number) => string;
  status: string;
  saveStatus: string;
  saving: string;
  remove: string;
  removing: string;
  removeConfirm: (domain: string) => string;
  previous: string;
  next: string;
  installSafety: string;
  installSafetyDescription: string;
  configuredHosts: (count: number) => string;
  verifiedHosts: (count: number) => string;
  localDevelopment: (allowed: boolean) => string;
  statusGuidance: string;
  pending: string;
  pendingHelp: string;
  verified: string;
  verifiedHelp: string;
  failedOrDisabled: string;
  failedOrDisabledHelp: string;
}

const en: DomainsCopy = {
  sortLabels: {
    domain_asc: 'Domain (A-Z)',
    domain_desc: 'Domain (Z-A)',
    status_asc: 'Status (A-Z)',
    status_desc: 'Status (Z-A)',
  },
  statusLabels: { pending: 'Pending', verified: 'Verified', failed: 'Failed', disabled: 'Disabled' },
  allowedDomains: 'Allowed domains',
  allowedDomainsDescription: 'Manage the hostnames that can run the public widget for this site.',
  realBackendContract: 'Real backend contract',
  addDomain: 'Add domain',
  adding: 'Adding...',
  hostnamePlaceholder: 'example.com',
  hostnameHelp: 'Enter a bare hostname only. No protocol, port, path, or wildcard. `localhost` and `127.0.0.1` are treated as development hosts.',
  invalidHostname: 'Enter a valid hostname like example.com.',
  savingChanges: 'Saving domain changes...',
  searchDomains: 'Search domains',
  searchPlaceholder: 'Find by domain or status',
  statusFilter: 'Status filter',
  allStatuses: 'All statuses',
  sortBy: 'Sort by',
  rows: 'Rows',
  apply: 'Apply',
  clear: 'Clear',
  noDomains: 'No domains configured yet.',
  noMatches: 'No domains match the current filters.',
  noDomainsHelp: 'Add at least one production hostname before shipping the install snippet to customer sites.',
  noMatchesHelp: 'Try adjusting the search, status filter, or sorting.',
  resultsSummary: (start, end, matched, total) => `Showing ${start}-${end} of ${matched} matched domains${matched !== total ? ` (${total} total)` : ''}.`,
  pageSummary: (page, pages) => `Page ${page} of ${pages}`,
  status: 'Status',
  saveStatus: 'Save status',
  saving: 'Saving...',
  remove: 'Remove',
  removing: 'Removing...',
  removeConfirm: (domain) => `Remove ${domain} from allowed domains?`,
  previous: 'Previous',
  next: 'Next',
  installSafety: 'Install safety',
  installSafetyDescription: 'Verified production domains control where the public widget should initialize. Pending or failed entries need follow-up before rollout.',
  configuredHosts: (count) => `Configured hostnames: ${count}`,
  verifiedHosts: (count) => `Verified hostnames: ${count}`,
  localDevelopment: (allowed) => `Local development: ${allowed ? 'localhost is currently allowed.' : 'localhost protection is disabled in settings_json.'}`,
  statusGuidance: 'Status guidance',
  pending: 'Pending',
  pendingHelp: 'Use while a hostname is being prepared but should not yet be treated as production-safe.',
  verified: 'Verified',
  verifiedHelp: 'Safe state for live installs. This is the target before sharing the snippet broadly.',
  failedOrDisabled: 'Failed or disabled',
  failedOrDisabledHelp: 'Use when a hostname should stop being trusted or the validation/setup is incomplete.',
};

const ar: DomainsCopy = {
  sortLabels: {
    domain_asc: 'النطاق (أ-ي)',
    domain_desc: 'النطاق (ي-أ)',
    status_asc: 'الحالة (أ-ي)',
    status_desc: 'الحالة (ي-أ)',
  },
  statusLabels: { pending: 'قيد الانتظار', verified: 'موثّق', failed: 'فشل', disabled: 'معطّل' },
  allowedDomains: 'النطاقات المسموح بها',
  allowedDomainsDescription: 'أدِر أسماء النطاقات التي يمكنها تشغيل الأداة العامة لهذا الموقع.',
  realBackendContract: 'متصل بالنظام الفعلي',
  addDomain: 'إضافة نطاق',
  adding: 'جارٍ الإضافة...',
  hostnamePlaceholder: 'example.com',
  hostnameHelp: 'أدخل اسم النطاق فقط، من دون بروتوكول أو منفذ أو مسار أو أحرف بدل. يُعامل `localhost` و`127.0.0.1` كنطاقي تطوير.',
  invalidHostname: 'أدخل اسم نطاق صالحًا مثل example.com.',
  savingChanges: 'جارٍ حفظ تغييرات النطاقات...',
  searchDomains: 'البحث في النطاقات',
  searchPlaceholder: 'ابحث بالنطاق أو الحالة',
  statusFilter: 'تصفية حسب الحالة',
  allStatuses: 'كل الحالات',
  sortBy: 'الترتيب حسب',
  rows: 'الصفوف',
  apply: 'تطبيق',
  clear: 'مسح',
  noDomains: 'لا توجد نطاقات مضافة بعد.',
  noMatches: 'لا توجد نطاقات تطابق عوامل التصفية الحالية.',
  noDomainsHelp: 'أضف نطاق إنتاج واحدًا على الأقل قبل إرسال كود التثبيت إلى مواقع العملاء.',
  noMatchesHelp: 'جرّب تعديل البحث أو تصفية الحالة أو الترتيب.',
  resultsSummary: (start, end, matched, total) => `عرض ${start}-${end} من ${matched} نطاقات مطابقة${matched !== total ? ` (${total} إجمالًا)` : ''}.`,
  pageSummary: (page, pages) => `الصفحة ${page} من ${pages}`,
  status: 'الحالة',
  saveStatus: 'حفظ الحالة',
  saving: 'جارٍ الحفظ...',
  remove: 'إزالة',
  removing: 'جارٍ الإزالة...',
  removeConfirm: (domain) => `هل تريد إزالة ${domain} من النطاقات المسموح بها؟`,
  previous: 'السابق',
  next: 'التالي',
  installSafety: 'أمان التثبيت',
  installSafetyDescription: 'تحدد نطاقات الإنتاج الموثّقة أين يمكن تشغيل الأداة العامة. تحتاج النطاقات المعلّقة أو الفاشلة إلى متابعة قبل الإطلاق.',
  configuredHosts: (count) => `النطاقات المضافة: ${count}`,
  verifiedHosts: (count) => `النطاقات الموثّقة: ${count}`,
  localDevelopment: (allowed) => `التطوير المحلي: ${allowed ? 'يُسمح حاليًا بالنطاق localhost.' : 'حماية localhost معطّلة في settings_json.'}`,
  statusGuidance: 'إرشادات الحالات',
  pending: 'قيد الانتظار',
  pendingHelp: 'استخدمها أثناء تجهيز النطاق وقبل اعتباره آمنًا للإنتاج.',
  verified: 'موثّق',
  verifiedHelp: 'الحالة الآمنة للتثبيت الفعلي، وهي المطلوبة قبل مشاركة الكود على نطاق واسع.',
  failedOrDisabled: 'فشل أو معطّل',
  failedOrDisabledHelp: 'استخدمها عندما يجب إيقاف الثقة بالنطاق أو عندما لا يكتمل التحقق أو الإعداد.',
};

export function getDomainsCopy(locale: SiteLocale): DomainsCopy {
  return locale === 'ar' ? ar : en;
}
