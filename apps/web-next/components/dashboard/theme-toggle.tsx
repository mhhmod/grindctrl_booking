'use client';

import React, { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function subscribeMounted() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

/* Kept in the component rather than a dictionary because this toggle is shared
   by the landing header, the footer, the dashboard and the Shopify admin, and
   those surfaces read from four different copy modules. Four strings is a
   smaller thing to duplicate than a prop threaded through every caller. */
const THEME_COPY = {
  en: { toLight: 'Switch to light mode', toDark: 'Switch to dark mode', light: 'Light', dark: 'Dark' },
  ar: { toLight: 'التبديل إلى الوضع الفاتح', toDark: 'التبديل إلى الوضع الداكن', light: 'فاتح', dark: 'داكن' },
} as const;

export function ThemeToggle({
  className,
  locale = 'en',
}: {
  className?: string;
  locale?: 'en' | 'ar';
}) {
  const copy = THEME_COPY[locale] ?? THEME_COPY.en;
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={isDark ? copy.toLight : copy.toDark}
      aria-pressed={isDark}
      className={cn(
        'gc-tap h-9 rounded-full border border-border bg-card/80 px-2.5 text-xs font-semibold shadow-sm shadow-black/5 backdrop-blur transition-all hover:bg-muted dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
        className,
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span className="relative grid size-5 place-items-center overflow-hidden rounded-full">
        <Sun
          className={cn(
            'absolute size-4 transition duration-300',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0',
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            'absolute size-4 transition duration-300',
            isDark ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )}
          aria-hidden="true"
        />
      </span>
      <span className="hidden sm:inline">{isDark ? copy.light : copy.dark}</span>
    </Button>
  );
}
