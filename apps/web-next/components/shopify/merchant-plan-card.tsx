'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/* What the merchant sees about their own plan. Payment is arranged with
   GrindCTRL directly, so every prompt here opens a conversation rather than
   a checkout. No prices are quoted: the owner sets those per client. */

export type MerchantPlan = {
  planName: string | null;
  status: 'active' | 'grace' | 'expired' | 'cancelled' | 'none';
  rendersIncluded: number;
  planCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsRemaining: number;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  daysRemaining: number;
  bannerState:
    | 'none'
    | 'renewal_due'
    | 'urgent'
    | 'grace'
    | 'expired'
    | 'cancelled'
    | 'exhausted'
    | 'critical'
    | 'low';
};

const OWNER_WHATSAPP = '201090000000';

function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/* One sentence per state, written for a store owner, not an engineer. */
function notice(plan: MerchantPlan): { tone: 'urgent' | 'warn' | 'calm'; text: string } | null {
  switch (plan.bannerState) {
    case 'expired':
      return {
        tone: 'urgent',
        text: 'Try-on is paused on your storefront. Renew to switch it back on.',
      };
    case 'cancelled':
      return { tone: 'urgent', text: 'This plan was cancelled, so try-on is paused.' };
    case 'grace':
      return {
        tone: 'urgent',
        text: `Your plan ended. Try-on keeps working for ${days(plan.daysRemaining)} while you renew.`,
      };
    case 'exhausted':
      return {
        tone: 'urgent',
        text: 'You have used every render this period. Add a top-up to keep going.',
      };
    case 'critical':
      return {
        tone: 'warn',
        text: `Only ${plan.totalCreditsRemaining} renders left this period.`,
      };
    case 'low':
      return {
        tone: 'warn',
        text: `${plan.totalCreditsRemaining} renders left. Worth topping up before a busy week.`,
      };
    case 'urgent':
      return { tone: 'warn', text: `Your plan renews in ${days(plan.daysRemaining)}.` };
    case 'renewal_due':
      return { tone: 'calm', text: `Your plan renews in ${days(plan.daysRemaining)}.` };
    default:
      return null;
  }
}

export function MerchantPlanCard({ plan, shop }: { plan: MerchantPlan; shop: string }) {
  const message = encodeURIComponent(
    `Hi GrindCTRL, this is ${shop}. I would like to top up my try-on credits.`,
  );
  const state = notice(plan);
  const usedPct =
    plan.rendersIncluded > 0
      ? Math.min(
          100,
          Math.round(
            ((plan.rendersIncluded - plan.planCreditsRemaining) / plan.rendersIncluded) * 100,
          ),
        )
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          <span>{plan.planName ?? 'No plan yet'}</span>
          {plan.currentPeriodEnd && plan.status !== 'expired' && (
            <span className="text-sm font-normal text-muted-foreground">
              through {new Date(plan.currentPeriodEnd).toLocaleDateString()}
            </span>
          )}
        </CardTitle>
        <CardDescription>Your try-on renders for this period.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-lg font-semibold tabular-nums">
              {plan.totalCreditsRemaining}
              <span className="ms-1 text-sm font-normal text-muted-foreground">
                renders left
              </span>
            </span>
            {plan.topUpCreditsRemaining > 0 && (
              <span className="text-xs text-muted-foreground">
                includes {plan.topUpCreditsRemaining} from top-ups
              </span>
            )}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${usedPct}% of this period's renders used`}
          >
            <div
              className={`h-full rounded-full ${
                plan.totalCreditsRemaining === 0 ? 'bg-destructive' : 'bg-foreground/70'
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.planCreditsRemaining} of {plan.rendersIncluded} included renders remaining
          </p>
        </div>

        {state && (
          <p
            className={`text-sm ${
              state.tone === 'urgent'
                ? 'text-destructive'
                : state.tone === 'warn'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            }`}
          >
            {state.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant={state?.tone === 'urgent' ? 'default' : 'outline'}>
            <a
              href={`https://wa.me/${OWNER_WHATSAPP}?text=${message}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask for more renders
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={`mailto:mahmoud@digitivia.com?subject=${encodeURIComponent(`Try-on credits for ${shop}`)}`}>
              Email instead
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
