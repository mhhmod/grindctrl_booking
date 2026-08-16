'use client';

import React from 'react';
import { Keyboard, Mic, MessageSquareText, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistantLocale } from './locale-provider';

interface ModeToggleProps {
  voiceInput: boolean;
  voiceOutput: boolean;
  onVoiceInputChange: (value: boolean) => void;
  onVoiceOutputChange: (value: boolean) => void;
  disabled?: boolean;
}

function SegmentButton({
  active,
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Mic;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Two independent switches — how you send (type/speak) and how you receive
 *  (read/hear) — the four brief-described modes are just their four
 *  combinations, and either can flip mid-conversation without losing
 *  context (both read from the same message history). */
export function ModeToggle({
  voiceInput,
  voiceOutput,
  onVoiceInputChange,
  onVoiceOutputChange,
  disabled,
}: ModeToggleProps) {
  const { t } = useAssistantLocale();

  return (
    <div className="flex items-center gap-3" role="group" aria-label={`${t.modeText} / ${t.modeVoice}`}>
      <div className="flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5">
        <SegmentButton
          active={!voiceInput}
          onClick={() => onVoiceInputChange(false)}
          disabled={disabled}
          icon={Keyboard}
          label={t.switchToText}
        />
        <SegmentButton
          active={voiceInput}
          onClick={() => onVoiceInputChange(true)}
          disabled={disabled}
          icon={Mic}
          label={t.switchToVoice}
        />
      </div>
      <div className="flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5">
        <SegmentButton
          active={!voiceOutput}
          onClick={() => onVoiceOutputChange(false)}
          disabled={disabled}
          icon={MessageSquareText}
          label={t.modeText}
        />
        <SegmentButton
          active={voiceOutput}
          onClick={() => onVoiceOutputChange(true)}
          disabled={disabled}
          icon={Volume2}
          label={t.modeVoice}
        />
      </div>
    </div>
  );
}
