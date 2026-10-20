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
};

export function getPanelCopy(locale: MessengerLocale): PanelCopy {
  return locale === 'ar' ? AR : EN;
}
