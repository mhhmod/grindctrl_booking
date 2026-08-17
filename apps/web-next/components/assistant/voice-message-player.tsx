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
  const { status, elapsedSeconds, totalSeconds, toggle, seek } = useVoiceMessagePlayer(chunks);
  const isPlaying = status === 'playing';
  const displaySeconds = status === 'playing' || status === 'paused' ? elapsedSeconds : totalSeconds;
  // Guards both the /0 in the fraction below and disables the scrubber until
  // durations are known — chunk metadata loads within a frame or two of
  // mount, so this window is brief, not a persistent broken-looking state.
  const canSeek = totalSeconds > 0;
  const progressFraction = canSeek ? Math.min(1, elapsedSeconds / totalSeconds) : 0;

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
      {/* -my-2.5/py-2.5 grows the drag/tap hit area for the range input well
          past the bars' own ~14px visual height, without pushing surrounding
          layout — the bars stay purely decorative (aria-hidden) while the
          input carries the real interaction and a11y semantics. */}
      <div className="relative -my-2.5 flex-1 py-2.5">
        <div className="flex items-end gap-0.5" aria-hidden="true">
          {BAR_HEIGHTS.map((height, index) => {
            const played = index / BAR_HEIGHTS.length < progressFraction;
            return (
              <span
                key={index}
                className={cn(
                  'w-[2.5px] rounded-full bg-current transition-opacity',
                  played ? 'opacity-90' : 'opacity-30',
                  isPlaying && 'animate-pulse',
                )}
                style={{ height, animationDelay: `${index * 90}ms` }}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={0}
          max={totalSeconds || 0}
          step={0.01}
          value={Math.min(elapsedSeconds, totalSeconds)}
          disabled={!canSeek}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t.seekVoiceMessage}
          className={cn(
            'absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default',
            '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent',
            '[&::-webkit-slider-thumb]:size-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-background',
            '[&::-moz-range-thumb]:size-2 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-background',
          )}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {formatMmSs(Math.round(displaySeconds))}
      </span>
    </div>
  );
}

/** Shown in place of VoiceMessagePlayer while a voice reply's TTS call is
 *  still in flight — without it, the gap between the text reply landing
 *  and audio actually arriving read as "this reply has no voice," not
 *  "voice is on its way." Same bouncing-dot language as the chat's own
 *  "thinking" indicator, so it reads as one consistent "still working"
 *  vocabulary rather than a second, different loading style. */
export function VoiceReplyLoading() {
  const { t } = useAssistantLocale();
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-foreground/10 pt-2" role="status">
      <div className="flex items-center gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
      <span className="text-xs text-muted-foreground">{t.voiceReplyLoading}</span>
    </div>
  );
}
