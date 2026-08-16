'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BudgetInfo, RateLimitedInfo } from '@/lib/assistant/client';
import { formatMmSs } from '@/lib/assistant/i18n';
import { useAssistantLocale } from './locale-provider';

interface RateLimitBannerProps {
  budgets: { chat: BudgetInfo; voice: BudgetInfo } | null;
  rateLimited: RateLimitedInfo | null;
  redirectPath: string;
}

const LOW_BUDGET_THRESHOLD = 2;

function useCountdown(seconds: number | null): number {
  const [remaining, setRemaining] = useState(seconds ?? 0);

  useEffect(() => {
    setRemaining(seconds ?? 0);
    if (!seconds) return;

    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1_000);
    return () => clearInterval(interval);
  }, [seconds]);

  return remaining;
}

/** Calm ambient indicator while budget is healthy; a distinct, non-alarming
 *  banner with a live countdown and (for anon visitors) a sign-in CTA once
 *  the limit is actually hit — the limit should never come as a surprise. */
export function RateLimitBanner({ budgets, rateLimited, redirectPath }: RateLimitBannerProps) {
  const { t } = useAssistantLocale();
  const countdown = useCountdown(rateLimited?.resetSeconds ?? null);

  if (rateLimited) {
    return (
      <div
        className="flex flex-col gap-2.5 border-t bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{t.limitReachedTitle}</p>
            <p className="text-xs text-muted-foreground">
              {t.limitReachedBody(countdown)}{' '}
              <span className="font-mono tabular-nums text-foreground">{formatMmSs(countdown)}</span>
            </p>
          </div>
        </div>
        {rateLimited.signInCta && (
          <Button asChild size="sm" className="h-9 w-full shrink-0 rounded-xl sm:w-auto">
            <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`}>{t.signInCta}</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!budgets) return null;

  const lowChat = budgets.chat.remaining <= LOW_BUDGET_THRESHOLD;
  const lowVoice = budgets.voice.remaining <= LOW_BUDGET_THRESHOLD;
  if (!lowChat && !lowVoice) return null;

  return (
    <div className="border-t px-4 py-2 text-xs text-muted-foreground">
      {lowChat && <span>{t.budgetChatLabel(budgets.chat.remaining)}</span>}
      {lowChat && lowVoice && <span> · </span>}
      {lowVoice && <span>{t.budgetVoiceLabel(budgets.voice.remaining)}</span>}
    </div>
  );
}
