'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PanelCopy } from '../i18n';
import type { MessengerLocale } from '@/lib/messenger/types';

/* The composer's microphone (Chat-Home): the browser's own speech input,
   written into the message box for the shopper to check and send. Hidden
   where the browser has none. */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscription = () => () => {};

export function SpeechButton({
  t,
  locale,
  disabled,
  onText,
}: {
  t: PanelCopy;
  locale: MessengerLocale;
  disabled: boolean;
  onText: (text: string) => void;
}) {
  const supported = useSyncExternalStore(noSubscription, () => recognitionClass() !== null, () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => () => recognition.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = recognitionClass();
    if (!Speech) return;
    const next = new Speech();
    next.lang = locale === 'ar' ? 'ar-EG' : 'en-US';
    next.interimResults = false;
    next.continuous = false;
    next.onresult = (event) => {
      const heard = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (heard) onText(heard);
    };
    next.onend = () => setListening(false);
    next.onerror = () => setListening(false);
    recognition.current = next;
    try {
      next.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? t.stopSpeaking : t.speak}
      aria-pressed={listening}
      className={`flex size-[42px] shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 ${listening ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
