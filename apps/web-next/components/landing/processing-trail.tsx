'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';

const PROCESSING_STEPS = [
  { label: 'Reading input', durationMs: 600 },
  { label: 'Extracting entities', durationMs: 800 },
  { label: 'Choosing route', durationMs: 700 },
  { label: 'Preparing action', durationMs: 500 },
];

type StepState = 'pending' | 'active' | 'done';

interface ProcessingTrailProps {
  /** true while sandbox is running */
  isProcessing: boolean;
  /** true after a result is received */
  hasResult: boolean;
  /** callback when trail animation completes */
  onComplete?: () => void;
}

export function ProcessingTrail({ isProcessing, hasResult, onComplete }: ProcessingTrailProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(
    PROCESSING_STEPS.map(() => 'pending'),
  );

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (!isProcessing) {
      if (!hasResult) {
        timers.push(setTimeout(() => {
          setStepStates(PROCESSING_STEPS.map(() => 'pending'));
        }, 0));
      }
      return () => timers.forEach(clearTimeout);
    }

    // Animate through steps sequentially
    let cancelled = false;
    timers.push(setTimeout(() => {
      if (!cancelled) {
        setStepStates(PROCESSING_STEPS.map(() => 'pending'));
      }
    }, 0));

    let accumulatedDelay = 0;
    PROCESSING_STEPS.forEach((step, idx) => {
      // Activate step
      const activateTimer = setTimeout(() => {
        if (cancelled) return;
        setStepStates((prev) => {
          const next = [...prev];
          next[idx] = 'active';
          return next;
        });
      }, accumulatedDelay);
      timers.push(activateTimer);

      accumulatedDelay += step.durationMs;

      // Complete step
      const completeTimer = setTimeout(() => {
        if (cancelled) return;
        setStepStates((prev) => {
          const next = [...prev];
          next[idx] = 'done';
          return next;
        });

        // If this is the last step, call onComplete
        if (idx === PROCESSING_STEPS.length - 1) {
          onComplete?.();
        }
      }, accumulatedDelay);
      timers.push(completeTimer);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isProcessing, hasResult, onComplete]);

  // Don't render when idle with no result
  if (!isProcessing && !hasResult) return null;

  return (
    <div className="space-y-1.5" role="status" aria-label="Processing status">
      {PROCESSING_STEPS.map((step, idx) => {
        const state = stepStates[idx];
        return (
          <div
            key={step.label}
            className={`gc-step-appear flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-300 ${
              state === 'active'
                ? 'bg-primary/8 text-foreground'
                : state === 'done'
                  ? 'bg-emerald-500/5 text-emerald-400'
                  : 'text-muted-foreground/50'
            }`}
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              {state === 'active' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : state === 'done' ? (
                <Check className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-30" />
              )}
            </span>
            <span className="font-medium">{step.label}</span>
          </div>
        );
      })}

      {hasResult && (
        <div className="gc-step-appear flex items-center gap-2.5 rounded-lg bg-amber-500/5 px-3 py-2 text-sm text-amber-400" style={{ animationDelay: '0.5s' }}>
          <Lock className="size-3.5" />
          <span className="font-medium">External actions locked — sign in to unlock</span>
        </div>
      )}
    </div>
  );
}
