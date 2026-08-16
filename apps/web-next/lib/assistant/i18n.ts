/* Assistant chat — lightweight i18n (en / ar). Shares the site-wide locale
   cookie/type (lib/landing/landing-i18n.ts) rather than a parallel one —
   this feature lives inside the same site, not a separate app, so it
   should follow whichever language the visitor already picked. */
import { getDir, type SiteLocale } from '@/lib/landing/landing-i18n';

export type AssistantLocale = SiteLocale;
export { getDir };

interface AssistantDict {
  modeText: string;
  modeVoice: string;
  switchToText: string;
  switchToVoice: string;

  composerPlaceholder: string;
  send: string;

  micIdle: string;
  micListening: string;
  micProcessing: string;
  micSpeaking: string;
  micError: string;
  micPermissionDenied: string;
  pushToTalkToggle: string;

  emptyState: string;
  thinking: string;

  budgetChatLabel: (remaining: number) => string;
  budgetVoiceLabel: (remaining: number) => string;
  limitReachedTitle: string;
  limitReachedBody: (resetSeconds: number) => string;
  limitReachedCountdown: (mmss: string) => string;
  signInCta: string;

  providerErrorTitle: string;
  providerErrorBody: string;
  retry: string;

  badInputNoAudio: string;
  badInputTooShort: string;
  badInputUnsupportedFormat: string;

  launcherOpen: string;
  launcherClose: string;
}

const en: AssistantDict = {
  modeText: 'Text',
  modeVoice: 'Voice',
  switchToText: 'Switch to text',
  switchToVoice: 'Switch to voice',

  composerPlaceholder: 'Type a message…',
  send: 'Send',

  micIdle: 'Tap to speak',
  micListening: 'Listening…',
  micProcessing: 'Transcribing…',
  micSpeaking: 'Speaking…',
  micError: 'Something went wrong',
  micPermissionDenied: 'Microphone access was denied. Allow it in your browser settings to use voice.',
  pushToTalkToggle: 'Push-to-talk',

  emptyState: 'Ask me anything, by typing or speaking.',
  thinking: 'Thinking…',

  budgetChatLabel: (n) => `${n} message${n === 1 ? '' : 's'} left`,
  budgetVoiceLabel: (n) => `${n} voice turn${n === 1 ? '' : 's'} left`,
  limitReachedTitle: "You've reached your limit for now",
  limitReachedBody: () => 'You can continue in',
  limitReachedCountdown: (mmss) => mmss,
  signInCta: 'Sign in for more',

  providerErrorTitle: 'Having trouble reaching the AI',
  providerErrorBody: 'This usually clears up quickly.',
  retry: 'Try again',

  badInputNoAudio: "We didn't catch that — try speaking again.",
  badInputTooShort: 'That was too short to hear. Try again.',
  badInputUnsupportedFormat: "Your browser's recording format isn't supported here.",

  launcherOpen: 'Open assistant',
  launcherClose: 'Close assistant',
};

const ar: AssistantDict = {
  modeText: 'نص',
  modeVoice: 'صوت',
  switchToText: 'التبديل إلى النص',
  switchToVoice: 'التبديل إلى الصوت',

  composerPlaceholder: 'اكتب رسالة…',
  send: 'إرسال',

  micIdle: 'اضغط للتحدث',
  micListening: 'جارٍ الاستماع…',
  micProcessing: 'جارٍ تحويل الصوت إلى نص…',
  micSpeaking: 'يتحدث الآن…',
  micError: 'حدث خطأ ما',
  micPermissionDenied: 'تم رفض إذن الميكروفون. فعّله من إعدادات المتصفح لاستخدام الصوت.',
  pushToTalkToggle: 'اضغط للتحدث',

  emptyState: 'اسألني أي شيء، بالكتابة أو بالصوت.',
  thinking: 'جارٍ التفكير…',

  budgetChatLabel: (n) => `تبقّت ${n} رسالة`,
  budgetVoiceLabel: (n) => `تبقّت ${n} محادثة صوتية`,
  limitReachedTitle: 'لقد وصلت إلى الحد المسموح به الآن',
  limitReachedBody: () => 'يمكنك المتابعة خلال',
  limitReachedCountdown: (mmss) => mmss,
  signInCta: 'سجّل الدخول للمزيد',

  providerErrorTitle: 'تعذّر الوصول إلى الذكاء الاصطناعي',
  providerErrorBody: 'عادةً ما تُحل هذه المشكلة سريعًا.',
  retry: 'إعادة المحاولة',

  badInputNoAudio: 'لم نلتقط ذلك — حاول التحدث مرة أخرى.',
  badInputTooShort: 'كان ذلك قصيرًا جدًا. حاول مرة أخرى.',
  badInputUnsupportedFormat: 'صيغة التسجيل في متصفحك غير مدعومة هنا.',

  launcherOpen: 'فتح المساعد',
  launcherClose: 'إغلاق المساعد',
};

export const ASSISTANT_DICTIONARIES: Record<AssistantLocale, AssistantDict> = { en, ar };
export type AssistantTranslator = AssistantDict;

export function getAssistantDictionary(locale: AssistantLocale): AssistantTranslator {
  return ASSISTANT_DICTIONARIES[locale];
}

export function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
