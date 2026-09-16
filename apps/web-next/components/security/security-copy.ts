import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface SecurityListItem {
  label: string;
  note: string;
  status: string;
}

export interface SecurityCopy {
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  bookCall: string;

  accessEyebrow: string;
  accessTitle: string;
  accessBody: string;
  accessItems: string[];

  photosEyebrow: string;
  photosTitle: string;
  photosBody: string;
  photosItems: string[];

  privacyEyebrow: string;
  privacyTitle: string;
  privacyBody: string;
  privacyItems: string[];
  privacyNote: string;

  analyticsEyebrow: string;
  analyticsTitle: string;
  analyticsItems: string[];

  safeguardsEyebrow: string;
  safeguardsTitle: string;
  safeguardsItems: string[];

  processorsEyebrow: string;
  processorsTitle: string;
  processorsBody: string;
  processorsItems: SecurityListItem[];

  notLiveEyebrow: string;
  notLiveTitle: string;
  notLiveItems: SecurityListItem[];

  reportingEyebrow: string;
  reportingTitle: string;
  reportingBody: string;
  reportingEmailLabel: string;
}

const en: SecurityCopy = {
  heroEyebrow: 'Security',
  heroTitle: 'How we protect your store and your shoppers’ data.',
  heroLead:
    'What the product does today to protect store and shopper data, what it does not do yet, and where the limits are.',
  bookCall: 'Book a call',

  accessEyebrow: 'Access and tenant isolation',
  accessTitle: 'Your data stays inside your workspace.',
  accessBody:
    'Every dashboard session is verified, and every action is checked against the workspace that owns it, on every request.',
  accessItems: [
    'Dashboard access requires a signed-in session, checked in middleware and again on every page you load.',
    'Each merchant’s sites, leads, domains, and conversations are resolved from your session server-side. You only ever see your own workspace.',
    'Every action that changes a site, domain, or intent re-checks that it belongs to your workspace before it runs, not just once at login.',
    'Requests from Shopify are verified before we trust them: signed OAuth callbacks, signed embedded-app session tokens, and signed storefront requests.',
    'Shopify Admin API tokens are encrypted at rest (AES-256-GCM). The database key with full access never reaches the browser; the browser only ever gets a locked-down key with no access to tenant tables.',
  ],

  photosEyebrow: 'Shopper photos and data retention',
  photosTitle: 'Your photo is not kept longer than it needs to be.',
  photosBody: 'What happens to a photo from the moment you upload it for a try-on.',
  photosItems: [
    'Your try-on photo is sent directly to our AI provider to generate the preview. We do not store the uploaded photo on our servers.',
    'The generated result is kept for up to 30 minutes, then automatically deleted by a cleanup job that runs every 10 minutes.',
    'The generated result is only reachable through short-lived signed links, capped at 5 minutes and tied to your own session. It never has a public URL.',
  ],

  privacyEyebrow: 'Shopify data and privacy requests',
  privacyTitle: 'Shopify privacy requests are verified, recorded, and handled.',
  privacyBody:
    'We receive Shopify’s three mandatory privacy webhooks. Each one is signature-verified and recorded the moment it arrives, and our team is notified by email.',
  privacyItems: [
    'Shop redact (after uninstall): the store’s operational data is removed. Billing and transaction records are kept for accounting and legal purposes.',
    'Customer redact: that customer’s matched visitor record, conversations, and uploaded attachments are removed.',
    'Customer data request: the records we hold on that customer are compiled for the merchant, who responds to the shopper, as Shopify’s process requires.',
  ],
  privacyNote: 'Automated fulfillment of these requests is built but currently switched off. Today our team fulfills each request after it is recorded.',

  analyticsEyebrow: 'Analytics and monitoring',
  analyticsTitle: 'Nothing is tracked until you say yes.',
  analyticsItems: [
    'No analytics events or analytics cookies are collected until a visitor gives consent. The default is off.',
    'What we track is behavior, like which step a shopper reached, not personal content. No photos, emails, phone numbers, or message text are ever sent to analytics.',
    'Short-lived authentication tokens in URLs are stripped before any error or analytics event leaves your browser or our servers.',
    'Error and performance monitoring runs across the app so we can fix problems. It is not tied to the analytics choice, and the same token scrubbing applies.',
  ],

  safeguardsEyebrow: 'Application safeguards',
  safeguardsTitle: 'Guardrails on the parts that touch money, data, and the AI.',
  safeguardsItems: [
    'API requests are rate-limited per IP and session. If the rate limiter itself is unavailable, requests are rejected rather than let through unchecked.',
    'Knowledge-base URL imports are restricted to public HTTPS destinations and block known private and internal network addresses.',
    'The support AI treats store knowledge, merchant notes, and shopper messages as reference data, never as instructions. Account and order actions are authorized by your verified session, never by anything the AI outputs.',
    'Calls to AI providers are bounded by a hard timeout and are not automatically retried, so a stalled provider cannot cascade into duplicate work.',
    'Every release runs a dependency audit and a container vulnerability scan before it can ship. The exact image we deploy is re-scanned, and each deploy is verified live against the deployed commit before it is considered complete.',
  ],

  processorsEyebrow: 'Service providers that process data',
  processorsTitle: 'Who else touches your data, and why.',
  processorsBody: 'This reflects what is actually wired into the product today. It changes if we add or remove a provider.',
  processorsItems: [
    {
      label: 'OpenRouter',
      status: 'AI image generation',
      note: 'Receives your try-on photo and the garment image to generate the preview, and image attachments sent in support chat. We have not independently verified OpenRouter’s own data-retention terms.',
    },
    {
      label: 'Groq',
      status: 'AI chat and voice',
      note: 'Receives conversation text and voice audio to power chat replies, speech-to-text, and text-to-speech. Photos are never sent to Groq.',
    },
    {
      label: 'Supabase',
      status: 'Database and file storage',
      note: 'Stores operational and support data, conversations, and uploaded try-on results, behind access restricted to our backend. Nothing in these tables is publicly reachable.',
    },
    {
      label: 'Clerk',
      status: 'Merchant sign-in',
      note: 'Handles dashboard authentication and holds the account email linked to your sign-in.',
    },
    {
      label: 'Gmail SMTP',
      status: 'Email delivery',
      note: 'Sends Store Chat handoff notifications to your team and privacy-request alerts to ours. An outreach email sender for prospective merchants exists in the code but is switched off in production.',
    },
    {
      label: 'Sentry',
      status: 'Error and performance monitoring',
      note: 'Receives error reports, stack traces, and page addresses with sign-in tokens removed. Runs for every visitor to keep the service working.',
    },
    {
      label: 'PostHog',
      status: 'Product analytics',
      note: 'Receives usage events only after a visitor allows analytics. No photos, message text, emails, or phone numbers.',
    },
    {
      label: 'Upstash',
      status: 'Rate limiting',
      note: 'Receives the requester’s IP address and request keys to enforce usage limits.',
    },
    {
      label: 'Hostinger',
      status: 'Application hosting',
      note: 'Runs the servers that serve this site and the app, so all traffic passes through it.',
    },
  ],

  notLiveEyebrow: 'Honest about scope',
  notLiveTitle: 'Not in place yet',
  notLiveItems: [
    {
      label: 'Independent security certification or audit',
      note: 'No third-party security certification or audit report exists today.',
      status: 'Not available',
    },
    {
      label: 'Public status page',
      note: 'There is no public uptime or incident status page yet.',
      status: 'Not available',
    },
    {
      label: 'Customer-facing data processing agreement (DPA)',
      note: 'A standard DPA for merchants is not available yet.',
      status: 'Not available',
    },
    {
      label: 'Privacy policy and terms of service',
      note: 'Published privacy policy and terms of service pages are pending.',
      status: 'Pending',
    },
    {
      label: 'Role-based permissions within a workspace',
      note: 'Every workspace member currently has the same dashboard capabilities as the owner. Per-role permissions are not enforced yet.',
      status: 'Not available',
    },
  ],

  reportingEyebrow: 'Reporting a concern',
  reportingTitle: 'Found something? Tell us directly.',
  reportingBody:
    'If you find a vulnerability or have a concern about how we handle data, email us and we will follow up directly.',
  reportingEmailLabel: 'Email',
};

