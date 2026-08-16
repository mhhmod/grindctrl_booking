'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  /** Recent amplitude samples, 0..1. Rendered as bars, most recent last. */
  levels: number[];
  active: boolean;
  className?: string;
}

const BAR_COUNT = 24;

/** Driven by real levels from the mic (or silence when inactive) — never a
 *  decorative loop, so it doubles as confirmation the mic is actually
 *  picking the customer up. */
export function Waveform({ levels, active, className }: WaveformProps) {
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const level = levels[levels.length - BAR_COUNT + i] ?? 0;
    return Math.max(0.08, Math.min(1, level));
  });

  return (
    <div
      className={cn('flex h-8 items-center justify-center gap-[3px]', className)}
      role="img"
      aria-hidden="true"
    >
      {bars.map((level, i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-full transition-[height] duration-100', active ? 'bg-primary' : 'bg-muted-foreground/30')}
          style={{ height: `${Math.round(level * 100)}%` }}
        />
      ))}
    </div>
  );
}
