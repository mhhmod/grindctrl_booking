'use client';

import React, { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AssistantLocale } from '@/lib/assistant/i18n';
import { useAssistantLocale } from './locale-provider';

interface VoiceLanguagePickerProps {
  value: AssistantLocale;
  onChange: (locale: AssistantLocale) => void;
}

const CLOSE_DELAY_MS = 200;

/** Only meaningful — and only rendered by the caller — while voice-reply is
 *  on. Opens on hover (desktop) or a click/tap (Radix's Popover default,
 *  which also covers touch — hover events never fire on touch devices, so
 *  the click path has to work on its own, not just as a hover fallback). */
export function VoiceLanguagePicker({ value, onChange }: VoiceLanguagePickerProps) {
  const { t } = useAssistantLocale();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const select = (locale: AssistantLocale) => {
    onChange(locale);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.voiceLanguagePickerLabel}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {value.toUpperCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent onMouseEnter={cancelClose} onMouseLeave={scheduleClose} className="flex min-w-28 flex-col">
        <button
          type="button"
          onClick={() => select('en')}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted',
            value === 'en' && 'font-semibold text-foreground',
          )}
        >
          {t.voiceLanguageEnglish}
        </button>
        <button
          type="button"
          onClick={() => select('ar')}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted',
            value === 'ar' && 'font-semibold text-foreground',
          )}
        >
          {t.voiceLanguageArabic}
        </button>
      </PopoverContent>
    </Popover>
  );
}
