import * as React from 'react';
import { cn } from '@/lib/utils';

/** The small eyebrow chip above v15 section headings: an icon and a label. */
export function SiteChip({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[30px] items-center gap-2 rounded-full border border-border bg-gc-chip pe-[13px] ps-[11px] text-[12.5px] font-bold text-foreground',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** A 24px outlined badge with an icon or mark, used for kinds, tags and statuses. */
export function SiteBadge({
  icon,
  children,
  tone = 'light',
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'light' | 'ink';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xl px-[9px] text-[11.5px] font-bold',
        tone === 'ink'
          ? 'bg-foreground text-background'
          : 'border border-foreground/20 bg-card/60 text-foreground',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
