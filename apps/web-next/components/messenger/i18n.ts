import type { MessengerLocale } from '@/lib/messenger/types';

/* Shopper-facing strings for the Support Messenger. Arabic is a first-class
   member of this dictionary, not a translation pass. */

export interface PanelCopy {
  typing: string;
  sendAria: string;
  messagePlaceholderFallback: string;
  poweredBy: string;
  aiNotice: string;
  connectingTeam: string;
  teamReplied: string;
  resolved: string;
  rateQuestion: string;
  feedbackThanks: string;
  sendFailed: string;
  retry: string;
  unavailableTitle: string;
  unavailableBody: string;
  offlineNote: string;
}

const EN: PanelCopy = {
  typing: 'Typing…',
  sendAria: 'Send message',
  messagePlaceholderFallback: 'Ask anything…',
  poweredBy: 'Powered by GRINDCTRL',
  aiNotice: 'Assistant may reply automatically',
  connectingTeam: 'Connecting you with our team…',
  teamReplied: 'Our team joined the conversation',
  resolved: 'Conversation resolved',
  rateQuestion: 'Was this helpful?',
  feedbackThanks: 'Thanks for your feedback!',
  sendFailed: 'Message not sent.',
  retry: 'Retry',
  unavailableTitle: 'Support is resting',
  unavailableBody: 'Please check back a little later.',
  offlineNote: 'We are away right now — leave a message and the team will reply.',
};

const AR: PanelCopy = {
  typing: 'يكتب…',
  sendAria: 'إرسال الرسالة',
  messagePlaceholderFallback: 'اكتب سؤالك…',
  poweredBy: 'مدعوم من GRINDCTRL',
  aiNotice: 'قد يرد المساعد تلقائياً',
  connectingTeam: 'جارٍ توصيلك بفريقنا…',
  teamReplied: 'انضم فريقنا إلى المحادثة',
  resolved: 'تم حل المحادثة',
  rateQuestion: 'هل كانت هذه المساعدة مفيدة؟',
  feedbackThanks: 'شكراً لملاحظاتك!',
  sendFailed: 'لم تُرسل الرسالة.',
  retry: 'إعادة المحاولة',
  unavailableTitle: 'الدعم غير متاح حالياً',
  unavailableBody: 'يرجى المحاولة مرة أخرى بعد قليل.',
  offlineNote: 'نحن خارج أوقات العمل الآن — اترك رسالة وسيرد عليك الفريق.',
};

export function getPanelCopy(locale: MessengerLocale): PanelCopy {
  return locale === 'ar' ? AR : EN;
}
