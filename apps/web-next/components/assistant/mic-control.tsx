'use client';

import React from 'react';
import { AlertCircle, Loader2, Mic, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Waveform } from './waveform';
import { useAssistantLocale } from './locale-provider';

export type MicState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface MicControlProps {
  state: MicState;
  levels: number[];
  onClick: () => void;
  errorMessage?: string;
}

/** Every state gets its own icon, color, and label — never just a color
 *  swap — so the customer never has to wonder whether it's working. */
export function MicControl({ state, levels, onClick, errorMessage }: MicControlProps) {
  const { t } = useAssistantLocale();

  const label = {
    idle: t.micIdle,
    listening: t.micListening,
    processing: t.micProcessing,
    speaking: t.micSpeaking,
    error: t.micError,
  }[state];

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={state === 'processing' || state === 'speaking'}
        aria-label={label}
        className={cn(
          'relative flex size-16 items-center justify-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none',
          state === 'idle' && 'bg-muted text-muted-foreground hover:bg-muted/80',
          state === 'listening' && 'bg-primary text-primary-foreground',
          state === 'processing' && 'bg-muted text-muted-foreground opacity-70',
          state === 'speaking' && 'bg-accent text-accent-foreground opacity-70',
          state === 'error' && 'bg-destructive/10 text-destructive',
        )}
      >
        {state === 'listening' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden="true" />
        )}
        <span className="relative">
          {state === 'processing' && <Loader2 className="size-6 animate-spin" />}
          {state === 'speaking' && <Volume2 className="size-6 animate-pulse" />}
          {state === 'error' && <AlertCircle className="size-6" />}
          {(state === 'idle' || state === 'listening') && <Mic className="size-6" />}
        </span>
      </button>

      <Waveform levels={levels} active={state === 'listening'} />

      <p className={cn('text-xs', state === 'error' ? 'text-destructive' : 'text-muted-foreground')} role="status">
        {state === 'error' && errorMessage ? errorMessage : label}
      </p>
    </div>
  );
}
