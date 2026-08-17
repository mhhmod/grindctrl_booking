import { BOOKING_URL } from '@/lib/booking';
import type { AssistantLocale } from './i18n';
import { linkifyMessage } from './linkify';

const PHRASES: Record<AssistantLocale, { booking: string; tryOn: string; pricing: string; genericLink: string }> = {
  en: {
    booking: 'the booking link',
    tryOn: 'the try-on page',
    pricing: 'the pricing page',
    genericLink: 'the link',
  },
  ar: {
    booking: 'رابط الحجز',
    tryOn: 'صفحة التجربة الافتراضية',
    pricing: 'صفحة الأسعار',
    genericLink: 'الرابط',
  },
};

function spokenPhraseFor(href: string, locale: AssistantLocale): string {
  const phrases = PHRASES[locale];
  if (href === '/try-on') return phrases.tryOn;
  if (href === '/pricing') return phrases.pricing;
  if (href.startsWith(BOOKING_URL)) return phrases.booking;
  return phrases.genericLink;
}

/** A URL read aloud by TTS comes out as a string of garbled syllables — Groq
 *  has no way to know "https://calendar.app.google/ts89YZLki5MBw9tH9" is
 *  meant to be heard as "the booking link," not spelled out. This produces
 *  a spoken-language variant of a reply: every link segment linkifyMessage
 *  would turn into a clickable link becomes a short natural phrase instead,
 *  in whichever language voice output is actually using (effectiveVoiceLocale
 *  in chat-window.tsx), while plain text passes through untouched. The
 *  on-screen text (MessageText) is never touched by this — only the copy
 *  handed to streamTts is. A link with its own human-authored label (from
 *  linkifyHtmlAnchors unwrapping a model-emitted <a> tag) already reads as
 *  natural language, so it's spoken as-is rather than replaced. */
export function toSpeechText(text: string, locale: AssistantLocale): string {
  return linkifyMessage(text)
    .map((segment) => {
      if (segment.type === 'text') return segment.value;
      if (segment.label !== segment.href) return segment.label;
      return spokenPhraseFor(segment.href, locale);
    })
    .join('');
}
