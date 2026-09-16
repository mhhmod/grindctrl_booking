import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type NotLiveStatusKind = 'notBuilt' | 'evidenceRequired' | 'planned';

export interface ConversationsCopy {
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  bookCall: string;
  ctaPricing: string;
  ctaIntegrations: string;
  pillarsEyebrow: string;
  pillarsTitle: string;
  pillarsBody: string;
  pillarStatus: string;
  pillars: Array<{ title: string; body: string }>;
  notLiveEyebrow: string;
  notLiveTitle: string;
  notLiveBody: string;
  notBuiltStatus: string;
  notLiveItems: Array<{ label: string; note: string; statusKind: NotLiveStatusKind }>;
  closingTitle: string;
  closingBody: string;
}

const en: ConversationsCopy = {
  heroEyebrow: 'AI customer conversations',
  heroTitle: 'Answers your storefront chat. Knows when to step back.',
  heroLead:
    'Store Chat replies from your own store knowledge, looks up real orders safely, and hands the conversation to your team the moment it should.',
  bookCall: 'Book a call',
  ctaPricing: 'See pricing',
  ctaIntegrations: 'See integrations',
  pillarsEyebrow: 'How it works',
  pillarsTitle: 'Built on your store, not a script',
  pillarsBody:
    'Every reply, lookup, and handoff runs through guarded server logic, not a chatbot guessing in the dark.',
  pillarStatus: 'Implemented in source',
  pillars: [
    {
      title: 'Grounded in your store, not invented',
      body: 'You set the tone. Replies come only from knowledge you add, written by hand or pulled from your own store pages. The assistant is instructed never to invent a price, stock level, or policy.',
    },
    {
      title: 'Verified order lookup, read-only',
      body: 'One real order per request, matched to a signed-in customer or an order number plus matching email. Only fulfillment, tracking, and line-item facts come back, never price, address, phone, or customer ID.',
    },
    {
      title: 'Team handoff, on request or after hours',
      body: 'A shopper can ask for a person, or the AI can flag that it should stop; either way a guarded status change hands the thread to your team. They can take over, reassign, or send it back to the AI. Internal notes stay off both the shopper’s screen and the AI’s own context, and staff can insert a saved reply template with one click instead of retyping. Every settings publish, revert, and knowledge or reply change is recorded server-side too.',
    },
    {
      title: 'Business hours the AI actually respects',
      body: 'Set hours and a timezone per day. Outside them, the AI stops answering, a real switch in the request path, not a cosmetic badge.',
    },
    {
      title: 'Bilingual, RTL, and live signals',
      body: 'Replies detect or follow a forced Arabic or English, and the widget renders right-to-left. Shoppers see typing dots while the AI composes or a teammate types, and can rate any single reply or the conversation overall.',
    },
    {
      title: 'Safe by design',
      body: 'Store content, scraped pages, and photo text are always framed as untrusted data for the model to read, never instructions to follow. It can propose an order lookup; only the server, re-verifying who is asking, can actually run it.',
    },
  ],
  notLiveEyebrow: 'Where it stops today',
  notLiveTitle: "What's not live yet",
  notLiveBody: "Store Chat runs on your storefront today. Here's what it doesn't do yet.",
  notBuiltStatus: 'Not built',
  notLiveItems: [
    {
      label: 'A separate intent-classification engine',
      note: "Handoff requests are caught by keyword matching, and photo attachments get an image classifier. There's no general-purpose intent tagger beyond that.",
      statusKind: 'notBuilt',
    },
    {
      label: 'AI drafts a reply for staff to approve',
      note: 'Staff write replies from scratch, optionally starting from a saved template, or the AI answers on its own. There is no in-between draft-and-approve step.',
      statusKind: 'notBuilt',
    },
    {
      label: 'WhatsApp and Instagram',
      note: 'No code path exists for either channel yet.',
      statusKind: 'evidenceRequired',
    },
    {
      label: 'Telegram',
      note: 'On the roadmap, not built.',
      statusKind: 'planned',
    },
  ],
  closingTitle: 'See it against your own store.',
  closingBody: "Book a call and we'll walk through Store Chat on your storefront, or compare plans first.",
};

