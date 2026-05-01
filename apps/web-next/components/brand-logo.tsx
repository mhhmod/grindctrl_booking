import React from 'react';
import { cn } from '@/lib/utils';

const logoMaskStyles = {
  light: {
    WebkitMask: "url('/brand/logo-dark.svg') center / contain no-repeat",
    mask: "url('/brand/logo-dark.svg') center / contain no-repeat",
  },
  dark: {
    WebkitMask: "url('/brand/logo.svg') center / contain no-repeat",
    mask: "url('/brand/logo.svg') center / contain no-repeat",
  },
} satisfies Record<string, React.CSSProperties>;

const markSizes = {
  sm: 'h-7 w-10',
  md: 'h-8 w-12',
  lg: 'h-9 w-14',
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  size = 'md',
  showText = true,
  subtitle,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  size?: keyof typeof markSizes;
  showText?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5 text-foreground', className)}>
      <span className="relative inline-grid shrink-0 place-items-center" aria-hidden="true">
        <span
          className={cn('bg-current dark:hidden', markSizes[size], markClassName)}
          style={logoMaskStyles.light}
        />
        <span
          className={cn('hidden bg-current dark:block', markSizes[size], markClassName)}
          style={logoMaskStyles.dark}
        />
      </span>
      {showText ? (
        <span className="min-w-0">
          <span className={cn('block truncate text-sm font-bold uppercase tracking-widest', textClassName)}>
            GRINDCTRL
          </span>
          {subtitle ? (
            <span className="block truncate text-xs font-medium text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
