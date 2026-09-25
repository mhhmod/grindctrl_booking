/* Marks for the things the v15 pages name: the GrindCTRL logo, the AI agent
   (a sparkle in a filled circle) and the team (two overlapping avatars).
   Third-party logos come from components/brand-marks.tsx. All of these are
   decorative: the visible name beside each one is what gets read out. */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SparkleIcon } from './icons';

const LOGO_MASK: React.CSSProperties = {
  WebkitMask: "url('/brand/logo-dark.svg') center / contain no-repeat",
  mask: "url('/brand/logo-dark.svg') center / contain no-repeat",
};

/** The GrindCTRL mark in the current text colour, so it follows the theme. */
export function GrindctrlMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-6 w-9 shrink-0 bg-current', className)}
      style={style ? { ...LOGO_MASK, ...style } : LOGO_MASK}
    />
  );
}

/** The AI agent: a sparkle in a filled circle, the same everywhere it appears. */
export function AgentMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-foreground text-background',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <SparkleIcon size={Math.round(size * 0.6)} strokeWidth={1.9} />
    </span>
  );
}

function Avatar({
  initial,
  size,
  overlap,
  tone,
}: {
  initial: string;
  size: number;
  overlap: boolean;
  tone: 'ink' | 'grey';
}) {
  return (
    <span
      aria-hidden="true"
      lang="en"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card font-extrabold',
        tone === 'ink' ? 'bg-foreground text-background' : 'bg-gc-inactive text-foreground',
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        marginInlineStart: overlap ? -Math.round(size * 0.32) : undefined,
      }}
    >
      {initial}
    </span>
  );
}

/** The team: O and N overlapping. Initials stay Latin in both languages. */
export function TeamMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex', className)}>
      <Avatar initial="O" size={size} overlap={false} tone="ink" />
      <Avatar initial="N" size={size} overlap tone="grey" />
    </span>
  );
}
