import type { MessengerLocale } from '@/lib/messenger/types';

/* Shopper-facing strings for the Support Messenger. Arabic is a first-class
   member of this dictionary, not a translation pass. */

export interface PanelCopy {
  typing: string;
  sendAria: string;
  close: string;
  messagePlaceholderFallback: string;
  poweredBy: string;
  /** The v16 disclosure under the composer (Chat-Home), in place of poweredBy. */
  disclosure: string;
  aiNotice: string;
  aiSenderLabel: string;
  humanSenderLabel: string;
  teamReplied: string;
  resolved: string;
  rateQuestion: string;
  feedbackThanks: string;
  sendFailed: string;
  retry: string;
  unavailableTitle: string;
  unavailableBody: string;
  offlineNote: string;
  /* Contact capture */
  contactTitle: string;
  contactLabel: string;
  contactPlaceholder: string;
  contactSend: string;
  contactSkip: string;
  contactThanks: string;
  contactInvalid: string;
  /* Attachments */
  attachAria: string;
  attachUploading: string;
  attachTooLarge: string;
  attachBadType: string;
  attachFailed: string;
  attachImageAlt: string;
  /* Handoff, after hours and the assistant down (v16 phase zero items 6-8) */
  alertedTitle: string;
  alertedBody: string;
  savedTitle: string;
  savedBody: string;
  awayTitle: (time: string | null, zone: string | null) => string;
  awayBody: string;
  stillHelp: string;
  assistantNow: string;
  teamHereUntil: (time: string) => string;
  teamAwayUntil: (time: string) => string;
  teamAway: string;
  savedMark: string;
  assistantDownTitle: string;
  assistantDownBody: string;
  sendToTeam: string;
  offlineBar: string;
  waitingToSend: string;
  /* The v16 home (Chat-Home) */
  youreViewing: string;
  tryItOn: string;
  storeAssistantAi: string;
  /** label, then the first message it sends */
  quickActions: Array<{ id: 'order' | 'sizes' | 'delivery' | 'person'; label: string; message: string }>;
  messageLabel: string;
  speak: string;
  stopSpeaking: string;
  helpful: string;
  notHelpful: string;
  /* The v16 answer view (Chat-Answer, Chat-Arabic) */
  languageLabel: string;
  backToHome: string;
  askFollowUp: string;
  /* The order lookup and card (Chat-More, Chat-Order) */
  orderNumberLabel: string;
  orderContactLabel: string;
  orderPrivacy: string;
  findOrder: string;
  findingOrder: string;
  orderNumberInvalid: string;
  orderStage: Record<'preparing' | 'on_its_way' | 'out_for_delivery' | 'delivered' | 'cancelled', string>;
  orderPlaced: string;
  orderShipped: (carrier: string | null) => string;
  orderOutForDelivery: string;
  orderDelivered: string;
  orderArrives: (date: string) => string;
  orderCashDue: string;
  orderTotal: string;
  orderTrack: (carrier: string | null) => string;
  orderAiLabel: string;
  askAboutOrder: string;
}