const ar: ConversationsCopy = {
  heroEyebrow: 'محادثات العملاء بالذكاء الاصطناعي',
  heroTitle: 'يرد على محادثة متجرك، ويعرف متى يتراجع.',
  heroLead:
    'يرد Store Chat من معرفة متجرك الخاصة، ويبحث عن الطلبات الحقيقية بأمان، وينقل المحادثة إلى فريقك في اللحظة المناسبة.',
  bookCall: 'احجز مكالمة',
  ctaPricing: 'شاهد الأسعار',
  ctaIntegrations: 'شاهد التكاملات',
  pillarsEyebrow: 'كيف يعمل',
  pillarsTitle: 'مبني على متجرك، وليس نصًا جاهزًا',
  pillarsBody: 'كل رد وبحث وتحويل يمر عبر منطق خادم محكوم، وليس روبوت محادثة يخمّن في الظلام.',
  pillarStatus: 'مطبَّق في الكود',
  pillars: [
    {
      title: 'مبني على معرفة متجرك، لا يخترع شيئًا',
      body: 'أنت تحدد النبرة. الردود تأتي فقط من المعرفة التي تضيفها، سواء كتبتها يدويًا أو جلبتها من صفحات متجرك. المساعد موجَّه بألا يخترع أبدًا سعرًا أو مخزونًا أو سياسة.',
    },
    {
      title: 'بحث موثّق عن الطلبات، للقراءة فقط',
      body: 'طلب حقيقي واحد لكل استعلام، يُطابَق مع عميل مسجّل دخوله أو رقم طلب مع بريد إلكتروني مطابق. تعود فقط حقائق الشحن والتتبع وبنود الطلب، ولا يظهر أبدًا السعر أو العنوان أو الهاتف أو هوية العميل.',
    },
    {
      title: 'تحويل إلى فريقك، عند الطلب أو خارج ساعات العمل',
      body: 'يمكن للعميل أن يطلب التحدث إلى شخص، أو يمكن للذكاء الاصطناعي أن يشير إلى ضرورة التوقف؛ في الحالتين، يغيّر النظام حالة المحادثة بشكل محكوم لينقلها إلى فريقك. يمكنهم تولّي المحادثة أو إسنادها لزميل أو إعادتها إلى الذكاء الاصطناعي. تبقى الملاحظات الداخلية بعيدة عن شاشة العميل وعن سياق الذكاء الاصطناعي نفسه، ويمكن للموظفين إدراج قالب رد محفوظ بنقرة واحدة بدل إعادة الكتابة. كل نشر أو تراجع للإعدادات وكل تغيير في المعرفة أو الردود يُسجَّل من جانب الخادم أيضًا.',
    },
    {
      title: 'ساعات عمل يلتزم بها الذكاء الاصطناعي فعليًا',
      body: 'حدد الساعات والمنطقة الزمنية لكل يوم. خارج هذه الساعات، يتوقف الذكاء الاصطناعي عن الرد؛ إنه مفتاح حقيقي في مسار الطلب، وليس شارة شكلية.',
    },
    {
      title: 'ثنائي اللغة، من اليمين لليسار، وإشارات مباشرة',
      body: 'تكتشف الردود العربية أو الإنجليزية تلقائيًا أو تتبع لغة مفروضة، وتُعرض الواجهة من اليمين إلى اليسار. يرى العملاء نقاط الكتابة أثناء تأليف الذكاء الاصطناعي أو كتابة أحد الموظفين، ويمكنهم تقييم أي رد بمفرده أو المحادثة كاملة.',
    },
    {
      title: 'آمن بالتصميم',
      body: 'محتوى المتجر والصفحات المستخرجة ونصوص الصور تُعرض دائمًا للنموذج كبيانات غير موثوقة يقرؤها، لا كتعليمات ينفذها. يمكنه اقتراح البحث عن طلب؛ لكن الخادم وحده، بعد إعادة التحقق من هوية السائل، هو من ينفذه فعليًا.',
    },
  ],
  notLiveEyebrow: 'أين يتوقف اليوم',
  notLiveTitle: 'ما لم يُطلَق بعد',
  notLiveBody: 'يعمل Store Chat على واجهة متجرك اليوم. إليك ما لا يفعله بعد.',
  notBuiltStatus: 'غير مطوَّر',
  notLiveItems: [
    {
      label: 'محرك تصنيف نوايا منفصل',
      note: 'طلبات التحويل إلى شخص تُلتقط عبر مطابقة كلمات مفتاحية، ومرفقات الصور تمر بمصنّف صور. لا يوجد مصنّف نوايا عام غير ذلك.',
      statusKind: 'notBuilt',
    },
    {
      label: 'صياغة رد بالذكاء الاصطناعي بانتظار موافقة الموظف',
      note: 'يكتب الموظفون الردود من الصفر، وقد يبدؤون من قالب محفوظ، أو يرد الذكاء الاصطناعي بمفرده. لا توجد خطوة وسيطة لصياغة رد ثم الموافقة عليه.',
      statusKind: 'notBuilt',
    },
    {
      label: 'واتساب وإنستغرام',
      note: 'لا يوجد مسار برمجي لأي من القناتين بعد.',
      statusKind: 'evidenceRequired',
    },
    {
      label: 'تيليغرام',
      note: 'على خارطة الطريق، ولم يُبنَ بعد.',
      statusKind: 'planned',
    },
  ],
  closingTitle: 'شاهده مقابل متجرك الفعلي.',
  closingBody: 'احجز مكالمة وسنستعرض Store Chat على واجهة متجرك، أو قارن الخطط أولاً.',
};

export function getConversationsCopy(locale: SiteLocale): ConversationsCopy {
  return locale === 'ar' ? ar : en;
}
