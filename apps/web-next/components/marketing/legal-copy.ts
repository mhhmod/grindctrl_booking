import type { SiteLocale } from '@/lib/landing/landing-i18n';

// Published copy is maintained with docs/legal/*-draft.md.
export const LEGAL_CONTACT_EMAIL = 'grindctrlnow@gmail.com';
export const LEGAL_UPDATED = '2026-11-01';
export type LegalPage = 'privacy' | 'terms';

interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

interface LegalCopy {
  eyebrow: string;
  title: string;
  lead: string;
  sectionLabel: string;
  relatedLabel: string;
  securityLabel: string;
  updatedLabel: string;
  sections: LegalSection[];
}

export const legalCopy: Record<LegalPage, Record<SiteLocale, LegalCopy>> = {
  "privacy": {
    "en": {
      "eyebrow": "Legal",
      "title": "Privacy policy",
      "lead": "How Grind CTRL handles merchant and shopper information, privacy requests, and retention.",
      "sectionLabel": "Section",
      "relatedLabel": "Terms of service",
      "securityLabel": "Security",
      "updatedLabel": "Last updated",
      "sections": [
        {
          "id": "who-we-are",
          "title": "Who we are",
          "paragraphs": [
            "Grind CTRL (\"GrindCTRL\", \"we\", \"us\", or \"our\") operates an AI-powered virtual try-on and customer chat product for Shopify merchants from Egypt, available at grindctrl.cloud and as Shopify apps.",
            "Grind CTRL is the privacy operator. Contact us about privacy at grindctrlnow@gmail.com."
          ]
        },
        {
          "id": "scope",
          "title": "Who this policy covers",
          "paragraphs": [
            "For merchant account data, including sign-in identity, workspace settings, and billing communications, we act as the controller. We decide how this information is used to operate the service.",
            "For shopper data collected through a merchant’s storefront, including photos, chat messages, and contact details, we act as a processor or service provider on the merchant’s behalf. The merchant controls the relationship with their shoppers and is responsible for their own privacy notice and lawful basis for processing."
          ]
        },
        {
          "id": "information",
          "title": "Information we collect",
          "items": [
            "Merchant account identity: your Clerk-issued user ID and account email, used to sign you in.",
            "Workspace and store information: store domain, connected Shopify shop, workspace settings, plan, and credit balance.",
            "Shopify Admin API access tokens: issued on installation, encrypted at rest using AES-256-GCM, and used to operate the app for your store.",
            "Content you provide: Store Chat knowledge articles, saved replies, URLs submitted for knowledge imports, and communications when you email us or book a call.",
            "Try-on photos: your uploaded photo is sent to the AI image provider to generate a preview. We do not store the uploaded photo on our servers. Generated results are stored temporarily under the retention rules below.",
            "Store Chat: messages, conversation history, image attachments, and your name and email if provided. Attachments may be sent to our AI provider for handling.",
            "Order lookups: a signed-in shopper’s verified Shopify customer identity is used to look up their orders. Otherwise, order number and email are requested to verify the shopper before showing order details.",
            "Error and performance data: Sentry receives error reports and page addresses to help keep the service working. Authentication tokens in page URLs are stripped before transmission.",
            "Product analytics: PostHog receives usage events only after active consent. Events do not include photos, message text, email addresses, or phone numbers.",
            "Rate limiting: Upstash processes requester IP addresses and request identifiers to enforce usage limits. Requests are denied if the limiter is unavailable."
          ]
        },
        {
          "id": "uses",
          "title": "How we use information",
          "paragraphs": [
            "We do not sell personal data or use shopper photos, chat content, or order data for advertising."
          ],
          "items": [
            "Provide virtual try-on, Store Chat, and merchant account features.",
            "Manage authentication, workspace access, plans, credits, and support.",
            "Detect abuse and keep the service available through rate limiting and error monitoring.",
            "Respond to Shopify privacy requests on the merchant’s behalf.",
            "Improve the product using analytics only when a visitor has consented.",
            "Communicate with merchants about accounts, billing, and support."
          ]
        },
        {
          "id": "providers",
          "title": "Service providers",
          "paragraphs": [
            "The following providers support the service. We have not independently reviewed OpenRouter’s or Groq’s own data-retention or training-use terms. We do not have signed Data Processing Agreements with merchants at this time."
          ],
          "items": [
            "OpenRouter: AI image generation. Receives the shopper’s try-on photo and garment image, and image attachments sent in Store Chat.",
            "Groq: AI chat and voice. Receives conversation text and voice audio for replies, speech-to-text, and text-to-speech, not photos.",
            "Supabase: database and file storage for operational, support, and generated result data, accessed through server-side controls.",
            "Clerk: merchant sign-in, account email, and authentication identity.",
            "Gmail SMTP: account emails, team notifications, privacy-request alerts, and customer data exports sent to the privacy operator for delivery to the merchant.",
            "Sentry: error reports, stack traces, and page addresses with sign-in tokens removed.",
            "PostHog: product usage events after consent.",
            "Upstash: requester IP addresses and request keys for rate limiting.",
            "Hostinger: application hosting. Site and app traffic passes through its infrastructure."
          ]
        },
        {
          "id": "retention",
          "title": "Data retention",
          "items": [
            "Uploaded try-on photos are not stored on our servers. Provider retention is not yet independently confirmed.",
            "Generated try-on results are deleted when your browser has received them. Otherwise they remain readable for at most 10 minutes, with remaining files deleted by a cleanup job that runs every 10 minutes. Signed result links are valid for up to 5 minutes.",
            "Store Chat conversations, messages, and attachments are deleted 12 months after the conversation’s last activity. Visitor records are deleted once no conversation requiring retention remains; a visitor record with no conversation is deleted after 12 months of inactivity.",
            "Merchant account and workspace information is kept for the life of the account. Request account deletion by email to grindctrlnow@gmail.com. We complete account deletion within 30 days, subject to records that must be retained by law.",
            "Billing and credit ledger records are kept for as long as accounting law requires and are never altered by privacy deletion. Job or subscription records needed to preserve their accounting links are retained for that purpose; generated images are removed.",
            "Sentry retention follows the configured monitoring settings. We have not independently confirmed its retention period."
          ]
        },
        {
          "id": "photos",
          "title": "Shopper photos",
          "paragraphs": [
            "Your uploaded try-on photo is sent to our AI image provider with a request to use providers that do not collect data. We do not store the upload on our own servers.",
            "Only the generated result is stored temporarily. It is accessible through a short-lived signed link tied to your session, not a public URL, and the session lasts at most 10 minutes.",
            "We have not confirmed whether the image provider retains your photo. A request for providers that do not collect data is not a guarantee of zero provider retention."
          ]
        },
        {
          "id": "cookies",
          "title": "Cookies and consent",
          "items": [
            "Essential authentication cookies are set by Clerk to keep merchants signed in. They are required for the dashboard and are not used for tracking.",
            "Analytics is off by default. Analytics events and cookies start only after active opt-in on the marketing site. You can change this choice at any time using the analytics control in the footer.",
            "Error monitoring operates independently of analytics consent to detect and fix problems. It is configured to avoid personal content and remove authentication tokens from URLs."
          ]
        },
        {
          "id": "shopify-requests",
          "title": "Shopify privacy requests",
          "paragraphs": [
            "We verify the signatures of Shopify’s mandatory privacy webhooks and durably record each request. Grind CTRL completes every Shopify privacy request within 30 days of receipt.",
            "The operator is notified by email on receipt and reminded when a request reaches 21 days without completion. If email delivery is unavailable, the request remains pending for follow-up.",
            "Deletion is automatic only when the store’s data has one eligible installation owner and no other app’s installation for that store is active. Shared or uncertain ownership is handled manually to protect the other app’s data."
          ],
          "items": [
            "Customer data request: we compile the matched visitor records, conversations, and messages for that customer and shop. The export is emailed to the privacy operator to forward to the merchant, who responds to the shopper. The request remains pending delivery until the operator records delivery.",
            "Customer redact: we delete the customer’s matched visitor records, conversations, messages, and uploaded attachments for that shop.",
            "Shop redact after uninstall: we remove the store’s operational data, including eligible try-on jobs and subscriptions, settings, the stored Shopify access token, chat sites, visitors, conversations, messages, and stored attachments and result images. Billing and credit ledger records, and job or subscription records needed to preserve accounting links, are retained as described above."
          ]
        },
        {
          "id": "rights",
          "title": "Your rights and account deletion",
          "paragraphs": [
            "Depending on applicable law, you may have rights to access, correct, delete, or export personal information, or to object to or restrict certain processing. Email grindctrlnow@gmail.com to exercise these rights or request account deletion. Account deletion is handled by email and completed within 30 days, subject to legally required retention.",
            "If you are a shopper, we may direct your request to the merchant, consistent with our processor role, unless we are required to handle it directly.",
            "We have not completed a jurisdiction-by-jurisdiction assessment of applicable privacy regimes. Nothing in this policy limits rights you have under applicable law."
          ]
        },
        {
          "id": "security",
          "title": "Security",
          "paragraphs": [
            "Our Security page describes tenant isolation, encryption of Shopify access tokens, rate limiting, and release verification.",
            "We do not have an independent security certification or audit, or a customer-facing Data Processing Agreement. We do not claim that these are in place."
          ]
        },
        {
          "id": "transfers",
          "title": "International data transfers",
          "paragraphs": [
            "Our providers may process data outside Egypt. We have not completed a map of provider processing and storage locations or verified applicable transfer safeguards, including EU Standard Contractual Clauses. We do not claim that a particular international transfer mechanism has been verified."
          ]
        },
        {
          "id": "children",
          "title": "Children’s privacy",
          "paragraphs": [
            "GrindCTRL is intended for businesses and their adult customers, not children. We do not knowingly collect personal data from children. The product does not currently include age verification."
          ]
        },
        {
          "id": "changes",
          "title": "Changes to this policy",
          "paragraphs": [
            "We may update this policy as the product changes and will update the date below. We will also communicate material changes affecting shopper data processed on a merchant’s behalf to merchants."
          ]
        },
        {
          "id": "contact",
          "title": "Contact us",
          "paragraphs": [
            "Grind CTRL, Egypt. Privacy operator: Grind CTRL.",
            "Email grindctrlnow@gmail.com for privacy questions, access requests, or account deletion."
          ]
        }
      ]
    },
    "ar": {
      "eyebrow": "المعلومات القانونية",
      "title": "سياسة الخصوصية",
      "lead": "كيف تتعامل Grind CTRL مع معلومات التجار والمتسوقين وطلبات الخصوصية وفترات الاحتفاظ بالبيانات.",
      "sectionLabel": "القسم",
      "relatedLabel": "شروط الخدمة",
      "securityLabel": "الأمان",
      "updatedLabel": "آخر تحديث",
      "sections": [
        {
          "id": "who-we-are",
          "title": "من نحن",
          "paragraphs": [
            "تدير Grind CTRL، ويشار إليها أيضاً باسم GrindCTRL أو «نحن»، خدمة قياس افتراضي ومحادثة عملاء بالذكاء الاصطناعي لتجار Shopify من مصر. تتوفر الخدمة على grindctrl.cloud ومن خلال تطبيقات Shopify.",
            "تتولى Grind CTRL مسؤولية تنفيذ طلبات الخصوصية. للتواصل بشأن الخصوصية: grindctrlnow@gmail.com."
          ]
        },
        {
          "id": "scope",
          "title": "نطاق هذه السياسة",
          "paragraphs": [
            "نحن المتحكم في بيانات حساب التاجر، بما في ذلك هوية تسجيل الدخول وإعدادات مساحة العمل ومراسلات الفوترة. نحدد كيفية استخدام هذه المعلومات لتشغيل الخدمة.",
            "نعمل كمعالج بيانات أو مقدم خدمة نيابة عن التاجر بالنسبة لبيانات المتسوقين التي تُجمع عبر متجره، ومنها الصور والرسائل وبيانات الاتصال. يتحكم التاجر في علاقته بمتسوقيه ويتحمل مسؤولية إشعار الخصوصية الخاص به والأساس القانوني للمعالجة."
          ]
        },
        {
          "id": "information",
          "title": "المعلومات التي نجمعها",
          "items": [
            "هوية حساب التاجر: معرّف المستخدم الصادر من Clerk والبريد الإلكتروني للحساب، لتسجيل الدخول.",
            "معلومات مساحة العمل والمتجر: نطاق المتجر ومتجر Shopify المرتبط وإعدادات مساحة العمل والخطة ورصيد الوحدات.",
            "رموز الوصول إلى واجهة Shopify Admin API: تصدر عند التثبيت، وتُخزن مشفرة باستخدام AES-256-GCM، وتُستخدم لتشغيل التطبيق لمتجرك.",
            "المحتوى الذي تقدمه: مقالات معرفة Store Chat والردود المحفوظة والروابط المقدمة لاستيراد المعرفة ومراسلات البريد الإلكتروني أو حجز المكالمات.",
            "صور القياس الافتراضي: تُرسل الصورة التي ترفعها إلى مزود توليد الصور لإنشاء المعاينة. لا نخزن الصورة المرفوعة على خوادمنا. تُخزن النتائج مؤقتاً وفق قواعد الاحتفاظ أدناه.",
            "Store Chat: الرسائل وسجل المحادثات ومرفقات الصور واسمك وبريدك الإلكتروني إذا قدمتهما. قد تُرسل المرفقات إلى مزود الذكاء الاصطناعي لمعالجتها.",
            "البحث عن الطلبات: تُستخدم هوية عميل Shopify المتحقق منها للمتسوق المسجل دخوله للبحث عن طلباته. وإلا نطلب رقم الطلب والبريد الإلكتروني للتحقق قبل عرض تفاصيل الطلب.",
            "بيانات الأخطاء والأداء: تتلقى Sentry تقارير الأخطاء وعناوين الصفحات للمساعدة في تشغيل الخدمة. تُزال رموز المصادقة من عناوين الصفحات قبل إرسالها.",
            "تحليلات المنتج: تتلقى PostHog أحداث الاستخدام بعد موافقة صريحة فقط. لا تشمل الأحداث الصور أو نصوص الرسائل أو عناوين البريد الإلكتروني أو أرقام الهاتف.",
            "تحديد معدل الطلبات: تعالج Upstash عناوين IP ومعرّفات الطلبات لفرض حدود الاستخدام. تُرفض الطلبات إذا تعذر تشغيل محدد المعدل."
          ]
        },
        {
          "id": "uses",
          "title": "كيف نستخدم المعلومات",
          "paragraphs": [
            "لا نبيع البيانات الشخصية، ولا نستخدم صور المتسوقين أو محتوى المحادثات أو بيانات الطلبات للإعلانات."
          ],
          "items": [
            "تقديم القياس الافتراضي وStore Chat وميزات حساب التاجر.",
            "إدارة المصادقة والوصول إلى مساحة العمل والخطط والوحدات والدعم.",
            "اكتشاف إساءة الاستخدام والحفاظ على توفر الخدمة عبر تحديد المعدل ومراقبة الأخطاء.",
            "الاستجابة لطلبات خصوصية Shopify نيابة عن التاجر.",
            "تحسين المنتج باستخدام التحليلات بعد موافقة الزائر فقط.",
            "التواصل مع التجار بشأن الحسابات والفوترة والدعم."
          ]
        },
        {
          "id": "providers",
          "title": "مقدمو الخدمة",
          "paragraphs": [
            "يدعم مقدمو الخدمة التاليون تشغيل المنتج. لم نراجع بصورة مستقلة شروط OpenRouter أو Groq الخاصة بالاحتفاظ بالبيانات أو استخدامها في التدريب. لا توجد حالياً اتفاقيات معالجة بيانات موقعة بيننا وبين التجار."
          ],
          "items": [
            "OpenRouter: توليد الصور بالذكاء الاصطناعي. يتلقى صورة المتسوق وصورة الملابس للقياس الافتراضي، ومرفقات الصور في Store Chat.",
            "Groq: المحادثة والصوت بالذكاء الاصطناعي. يتلقى نص المحادثة والصوت لإنشاء الردود وتحويل الكلام إلى نص والنص إلى كلام، ولا يتلقى الصور.",
            "Supabase: قاعدة البيانات وتخزين الملفات للبيانات التشغيلية وبيانات الدعم والصور الناتجة، مع ضوابط وصول على الخادم.",
            "Clerk: تسجيل دخول التجار والبريد الإلكتروني للحساب وهوية المصادقة.",
            "Gmail SMTP: رسائل الحساب وإشعارات الفريق وتنبيهات الخصوصية وصادرات بيانات العملاء المرسلة إلى مسؤول الخصوصية لتسليمها إلى التاجر.",
            "Sentry: تقارير الأخطاء وسجلاتها وعناوين الصفحات بعد إزالة رموز تسجيل الدخول.",
            "PostHog: أحداث استخدام المنتج بعد الموافقة.",
            "Upstash: عناوين IP ومفاتيح الطلبات لتحديد المعدل.",
            "Hostinger: استضافة التطبيق. تمر حركة الموقع والتطبيق عبر بنيته التحتية."
          ]
        },
        {
          "id": "retention",
          "title": "الاحتفاظ بالبيانات",
          "items": [
            "لا نخزن صور القياس الافتراضي المرفوعة على خوادمنا. لم نتحقق بصورة مستقلة من مدة احتفاظ المزود بها.",
            "تُحذف نتائج القياس الافتراضي بعد استلام المتصفح لها. وإلا تظل قابلة للقراءة لمدة أقصاها 10 دقائق، وتُحذف الملفات المتبقية بواسطة مهمة تنظيف تعمل كل 10 دقائق. صلاحية روابط النتائج الموقعة تصل إلى 5 دقائق.",
            "تُحذف محادثات Store Chat ورسائلها ومرفقاتها بعد 12 شهراً من آخر نشاط في المحادثة. تُحذف سجلات الزوار عند عدم بقاء محادثة تستلزم الاحتفاظ بها؛ ويُحذف سجل الزائر الذي لا توجد له محادثة بعد 12 شهراً من عدم النشاط.",
            "نحتفظ بمعلومات حساب التاجر ومساحة العمل طوال مدة الحساب. لطلب حذف الحساب أرسل بريداً إلى grindctrlnow@gmail.com. نُكمل الحذف خلال 30 يوماً، مع مراعاة السجلات التي يلزم الاحتفاظ بها قانوناً.",
            "تُحفظ سجلات الفوترة ودفتر الوحدات للمدة التي يفرضها قانون المحاسبة، ولا تُعدّل بسبب حذف بيانات الخصوصية. نحتفظ بسجلات المهام أو الاشتراكات اللازمة للحفاظ على الروابط المحاسبية لهذا الغرض، مع حذف الصور الناتجة.",
            "تخضع بيانات Sentry لإعدادات الاحتفاظ المحددة في خدمة المراقبة. لم نتحقق بصورة مستقلة من مدة الاحتفاظ بها."
          ]
        },
        {
          "id": "photos",
          "title": "صور المتسوقين",
          "paragraphs": [
            "تُرسل صورة القياس الافتراضي المرفوعة إلى مزود الصور مع طلب استخدام مزودين لا يجمعون البيانات. لا نخزن الصورة المرفوعة على خوادمنا.",
            "تُخزن الصورة الناتجة فقط بصورة مؤقتة. يمكن الوصول إليها برابط موقع قصير الصلاحية مرتبط بجلستك، وليس بعنوان عام، وتستمر الجلسة لمدة أقصاها 10 دقائق.",
            "لم نؤكد ما إذا كان مزود الصور يحتفظ بصورتك. طلب استخدام مزودين لا يجمعون البيانات لا يُعد ضماناً لعدم احتفاظ المزود بها."
          ]
        },
        {
          "id": "cookies",
          "title": "ملفات تعريف الارتباط والموافقة",
          "items": [
            "تضع Clerk ملفات مصادقة أساسية لإبقاء التجار مسجلين. هذه الملفات ضرورية للوحة التحكم ولا تُستخدم للتتبع.",
            "التحليلات معطلة افتراضياً. لا تبدأ أحداث التحليلات أو ملفاتها إلا بعد موافقة صريحة على الموقع التسويقي. يمكنك تغيير اختيارك من أداة التحليلات في التذييل.",
            "تعمل مراقبة الأخطاء بصورة مستقلة عن موافقة التحليلات لاكتشاف المشكلات وإصلاحها. وهي مهيأة لتجنب المحتوى الشخصي وإزالة رموز المصادقة من الروابط."
          ]
        },
        {
          "id": "shopify-requests",
          "title": "طلبات خصوصية Shopify",
          "paragraphs": [
            "نتحقق من توقيعات إشعارات خصوصية Shopify الإلزامية ونسجل كل طلب في تخزين دائم. تُكمل Grind CTRL كل طلب خصوصية من Shopify خلال 30 يوماً من استلامه.",
            "يُخطر مسؤول الخصوصية بالبريد الإلكتروني عند الاستلام، ويُذكّر إذا بلغ الطلب 21 يوماً دون اكتمال. إذا تعذر إرسال البريد يظل الطلب معلقاً للمتابعة.",
            "يكون الحذف تلقائياً فقط عندما تكون بيانات المتجر تابعة لتثبيت مؤهل واحد ولا يوجد تثبيت نشط لتطبيق آخر على المتجر. تُعالج الملكية المشتركة أو غير المؤكدة يدوياً لحماية بيانات التطبيق الآخر."
          ],
          "items": [
            "طلب بيانات العميل: نجمع سجلات الزوار والمحادثات والرسائل المطابقة لذلك العميل والمتجر. يُرسل التصدير بالبريد إلى مسؤول الخصوصية لتمريره إلى التاجر الذي يرد على المتسوق. يظل الطلب في انتظار التسليم حتى يسجل المسؤول إتمامه.",
            "حذف بيانات العميل: نحذف سجلات الزوار والمحادثات والرسائل والمرفقات المرفوعة المطابقة للعميل داخل ذلك المتجر.",
            "حذف بيانات المتجر بعد إلغاء التثبيت: نحذف البيانات التشغيلية للمتجر، بما فيها مهام القياس والاشتراكات المؤهلة والإعدادات ورمز Shopify المخزن ومواقع الدردشة والزوار والمحادثات والرسائل والمرفقات والصور الناتجة المخزنة. نحتفظ بسجلات الفوترة ودفتر الوحدات وسجلات المهام أو الاشتراكات اللازمة للحفاظ على الروابط المحاسبية كما هو موضح أعلاه."
          ]
        },
        {
          "id": "rights",
          "title": "حقوقك وحذف الحساب",
          "paragraphs": [
            "قد يحق لك بموجب القانون المعمول به الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها أو تصديرها أو الاعتراض على بعض معالجتها أو تقييدها. راسل grindctrlnow@gmail.com لممارسة هذه الحقوق أو طلب حذف الحساب. تُعالج طلبات حذف الحساب بالبريد وتُستكمل خلال 30 يوماً، مع مراعاة الاحتفاظ المطلوب قانوناً.",
            "إذا كنت متسوقاً، فقد نحيل طلبك إلى التاجر اتساقاً مع دورنا كمعالج بيانات، ما لم نكن ملزمين بالتعامل معه مباشرة.",
            "لم نُكمل تقييماً لأنظمة الخصوصية المعمول بها في كل ولاية قضائية. لا تحد هذه السياسة من حقوقك بموجب القانون المعمول به."
          ]
        },
        {
          "id": "security",
          "title": "الأمان",
          "paragraphs": [
            "تصف صفحة الأمان عزل بيانات المتاجر وتشفير رموز Shopify وتحديد المعدل والتحقق من الإصدارات.",
            "لا نملك شهادة أو تدقيقاً أمنياً مستقلاً، ولا اتفاقية معالجة بيانات موجهة للعملاء. لا ندعي توفر أي منها."
          ]
        },
        {
          "id": "transfers",
          "title": "نقل البيانات دولياً",
          "paragraphs": [
            "قد يعالج مقدمو الخدمة البيانات خارج مصر. لم نُكمل تحديد مواقع المعالجة والتخزين لكل مزود أو التحقق من ضمانات النقل المعمول بها، بما فيها البنود التعاقدية القياسية للاتحاد الأوروبي. لا ندعي التحقق من آلية محددة لنقل البيانات دولياً."
          ]
        },
        {
          "id": "children",
          "title": "خصوصية الأطفال",
          "paragraphs": [
            "GrindCTRL مخصصة للشركات وعملائها البالغين، وليست للأطفال. لا نجمع عن علم بيانات شخصية من الأطفال. لا يتضمن المنتج حالياً خطوة للتحقق من العمر."
          ]
        },
        {
          "id": "changes",
          "title": "تغييرات هذه السياسة",
          "paragraphs": [
            "قد نحدث هذه السياسة مع تغير المنتج، وسنحدث التاريخ أدناه. سنبلغ التجار أيضاً بالتغييرات الجوهرية التي تؤثر على بيانات المتسوقين المعالجة نيابة عنهم."
          ]
        },
        {
          "id": "contact",
          "title": "تواصل معنا",
          "paragraphs": [
            "Grind CTRL، مصر. مسؤول تنفيذ طلبات الخصوصية: Grind CTRL.",
            "راسل grindctrlnow@gmail.com بشأن الخصوصية أو طلب الوصول إلى البيانات أو حذف الحساب."
          ]
        }
      ]
    }
  },
  "terms": {
    "en": {
      "eyebrow": "Legal",
      "title": "Terms of service",
      "lead": "Terms for merchants using Grind CTRL virtual try-on, Store Chat, and the dashboard.",
      "sectionLabel": "Section",
      "relatedLabel": "Privacy policy",
      "securityLabel": "Security",
      "updatedLabel": "Last updated",
      "sections": [
        {
          "id": "agreement",
          "title": "Agreement",
          "paragraphs": [
            "These Terms of Service (\"Terms\") are an agreement between Grind CTRL, operating from Egypt (\"GrindCTRL\", \"we\", \"us\"), and the merchant business using the service (\"you\"). By creating an account, installing our Shopify app, or using the dashboard, you agree to these Terms.",
            "If you act on behalf of a business, you confirm that you have authority to bind it."
          ]
        },
        {
          "id": "service",
          "title": "The service",
          "paragraphs": [
            "GrindCTRL provides AI virtual try-on, an AI-assisted Store Chat widget, and a merchant dashboard for connected stores, conversations, knowledge, and plans.",
            "Try-on previews use your plan’s monthly credits or purchased top-up packs. Store Chat uses knowledge you provide and can look up a shopper’s own orders after identity verification.",
            "We offer Free, Launch, and Done-for-you plans with different monthly credits and image quality. The Free plan requires no card and provides a starting point for one store.",
            "Paid plans and top-up packs are activated manually. There is no self-service card checkout. Payment methods, activation timing, and applicable commercial terms are confirmed with you before purchase. Done-for-you implementation scope is confirmed before activation."
          ]
        },
        {
          "id": "accounts",
          "title": "Accounts and access",
          "paragraphs": [
            "You sign in through Clerk. You are responsible for protecting your credentials and activity under your account.",
            "Store teams use owner, admin, and member roles. Owners manage all store capabilities. Admins cannot manage billing or disconnect the store. Members answer chats and keep answers up to date. Access is checked on the server.",
            "The service is intended for businesses and their adult customers. The product does not currently include an age-verification step."
          ]
        },
        {
          "id": "acceptable-use",
          "title": "Acceptable use",
          "paragraphs": [
            "We may suspend access for violations of these rules."
          ],
          "items": [
            "Do not use the service unlawfully or infringe another party’s rights.",
            "Do not bypass rate limits, security controls, or access restrictions.",
            "Do not upload content you lack rights to use, or content that is abusive, deceptive, or harmful.",
            "Do not collect shopper data beyond what you disclose to your shoppers.",
            "Do not reverse-engineer, resell, or white-label the service without our written agreement."
          ]
        },
        {
          "id": "responsibilities",
          "title": "Merchant responsibilities",
          "items": [
            "You are responsible for product images, descriptions, knowledge-base content, and your rights to use them.",
            "You must tell shoppers what try-on and Store Chat do and meet disclosure and consent requirements applicable to your business and shoppers.",
            "You must have a lawful basis to collect and share shopper photos, messages, contact details, and order-lookup data.",
            "You control shopper data processed through your store. Grind CTRL acts as your processor or service provider for that data and as controller for merchant account data, as explained in the Privacy policy."
          ]
        },
        {
          "id": "ai-content",
          "title": "AI-generated content",
          "paragraphs": [
            "Try-on previews and Store Chat replies are generated by AI and are illustrative. A preview does not guarantee fit, color, fabric, or how a garment looks in person. A chat reply may be incomplete or incorrect.",
            "Do not present generated previews or answers as a guarantee to your shoppers."
          ]
        },
        {
          "id": "billing",
          "title": "Credits and billing",
          "paragraphs": [
            "Payment and commercial terms are confirmed before purchase. These Terms do not establish a fixed contract duration or universal top-up validity period.",
            "For refund requests, contact grindctrlnow@gmail.com. Refunds beyond the automatic failed-generation credit refund are handled under applicable law and any separate written agreement. These Terms do not promise an additional general refund entitlement or limit mandatory legal rights."
          ],
          "items": [
            "Plan credits reset at the end of each billing period.",
            "Top-up credits can be used across billing periods on an active plan. Validity is set per pack and confirmed at purchase.",
            "Failed generations automatically refund the reserved credit. Credits are charged for successfully delivered images. We may still incur provider costs on failures; this does not change your credit balance.",
            "When credits run out, the try-on widget stops appearing to shoppers. Adding credits or upgrading restores it.",
            "Upgrades take effect immediately. Downgrades take effect at the start of the next billing period."
          ]
        },
        {
          "id": "availability",
          "title": "Availability",
          "paragraphs": [
            "We do not offer a service level agreement or uptime guarantee and do not have a public status page.",
            "We take reasonable steps to keep the service available and verify deployments, but do not make a contractual uptime commitment."
          ]
        },
        {
          "id": "termination",
          "title": "Suspension, termination, and account deletion",
          "paragraphs": [
            "We may suspend or terminate access for unacceptable use, when required by law, or when an account poses a security risk to the service or other merchants. You may stop using the service at any time.",
            "Request account deletion by emailing grindctrlnow@gmail.com. We complete deletion within 30 days, subject to legally required retention. Termination and refund requests remain subject to applicable law and any separate written agreement.",
            "Store Chat conversations, messages, and attachments are deleted 12 months after the conversation’s last activity. Visitor records are deleted once no conversation requiring retention remains; records with no conversation are deleted after 12 months of inactivity. Try-on retention is described in the Privacy policy.",
            "Billing and credit ledger records are retained for as long as accounting law requires and are never altered by privacy deletion. Job and subscription records needed to preserve accounting links are retained for that purpose, while generated images are removed."
          ]
        },
        {
          "id": "disconnecting",
          "title": "Disconnecting a store",
          "paragraphs": [
            "A store owner can disconnect the store from the dashboard. Disconnecting removes dashboard access; it does not delete store data or uninstall the Shopify app.",
            "Store Chat continues in Shopify admin, and conversations, knowledge, replies, and settings stay with the store subject to the Privacy policy’s retention rules. An authorized person with Shopify admin access can reconnect through the claim process.",
            "Shopify privacy requests are handled separately and completed within 30 days of receipt. Where multiple apps share store data, deletion is reviewed manually to protect the other app’s data."
          ]
        },
        {
          "id": "intellectual-property",
          "title": "Intellectual property",
          "paragraphs": [
            "We own the GrindCTRL product, including its software, design, and trademarks. You retain ownership of your store content and data and grant us permission to process that content solely to provide the service."
          ]
        },
        {
          "id": "disclaimers",
          "title": "Disclaimers",
          "paragraphs": [
            "The service is provided \"as is\" and \"as available\". To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
            "Nothing in these Terms overrides protections that cannot be disclaimed under applicable law."
          ]
        },
        {
          "id": "liability",
          "title": "Liability",
          "paragraphs": [
            "These Terms do not set a contractual monetary cap on liability. Liability is subject to applicable law, including rights and remedies that cannot be excluded."
          ]
        },
        {
          "id": "law",
          "title": "Governing law",
          "paragraphs": [
            "These Terms are governed by the laws of Egypt, subject to any mandatory protections that apply under applicable law."
          ]
        },
        {
          "id": "changes",
          "title": "Changes to these Terms",
          "paragraphs": [
            "We may update these Terms as the product changes. We will update the date below and make reasonable efforts to notify merchants of material changes."
          ]
        },
        {
          "id": "contact",
          "title": "Contact",
          "paragraphs": [
            "Grind CTRL, Egypt.",
            "Email grindctrlnow@gmail.com for service questions, refund requests, or account deletion."
          ]
        }
      ]
    },
    "ar": {
      "eyebrow": "المعلومات القانونية",
      "title": "شروط الخدمة",
      "lead": "شروط استخدام التجار لخدمات القياس الافتراضي وStore Chat ولوحة تحكم Grind CTRL.",
      "sectionLabel": "القسم",
      "relatedLabel": "سياسة الخصوصية",
      "securityLabel": "الأمان",
      "updatedLabel": "آخر تحديث",
      "sections": [
        {
          "id": "agreement",
          "title": "الاتفاق",
          "paragraphs": [
            "تشكل شروط الخدمة هذه اتفاقاً بين Grind CTRL التي تعمل من مصر، ويشار إليها باسم GrindCTRL أو «نحن»، وبين نشاط التاجر الذي يستخدم الخدمة، ويشار إليه باسم «أنت». بإنشاء حساب أو تثبيت تطبيق Shopify أو استخدام لوحة التحكم، فإنك توافق على هذه الشروط.",
            "إذا كنت تتصرف نيابة عن شركة، فأنت تؤكد امتلاكك صلاحية إلزامها بهذا الاتفاق."
          ]
        },
        {
          "id": "service",
          "title": "الخدمة",
          "paragraphs": [
            "تقدم GrindCTRL قياساً افتراضياً بالذكاء الاصطناعي وأداة Store Chat للمحادثة بمساعدة الذكاء الاصطناعي ولوحة تحكم لإدارة المتاجر المرتبطة والمحادثات والمعرفة والخطط.",
            "تستخدم معاينات القياس الوحدات الشهرية لخطتك أو باقات الشحن المشتراة. تستخدم Store Chat المعرفة التي تقدمها ويمكنها البحث عن طلبات المتسوق نفسه بعد التحقق من هويته.",
            "نقدم خطط Free وLaunch وDone-for-you بأعداد مختلفة من الوحدات الشهرية وجودة الصور. لا تتطلب الخطة المجانية بطاقة وتوفر نقطة بداية لمتجر واحد.",
            "تُفعّل الخطط المدفوعة وباقات الشحن يدوياً. لا يتوفر دفع ذاتي بالبطاقة. نؤكد معك طرق الدفع وموعد التفعيل والشروط التجارية المعمول بها قبل الشراء. ويُؤكد نطاق تنفيذ Done-for-you قبل التفعيل."
          ]
        },
        {
          "id": "accounts",
          "title": "الحسابات والصلاحيات",
          "paragraphs": [
            "تسجل الدخول عبر Clerk. أنت مسؤول عن حماية بيانات الدخول والنشاط الذي يجري عبر حسابك.",
            "تستخدم فرق المتجر أدوار المالك والمشرف والعضو. يدير المالك جميع إمكانات المتجر. لا يستطيع المشرف إدارة الفوترة أو فصل المتجر. يجيب الأعضاء عن المحادثات ويحدثون الإجابات. تُفحص الصلاحيات على الخادم.",
            "الخدمة مخصصة للشركات وعملائها البالغين. لا يتضمن المنتج حالياً خطوة للتحقق من العمر."
          ]
        },
        {
          "id": "acceptable-use",
          "title": "الاستخدام المقبول",
          "paragraphs": [
            "يجوز لنا تعليق الوصول عند مخالفة هذه القواعد."
          ],
          "items": [
            "لا تستخدم الخدمة بصورة غير قانونية أو تنتهك حقوق الآخرين.",
            "لا تتجاوز حدود المعدل أو ضوابط الأمان أو قيود الوصول.",
            "لا ترفع محتوى لا تملك حق استخدامه أو محتوى مسيئاً أو مضللاً أو ضاراً.",
            "لا تجمع بيانات متسوقين تتجاوز ما تفصح عنه لهم.",
            "لا تُجرِ هندسة عكسية للخدمة أو تعيد بيعها أو تقدمها بعلامة أخرى دون موافقتنا المكتوبة."
          ]
        },
        {
          "id": "responsibilities",
          "title": "مسؤوليات التاجر",
          "items": [
            "أنت مسؤول عن صور المنتجات وأوصافها ومحتوى قاعدة المعرفة وحقوق استخدامها.",
            "عليك إبلاغ المتسوقين بما يفعله القياس الافتراضي وStore Chat واستيفاء متطلبات الإفصاح والموافقة التي تنطبق على نشاطك ومتسوقيك.",
            "يجب أن يكون لديك أساس قانوني لجمع صور المتسوقين ورسائلهم وبيانات اتصالهم وبيانات البحث عن الطلبات ومشاركتها.",
            "أنت المتحكم في بيانات المتسوقين المعالجة عبر متجرك. تعمل Grind CTRL كمعالج بيانات أو مقدم خدمة لك بشأن تلك البيانات، وكالمتحكم في بيانات حساب التاجر، وفق سياسة الخصوصية."
          ]
        },
        {
          "id": "ai-content",
          "title": "المحتوى الناتج بالذكاء الاصطناعي",
          "paragraphs": [
            "تنتج نماذج الذكاء الاصطناعي معاينات القياس وردود Store Chat لأغراض توضيحية. لا تضمن المعاينة المقاس أو اللون أو القماش أو شكل الملابس في الواقع. وقد يكون رد المحادثة ناقصاً أو غير صحيح.",
            "لا تقدم المعاينات أو الإجابات الناتجة كضمان للمتسوقين."
          ]
        },
        {
          "id": "billing",
          "title": "الوحدات والفوترة",
          "paragraphs": [
            "تُؤكد شروط الدفع والشروط التجارية قبل الشراء. لا تحدد هذه الشروط مدة عقد ثابتة أو فترة صلاحية موحدة لجميع باقات الشحن.",
            "لطلب استرداد مبلغ راسل grindctrlnow@gmail.com. تُعالج الاستردادات التي تتجاوز إعادة الوحدات التلقائية عند فشل التوليد وفق القانون المعمول به وأي اتفاق مكتوب منفصل. لا تنشئ هذه الشروط حقاً عاماً إضافياً في الاسترداد ولا تحد من الحقوق القانونية الإلزامية."
          ],
          "items": [
            "تُجدد وحدات الخطة في نهاية كل فترة فوترة.",
            "يمكن استخدام وحدات الشحن عبر فترات الفوترة مع خطة نشطة. تُحدد صلاحيتها لكل باقة وتُؤكد عند الشراء.",
            "تُعاد الوحدة المحجوزة تلقائياً عند فشل التوليد. تُخصم الوحدات مقابل الصور التي تُسلّم بنجاح. قد نتحمل تكلفة المزود رغم الفشل، ولا يؤثر ذلك في رصيدك.",
            "عند نفاد الوحدات تتوقف أداة القياس عن الظهور للمتسوقين. تعيد إضافة الوحدات أو ترقية الخطة ظهورها.",
            "تسري الترقيات فوراً، ويسري تخفيض الخطة مع بداية فترة الفوترة التالية."
          ]
        },
        {
          "id": "availability",
          "title": "التوفر",
          "paragraphs": [
            "لا نقدم اتفاقية مستوى خدمة أو ضماناً لمدة التشغيل، ولا توجد صفحة عامة لحالة الخدمة.",
            "نتخذ خطوات معقولة للحفاظ على التوفر والتحقق من الإصدارات، لكننا لا نقدم التزاماً تعاقدياً بمدة التشغيل."
          ]
        },
        {
          "id": "termination",
          "title": "التعليق والإنهاء وحذف الحساب",
          "paragraphs": [
            "يجوز لنا تعليق الوصول أو إنهاؤه بسبب استخدام غير مقبول، أو عندما يقتضي القانون ذلك، أو إذا شكل الحساب خطراً أمنياً على الخدمة أو التجار الآخرين. يمكنك التوقف عن استخدام الخدمة في أي وقت.",
            "لطلب حذف الحساب راسل grindctrlnow@gmail.com. نُكمل الحذف خلال 30 يوماً، مع مراعاة الاحتفاظ المطلوب قانوناً. تظل طلبات الإنهاء والاسترداد خاضعة للقانون المعمول به وأي اتفاق مكتوب منفصل.",
            "تُحذف محادثات Store Chat ورسائلها ومرفقاتها بعد 12 شهراً من آخر نشاط في المحادثة. تُحذف سجلات الزوار عند عدم بقاء محادثة تستلزم الاحتفاظ بها؛ وتُحذف السجلات التي لا توجد لها محادثة بعد 12 شهراً من عدم النشاط. توضح سياسة الخصوصية مدد الاحتفاظ ببيانات القياس الافتراضي.",
            "تُحفظ سجلات الفوترة ودفتر الوحدات للمدة التي يفرضها قانون المحاسبة، ولا تُعدّل بسبب حذف بيانات الخصوصية. نحتفظ بسجلات المهام والاشتراكات اللازمة للحفاظ على الروابط المحاسبية لهذا الغرض، مع حذف الصور الناتجة."
          ]
        },
        {
          "id": "disconnecting",
          "title": "فصل متجر",
          "paragraphs": [
            "يمكن لمالك المتجر فصله من لوحة التحكم. يزيل الفصل الوصول من لوحة التحكم، لكنه لا يحذف بيانات المتجر ولا يلغي تثبيت تطبيق Shopify.",
            "تستمر Store Chat داخل لوحة Shopify، وتبقى المحادثات والمعرفة والردود والإعدادات مع المتجر وفق مدد الاحتفاظ في سياسة الخصوصية. يمكن لشخص مخول لديه وصول إلى لوحة Shopify إعادة الربط عبر إجراءات إثبات الملكية.",
            "تُعالج طلبات خصوصية Shopify بشكل منفصل وتُستكمل خلال 30 يوماً من استلامها. عندما تشترك تطبيقات متعددة في بيانات المتجر، يُراجع الحذف يدوياً لحماية بيانات التطبيق الآخر."
          ]
        },
        {
          "id": "intellectual-property",
          "title": "الملكية الفكرية",
          "paragraphs": [
            "نملك منتج GrindCTRL بما فيه البرمجيات والتصميم والعلامات التجارية. تحتفظ بملكية محتوى متجرك وبياناته، وتسمح لنا بمعالجة المحتوى فقط لتقديم الخدمة لك."
          ]
        },
        {
          "id": "disclaimers",
          "title": "إخلاء الضمانات",
          "paragraphs": [
            "تُقدم الخدمة «كما هي» و«حسب التوفر». بالقدر الذي يسمح به القانون، نخلي مسؤوليتنا عن الضمانات الضمنية لقابلية التسويق والملاءمة لغرض معين وعدم التعدي.",
            "لا تتجاوز هذه الشروط أي حماية لا يجوز استبعادها بموجب القانون المعمول به."
          ]
        },
        {
          "id": "liability",
          "title": "المسؤولية",
          "paragraphs": [
            "لا تحدد هذه الشروط سقفاً مالياً تعاقدياً للمسؤولية. تخضع المسؤولية للقانون المعمول به، بما فيه الحقوق ووسائل الانتصاف التي لا يجوز استبعادها."
          ]
        },
        {
          "id": "law",
          "title": "القانون الحاكم",
          "paragraphs": [
            "تخضع هذه الشروط لقوانين مصر، مع مراعاة أي حماية إلزامية مقررة بموجب القانون المعمول به."
          ]
        },
        {
          "id": "changes",
          "title": "تغييرات هذه الشروط",
          "paragraphs": [
            "قد نحدث هذه الشروط مع تغير المنتج. سنحدث التاريخ أدناه ونبذل جهوداً معقولة لإبلاغ التجار بالتغييرات الجوهرية."
          ]
        },
        {
          "id": "contact",
          "title": "التواصل",
          "paragraphs": [
            "Grind CTRL، مصر.",
            "راسل grindctrlnow@gmail.com للاستفسارات عن الخدمة أو طلب استرداد مبلغ أو حذف الحساب."
          ]
        }
      ]
    }
  }
};
