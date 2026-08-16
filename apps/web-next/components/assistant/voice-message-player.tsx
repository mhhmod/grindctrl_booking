'use client';

import React from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMmSs } from '@/lib/assistant/i18n';
import { useAssistantLocale } from './locale-provider';
import { useVoiceMessagePlayer } from './use-voice-message-player';

interface VoiceMessagePlayerProps {
  chunks: string[];
}

/* Bar heights for the pulsing "equalizer" row — purely decorative, so a
   fixed pattern is enough; a real waveform would need decoding the audio
   into a canvas, which is real complexity for something decorative. */
const BAR_HEIGHTS = [6, 12, 8, 14, 5, 10, 7];

/** Renders inside an assistant message bubble once that message has audio
 *  attached (see use-assistant-chat.ts's setMessageAudio). The play icon
 *  intentionally never mirrors in RTL — like any media transport control,
 *  it represents playback direction (forward in time), not text direction. */
export function VoiceMessagePlayer({ chunks }: VoiceMessagePlayerProps) {
  const { t } = useAssistantLocale();
  const { status, elapsedSeconds, totalSeconds, toggle } = useVoiceMessagePlayer(chunks);
  const isPlaying = status === 'playing';
  const displaySeconds = status === 'playing' || status === 'paused' ? elapsedSeconds : totalSeconds;

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-foreground/10 pt-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? t.pauseVoiceMessage : t.playVoiceMessage}
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
      >
        {isPlaying ? (
          <Pause className="size-3" fill="currentColor" />
        ) : (
          <Play className="ms-0.5 size-3" fill="currentColor" style={{ transform: 'none' }} />
        )}
      </button>
      <div className="flex flex-1 items-end gap-0.5" aria-hidden="true">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            className={cn('w-[2.5px] rounded-full bg-current opacity-40', isPlaying && 'animate-pulse')}
            style={{ height, animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {formatMmSs(Math.round(displaySeconds))}
      </span>
    </div>
  );
}