const EN: PanelCopy = {
  typing: 'Typing…',
  sendAria: 'Send message',
  close: 'Close chat',
  messagePlaceholderFallback: 'Ask anything…',
  poweredBy: 'Powered by GRINDCTRL',
  disclosure: "Answers come from the store's AI assistant. A person from the team takes over when you ask, or when it can't help.",
  aiNotice: 'Assistant may reply automatically',
  aiSenderLabel: 'Assistant',
  humanSenderLabel: 'Team',
  teamReplied: 'Our team joined the conversation',
  resolved: 'Conversation resolved',
  rateQuestion: 'Was this helpful?',
  feedbackThanks: 'Thanks for your feedback!',
  sendFailed: 'Message not sent.',
  retry: 'Retry',
  unavailableTitle: 'Support is resting',
  unavailableBody: 'Please check back a little later.',
  offlineNote: 'We are away right now. Leave a message and the team will reply.',
  contactTitle: 'Where should we reply?',
  contactLabel: 'Your email address',
  contactPlaceholder: 'you@example.com',
  contactSend: 'Send',
  contactSkip: 'Not now',
  contactThanks: 'Thanks, we will reply to you there.',
  contactInvalid: 'Please enter a valid email address.',
  attachAria: 'Attach a photo',
  attachUploading: 'Uploading photo…',
  attachTooLarge: 'That image is too large (5 MB max).',
  attachBadType: 'Only JPEG, PNG, or WebP images can be attached.',
  attachFailed: 'The photo could not be sent.',
  attachImageAlt: 'Photo you sent',
  alertedTitle: 'The team has your message',
  alertedBody: 'You will see the reply here.',
  savedTitle: 'Your message is saved for the team',
  savedBody: 'They will reply here.',
  awayTitle: (time, zone) =>
    time ? `The team is away until ${time}${zone ? ` ${zone}` : ''}` : 'The team is away right now',
  awayBody: 'Tell us where to reply and they will answer when they are back.',
  stillHelp: 'While you wait, I can still help with anything else.',
  assistantNow: 'Assistant answers now',
  teamHereUntil: (time) => `team here until ${time}`,
  teamAwayUntil: (time) => `team away until ${time}`,
  teamAway: 'team away',
  savedMark: 'Saved',
  assistantDownTitle: 'The assistant can’t answer right now',
  assistantDownBody: 'Your message is saved. Send it to the team and they reply here.',
  sendToTeam: 'Send it to the team',
  offlineBar: 'You’re offline. We’ll send it when you’re back.',
  waitingToSend: 'Waiting to send',
  youreViewing: "You're viewing",
  tryItOn: 'Try it on',
  storeAssistantAi: 'Store assistant, AI',
  quickActions: [
    { id: 'order', label: 'Track my order', message: 'Where is my order?' },
    { id: 'sizes', label: 'Sizes and fit', message: 'Can you help me with sizes and fit?' },
    { id: 'delivery', label: 'Delivery and exchange', message: 'How do delivery and exchanges work?' },
    { id: 'person', label: 'Talk to a person', message: 'I want to talk to a person.' },
  ],
  messageLabel: 'Message',
  speak: 'Speak your message',
  stopSpeaking: 'Stop listening',
  helpful: 'Helpful',
  notHelpful: 'Not helpful',
  languageLabel: 'Language',
  backToHome: 'Back to chat home',
  askFollowUp: 'Ask a follow-up',
  orderNumberLabel: 'Order number',
  orderContactLabel: 'Email you ordered with',
  orderPrivacy: 'We only show an order to the email that placed it.',
  findOrder: 'Find my order',
  findingOrder: 'Looking for your order',
  orderNumberInvalid: 'Enter the number from your order confirmation, like 1027.',
  orderStage: { preparing: 'Preparing', on_its_way: 'On its way', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' },
  orderPlaced: 'Placed',
  orderShipped: (carrier) => (carrier ? `Shipped with ${carrier}` : 'Shipped'),
  orderOutForDelivery: 'Out for delivery',
  orderDelivered: 'Delivered',
  orderArrives: (date) => `Arrives ${date}`,
  orderCashDue: 'Cash due on delivery',
  orderTotal: 'Total',
  orderTrack: (carrier) => (carrier ? `Track with ${carrier}` : 'Track the delivery'),
  orderAiLabel: 'Store assistant, AI · it can read your order but not change it',
  askAboutOrder: 'Ask about this order',
};

const AR: PanelCopy = {
  typing: 'يكتب…',
  sendAria: 'إرسال الرسالة',
  close: 'إغلاق المحادثة',
  messagePlaceholderFallback: 'اكتب سؤالك…',
  poweredBy: 'مدعوم من GRINDCTRL',
  // The board's draft is feminine; this speaks to everyone until N26 lets a store choose.
  disclosure: 'الإجابات من مساعد المتجر بالذكاء الاصطناعي. يتولى شخص من الفريق المحادثة عند الطلب، أو عندما لا يستطيع المساعد المساعدة.',
  aiNotice: 'قد يرد المساعد تلقائياً',
  aiSenderLabel: 'المساعد',
  humanSenderLabel: 'الفريق',
  teamReplied: 'انضم فريقنا إلى المحادثة',
  resolved: 'تم حل المحادثة',
  rateQuestion: 'هل كانت هذه المساعدة مفيدة؟',
  feedbackThanks: 'شكراً لملاحظاتك!',
  sendFailed: 'لم تُرسل الرسالة.',
  retry: 'إعادة المحاولة',
  unavailableTitle: 'الدعم غير متاح حالياً',
  unavailableBody: 'يرجى المحاولة مرة أخرى بعد قليل.',
  offlineNote: 'نحن خارج أوقات العمل الآن. اترك رسالة وسيرد عليك الفريق.',
  contactTitle: 'أين نرد عليك؟',
  contactLabel: 'بريدك الإلكتروني',
  contactPlaceholder: 'you@example.com',
  contactSend: 'إرسال',
  contactSkip: 'ليس الآن',
  contactThanks: 'شكراً، سنرد عليك هناك.',
  contactInvalid: 'يرجى إدخال بريد إلكتروني صحيح.',
  attachAria: 'إرفاق صورة',
  attachUploading: 'جارٍ رفع الصورة…',
  attachTooLarge: 'حجم الصورة كبير جداً (5 ميجابايت كحد أقصى).',
  attachBadType: 'يمكن إرفاق صور JPEG أو PNG أو WebP فقط.',
  attachFailed: 'تعذّر إرسال الصورة.',
  attachImageAlt: 'الصورة التي أرسلتها',
  alertedTitle: 'وصلت رسالتك إلى الفريق',
  alertedBody: 'سيظهر الرد هنا.',
  savedTitle: 'رسالتك محفوظة لدى الفريق',
  savedBody: 'سيظهر ردهم هنا.',
  awayTitle: (time, zone) => (time ? `الفريق غير متاح حتى ${time}${zone ? ` ${zone}` : ''}` : 'الفريق غير متاح الآن'),
  awayBody: 'يمكنك إخبارنا أين نرد عليك، وسيرد الفريق عند عودته.',
  stillHelp: 'لحين ردهم، يمكنني مساعدتك في أي شيء آخر.',
  assistantNow: 'المساعد يرد الآن',
  teamHereUntil: (time) => `الفريق متاح حتى ${time}`,
  teamAwayUntil: (time) => `الفريق غير متاح حتى ${time}`,
  teamAway: 'الفريق غير متاح',
  savedMark: 'تم الحفظ',
  assistantDownTitle: 'المساعد لا يستطيع الرد الآن',
  assistantDownBody: 'رسالتك محفوظة. يمكنك إرسالها إلى الفريق وسيردون هنا.',
  sendToTeam: 'إرسالها إلى الفريق',
  offlineBar: 'لا يوجد اتصال بالإنترنت. سنرسلها عند عودة الاتصال.',
  waitingToSend: 'في انتظار الإرسال',
  // The v16 home speaks to everyone until N26 lets a store choose a form (the
  // board's drafts are feminine); the quick messages are the shopper's own words.
  youreViewing: 'المعروض الآن',
  tryItOn: 'تجربة القطعة',
  storeAssistantAi: 'مساعد المتجر، ذكاء اصطناعي',
  quickActions: [
    { id: 'order', label: 'تتبع الطلب', message: 'أين طلبي؟' },
    { id: 'sizes', label: 'المقاسات والقصّة', message: 'أحتاج مساعدة في المقاسات والقصّة.' },
    { id: 'delivery', label: 'التوصيل والاستبدال', message: 'كيف يتم التوصيل والاستبدال؟' },
    { id: 'person', label: 'التحدث مع شخص من الفريق', message: 'أريد التحدث مع خدمة العملاء.' },
  ],
  messageLabel: 'رسالتك',
  speak: 'تسجيل الرسالة بالصوت',
  stopSpeaking: 'إيقاف الاستماع',
  helpful: 'مفيدة',
  notHelpful: 'غير مفيدة',
  languageLabel: 'اللغة',
  backToHome: 'العودة إلى الصفحة الرئيسية للدردشة',
  askFollowUp: 'سؤال إضافي',
  // The order lookup speaks to everyone (the board's drafts are feminine).
  orderNumberLabel: 'رقم الطلب',
  orderContactLabel: 'البريد الإلكتروني المستخدم في الطلب',
  orderPrivacy: 'لا نعرض الطلب إلا للبريد الإلكتروني الذي تم الطلب به.',
  findOrder: 'البحث عن الطلب',
  findingOrder: 'جارٍ البحث عن الطلب',
  orderNumberInvalid: 'يرجى إدخال الرقم الموجود في تأكيد الطلب، مثل 1027.',
  orderStage: { preparing: 'قيد التجهيز', on_its_way: 'في الطريق', out_for_delivery: 'خرج للتوصيل', delivered: 'تم التوصيل', cancelled: 'ملغى' },
  orderPlaced: 'تم الطلب',
  orderShipped: (carrier) => (carrier ? `شُحن مع ${carrier}` : 'تم الشحن'),
  orderOutForDelivery: 'خرج للتوصيل',
  orderDelivered: 'تم التوصيل',
  orderArrives: (date) => `يصل ${date}`,
  orderCashDue: 'الدفع نقداً عند الاستلام',
  orderTotal: 'الإجمالي',
  orderTrack: (carrier) => (carrier ? `التتبع مع ${carrier}` : 'تتبع الشحنة'),
  orderAiLabel: 'مساعد المتجر، ذكاء اصطناعي · يمكنه قراءة طلبك دون تغييره',
  askAboutOrder: 'سؤال عن هذا الطلب',
};

export function getPanelCopy(locale: MessengerLocale): PanelCopy {
  return locale === 'ar' ? AR : EN;
}
