'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTryOnLocale } from './locale-provider';

export function LocaleToggle({ className }: { className?: string }) {
  const { t, toggleLocale } = useTryOnLocale();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t.langToggleLabel}
      className={cn(
        'h-9 rounded-full border border-border bg-card/80 px-2.5 text-xs font-semibold shadow-sm shadow-black/5 backdrop-blur transition-all hover:bg-muted dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
        className,
      )}
      onClick={toggleLocale}
      id="tryon-locale-toggle"
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{t.langSwitchTo}</span>
    </Button>
  );
}