const ar: SecurityCopy = {
  heroEyebrow: 'الأمان',
  heroTitle: 'كيف نحمي متجرك وبيانات عملائك.',
  heroLead:
    'ما يفعله المنتج اليوم لحماية بيانات المتجر والعملاء، وما لم يُفعّل بعد، وأين تقع الحدود.',
  bookCall: 'احجز مكالمة',

  accessEyebrow: 'الوصول وعزل بيانات كل متجر',
  accessTitle: 'بياناتك تبقى داخل مساحة عملك الخاصة.',
  accessBody:
    'كل جلسة في لوحة التحكم يتم التحقق منها، وكل إجراء يُفحص مقابل مساحة العمل المالكة له، في كل طلب.',
  accessItems: [
    'الوصول إلى لوحة التحكم يتطلب جلسة دخول موثقة، يتم التحقق منها في الوسيط ومرة أخرى في كل صفحة تفتحها.',
    'يتم تحديد متاجر وعملاء محتملين ونطاقات ومحادثات كل متجر من جلسته على الخادم. لن ترى سوى مساحة عملك الخاصة.',
    'كل إجراء يغيّر موقعًا أو نطاقًا أو نية يُعيد التحقق من أنه تابع لمساحة عملك قبل تنفيذه، وليس فقط مرة واحدة عند تسجيل الدخول.',
    'يُتحقق من طلبات Shopify قبل الوثوق بها: ردود OAuth موقّعة، ورموز جلسة موقّعة للتطبيق المدمج، وطلبات واجهة متجر موقّعة.',
    'رموز Shopify Admin API مشفرة أثناء التخزين (AES-256-GCM). مفتاح قاعدة البيانات الكامل الصلاحية لا يصل أبدًا إلى المتصفّح؛ يحصل المتصفّح فقط على مفتاح مقيّد بلا أي صلاحية للوصول إلى جداول المتاجر.',
  ],

  photosEyebrow: 'صور العملاء والاحتفاظ بالبيانات',
  photosTitle: 'صورتك لا تُحفظ أطول مما يلزم.',
  photosBody: 'ما يحدث للصورة من لحظة رفعها للتجربة الافتراضية.',
  photosItems: [
    'تُرسل صورة التجربة الافتراضية مباشرة إلى مزوّد الذكاء الاصطناعي لدينا لتوليد المعاينة. لا نخزّن الصورة المرفوعة على خوادمنا.',
    'يُحتفظ بالنتيجة المولّدة لمدة أقصاها 30 دقيقة، ثم تُحذف تلقائيًا بواسطة مهمة تنظيف تعمل كل 10 دقائق.',
    'لا يمكن الوصول إلى النتيجة المولّدة إلا عبر روابط موقّعة قصيرة الأجل، بحد أقصى 5 دقائق ومرتبطة بجلستك أنت. لا يوجد لها رابط عام.',
  ],

  privacyEyebrow: 'بيانات Shopify وطلبات الخصوصية',
  privacyTitle: 'طلبات الخصوصية من Shopify يتم التحقق منها وتسجيلها ومعالجتها.',
  privacyBody:
    'نستقبل webhooks الخصوصية الثلاث الإلزامية من Shopify. يُتحقّق من توقيع كل طلب ويُسجَّل لحظة وصوله، ويُبلَّغ فريقنا بالبريد الإلكتروني.',
  privacyItems: [
    'حذف بيانات المتجر (بعد إلغاء التثبيت): تُزال البيانات التشغيلية للمتجر، وتُحفظ سجلات الفواتير والمعاملات لأغراض محاسبية وقانونية.',
    'حذف بيانات العميل: يُزال سجل الزائر المطابق لذلك العميل ومحادثاته ومرفقاته المرفوعة.',
    'طلب بيانات العميل: تُجمع السجلات التي نحتفظ بها عن ذلك العميل وتُسلَّم إلى المتجر، الذي يرد على العميل وفق آلية Shopify.',
  ],
  privacyNote: 'تنفيذ هذه الطلبات تلقائيًا مبنيّ لكنه معطّل حاليًا. يتولّى فريقنا اليوم تنفيذ كل طلب بعد تسجيله.',

  analyticsEyebrow: 'التحليلات والمراقبة',
  analyticsTitle: 'لا شيء يُتابع قبل موافقتك.',
  analyticsItems: [
    'لا تُجمع أي أحداث تحليلية أو ملفات تعريف ارتباط تحليلية قبل موافقة الزائر. الوضع الافتراضي معطّل.',
    'نتابع السلوك، مثل الخطوة التي وصلها العميل، لا المحتوى الشخصي. لا تُرسل أي صور أو بريد إلكتروني أو رقم هاتف أو نص الرسائل إلى أدوات التحليل.',
    'تُزال رموز التوثيق قصيرة الأجل من الروابط قبل أن يُرسل أي خطأ أو حدث تحليلي من متصفّحك أو من خوادمنا.',
    'تعمل مراقبة الأخطاء والأداء في التطبيق كله حتى نصلح المشكلات. لا ترتبط باختيار التحليلات، وتُطبَّق عليها نفس آلية إزالة الرموز.',
  ],

  safeguardsEyebrow: 'ضمانات التطبيق',
  safeguardsTitle: 'حواجز حماية على الأجزاء التي تلمس الأموال والبيانات والذكاء الاصطناعي.',
  safeguardsItems: [
    'طلبات الواجهة البرمجية محدودة المعدل لكل عنوان IP ولكل جلسة. إذا تعذّر الوصول إلى خدمة التحديد ذاتها، تُرفض الطلبات بدلاً من السماح لها بالمرور دون ضابط.',
    'استيراد الروابط إلى قاعدة المعرفة مقتصر على وجهات HTTPS العامة، ويمنع عناوين الشبكات الخاصة والداخلية المعروفة.',
    'يتعامل ذكاء الدعم مع معرفة المتجر وملاحظاته ورسائل العملاء بوصفها بيانات مرجعية، وليس تعليمات. إجراءات الحساب والطلب يُصرّح بها بناءً على جلستك الموثّقة، وليس بناءً على أي شيء يصدره الذكاء الاصطناعي.',
    'مكالمات مزوّدي الذكاء الاصطناعي محدودة بمهلة قصوى، ولا تُعاد تلقائيًا، فلا يسبّب توقف المزوّد عملاً مكررًا بالخطأ.',
    'يُجري في كل إصدار فحص للتبعيات وفحص أمني للحاوية قبل الإطلاق. يُعاد فحص الصورة المحدّدة التي سيتم نشرها، ويُتحقّق من كل إطلاق مقابل الإصدار المنشور قبل اعتباره مكتملاً.',
  ],

  processorsEyebrow: 'مزوّدو الخدمات الذين يعالجون البيانات',
  processorsTitle: 'من يصل إلى بياناتك أيضًا، ولماذا.',
  processorsBody: 'يعكس هذا ما هو مفعّل فعلاً في المنتج اليوم، ويتغيّر إذا أضفنا أو أزلنا مزوّدًا.',
  processorsItems: [
    {
      label: 'OpenRouter',
      status: 'توليد صور بالذكاء الاصطناعي',
      note: 'يستلم صورة التجربة الافتراضية وصورة المنتج لتوليد المعاينة، ومرفقات الصور المرسلة في محادثة الدعم. لم نتحقق بشكل مستقل من سياسة الاحتفاظ بالبيانات الخاصة بـ OpenRouter.',
    },
    {
      label: 'Groq',
      status: 'المحادثة النصية والصوتية بالذكاء الاصطناعي',
      note: 'يستلم نص المحادثة والمقاطع الصوتية لتشغيل ردود المحادثة وتحويل الصوت إلى نص والعكس. لا تُرسل أي صور إلى Groq أبدًا.',
    },
    {
      label: 'Supabase',
      status: 'قاعدة البيانات وتخزين الملفات',
      note: 'يخزّن البيانات التشغيلية وبيانات الدعم والمحادثات ونتائج التجربة المرفوعة، خلف وصول مقتصر على خوادمنا. لا شيء في هذه الجداول قابل للوصول العام.',
    },
    {
      label: 'Clerk',
      status: 'تسجيل دخول المتجر',
      note: 'يتولّى المصادقة على هوية لوحة التحكم ويحتفظ بالبريد الإلكتروني المرتبط بحسابك.',
    },
    {
      label: 'بريد Gmail SMTP',
      status: 'توصيل البريد الإلكتروني',
      note: 'يرسل إشعارات تحويل محادثات دردشة المتجر إلى فريقك، وتنبيهات طلبات الخصوصية إلى فريقنا. توجد في الكود أداة لإرسال رسائل تعريفية للتجار المحتملين، لكنها معطّلة في بيئة الإنتاج.',
    },
    {
      label: 'Sentry',
      status: 'مراقبة الأخطاء والأداء',
      note: 'يستلم تقارير الأخطاء وتتبّعها وعناوين الصفحات بعد إزالة رموز الدخول. يعمل لكل زائر حتى تبقى الخدمة تعمل.',
    },
    {
      label: 'PostHog',
      status: 'تحليلات المنتج',
      note: 'يستلم أحداث الاستخدام فقط بعد أن يسمح الزائر بالتحليلات، بلا صور أو نصوص رسائل أو بريد إلكتروني أو أرقام هاتف.',
    },
    {
      label: 'Upstash',
      status: 'تحديد معدل الطلبات',
      note: 'يستلم عنوان IP لمرسل الطلب ومفاتيح الطلب لتطبيق حدود الاستخدام.',
    },
    {
      label: 'Hostinger',
      status: 'استضافة التطبيق',
      note: 'يشغّل الخوادم التي تقدّم هذا الموقع والتطبيق، لذلك تمر عبره كل الزيارات.',
    },
  ],

  notLiveEyebrow: 'بصراحة عن النطاق',
  notLiveTitle: 'ما لم يُفعّل بعد',
  notLiveItems: [
    {
      label: 'شهادة أمنية مستقلة أو تدقيق',
      note: 'لا توجد شهادة أمنية من طرف ثالث أو تقرير تدقيق حتى الآن.',
      status: 'غير متوفر',
    },
    {
      label: 'صفحة حالة عامة',
      note: 'لا توجد بعد صفحة عامة تعرض وقت التشغيل أو الأعطال.',
      status: 'غير متوفر',
    },
    {
      label: 'اتفاقية معالجة بيانات موجّهة للعملاء (DPA)',
      note: 'لا تتوفر بعد اتفاقية معالجة بيانات موحّدة للتجار.',
      status: 'غير متوفر',
    },
    {
      label: 'سياسة الخصوصية وشروط الخدمة',
      note: 'صفحتا سياسة الخصوصية وشروط الخدمة المنشورتان قيد الإعداد.',
      status: 'قيد الإعداد',
    },
    {
      label: 'صلاحيات مبنية على الدور داخل مساحة العمل',
      note: 'يملك كل عضو في مساحة العمل حاليًا نفس صلاحيات لوحة التحكم التي يملكها المالك. الصلاحيات المبنية على الدور غير مفعّلة بعد.',
      status: 'غير متوفر',
    },
  ],

  reportingEyebrow: 'الإبلاغ عن مشكلة',
  reportingTitle: 'وجدت شيئًا؟ أخبرنا مباشرة.',
  reportingBody:
    'إذا وجدت ثغرة أمنية أو لديك قلق بشأن طريقة تعاملنا مع البيانات، راسلنا وسنتابع معك مباشرة.',
  reportingEmailLabel: 'راسلنا على',
};

/* Owner-approved public contact for privacy and security reports (2026-09-17). */
export const SECURITY_CONTACT_EMAIL = 'grindctrlnow@gmail.com';

export function getSecurityCopy(locale: SiteLocale): SecurityCopy {
  return locale === 'ar' ? ar : en;
}
