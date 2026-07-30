/* Dashboard chrome in English and Arabic.

   Keyed by canonical pathname so a route's title and description stay
   together and cannot drift from the route table. Only the chrome lives
   here: navigation, page titles, descriptions, breadcrumbs. Page bodies own
   their own strings, and the try-on settings form is already translated in
   lib/try-on/settings-copy.ts, shared with the Shopify embedded admin.

   The locale is the same gc-locale cookie the marketing site and the
   storefront demo use, so a language chosen anywhere carries into here. */

import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';

export type DashboardRouteCopy = { title: string; description: string };

export interface DashboardCopy {
  home: string;
  routes: Record<string, DashboardRouteCopy>;
}

const en: DashboardCopy = {
  home: 'Dashboard',
  routes: {
    '/dashboard/overview': {
      title: 'Overview',
      description: 'The try-on business this week, across every merchant store.',
    },
    '/dashboard/agents': {
      title: 'AI Agents',
      description:
        'Preview and plan AI agents across website, social, voice, file, and CRM channels.',
    },
    '/dashboard/conversations': {
      title: 'Conversations',
      description: 'Unified inbox preview for website and social channel conversations.',
    },
    '/dashboard/messages': {
      title: 'Messages',
      description: 'Message-level preview with AI suggestions and handoff readiness.',
    },
    '/dashboard/leads': {
      title: 'Leads',
      description:
        'Preview lead qualification output from conversations, voice, forms, and files.',
    },
    '/dashboard/crm': {
      title: 'CRM',
      description: 'Pipeline preview from captured lead to implementation and conversion.',
    },
    '/dashboard/workflows': {
      title: 'Workflows',
      description: 'Workflow catalog and latest trial preview history.',
    },
    '/dashboard/try-on': {
      title: 'Try-On',
      description: 'Settings, plans, and generation history for every merchant store.',
    },
    '/dashboard/install': {
      title: 'Widget / Embed',
      description: 'Install snippet, verification concept, and widget preview panel.',
    },
    '/dashboard/integrations': {
      title: 'Integrations',
      description:
        'Connection catalog across AI, social, CRM, support, ops, data, and automation.',
    },
    '/dashboard/analytics': {
      title: 'Analytics',
      description: 'Preview trial funnel, operations metrics, and channel breakdown.',
    },
    '/dashboard/settings': {
      title: 'Settings',
      description: 'Workspace configuration and account-level controls.',
    },
    '/dashboard/implementation': {
      title: 'Implementation',
      description: 'Prepare implementation request form for real tool connections.',
    },
  },
};

const ar: DashboardCopy = {
  home: 'لوحة التحكم',
  routes: {
    '/dashboard/overview': {
      title: 'نظرة عامة',
      description: 'أداء التجربة الافتراضية هذا الأسبوع عبر كل متجر.',
    },
    '/dashboard/agents': {
      title: 'وكلاء الذكاء الاصطناعي',
      description:
        'معاينة وتخطيط وكلاء الذكاء الاصطناعي عبر الموقع والتواصل الاجتماعي والصوت والملفات وأنظمة العملاء.',
    },
    '/dashboard/conversations': {
      title: 'المحادثات',
      description: 'معاينة موحّدة لمحادثات الموقع وقنوات التواصل الاجتماعي.',
    },
    '/dashboard/messages': {
      title: 'الرسائل',
      description: 'معاينة على مستوى الرسالة مع اقتراحات الذكاء الاصطناعي وجاهزية التحويل.',
    },
    '/dashboard/leads': {
      title: 'العملاء المحتملون',
      description: 'معاينة تأهيل العملاء المحتملين من المحادثات والمكالمات والنماذج والملفات.',
    },
    '/dashboard/crm': {
      title: 'إدارة العملاء',
      description: 'معاينة المسار من التقاط العميل المحتمل حتى التنفيذ والتحويل.',
    },
    '/dashboard/workflows': {
      title: 'مسارات العمل',
      description: 'دليل مسارات العمل وسجل أحدث المعاينات التجريبية.',
    },
    '/dashboard/try-on': {
      title: 'التجربة الافتراضية',
      description: 'الإعدادات والخطط وسجل الإنشاء لكل متجر.',
    },
    '/dashboard/install': {
      title: 'الأداة والتضمين',
      description: 'كود التثبيت والتحقق ولوحة معاينة الأداة.',
    },
    '/dashboard/integrations': {
      title: 'التكاملات',
      description:
        'دليل الاتصالات عبر الذكاء الاصطناعي والتواصل الاجتماعي وإدارة العملاء والدعم والعمليات والبيانات والأتمتة.',
    },
    '/dashboard/analytics': {
      title: 'التحليلات',
      description: 'معاينة مسار التجربة ومؤشرات التشغيل وتوزيع القنوات.',
    },
    '/dashboard/settings': {
      title: 'الإعدادات',
      description: 'إعدادات مساحة العمل وضوابط الحساب.',
    },
    '/dashboard/implementation': {
      title: 'التنفيذ',
      description: 'تجهيز نموذج طلب التنفيذ لربط الأدوات الحقيقية.',
    },
  },
};

export function getDashboardCopy(locale: SiteLocale = DEFAULT_SITE_LOCALE): DashboardCopy {
  return locale === 'ar' ? ar : en;
}
