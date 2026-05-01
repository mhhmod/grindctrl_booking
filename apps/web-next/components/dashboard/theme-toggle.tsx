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

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'h-9 rounded-full border border-border bg-card/80 px-2.5 text-xs font-semibold shadow-sm shadow-black/5 backdrop-blur transition-all hover:bg-muted dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
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
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </Button>
  );
}
