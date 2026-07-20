'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  activatePlan,
  applyTopUp,
  renewPlan,
  scheduleDowngrade,
} from '@/app/dashboard/try-on/plan-actions';
import type {
  CreditPackCatalogItem,
  PlanCatalogItem,
  ShopEntitlement,
} from '@/lib/try-on/entitlement';

/* Owner-side plan control. Payment happens outside the product (bank
   transfer, Instapay), so every action here records what the owner already
   collected: the note carries the payment reference into the ledger. */

function money(minor: number, currency: string): string {
  return `${currency === 'USD' ? '$' : ''}${(minor / 100).toFixed(2)}`;
}

function statusTone(status: ShopEntitlement['status']) {
  if (status === 'active') return 'secondary' as const;
  if (status === 'grace') return 'outline' as const;
  return 'destructive' as const;
}

/* Plain sentences, because the owner reads this while deciding who to invoice. */
function bannerLine(state: ShopEntitlement): string | null {
  switch (state.bannerState) {
    case 'expired':
      return 'Expired. Generation is stopped until this shop is renewed.';
    case 'cancelled':
      return 'Cancelled. Generation is stopped.';
    case 'grace':
      return `In grace for ${state.daysRemaining} more day${state.daysRemaining === 1 ? '' : 's'}. Collect payment before it stops.`;
    case 'urgent':
      return `Renews in ${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'}. Invoice now.`;
    case 'renewal_due':
      return `Renews in ${state.daysRemaining} days.`;
    case 'exhausted':
      return 'Out of credits. A top-up or renewal is needed.';
    case 'critical':
      return `Almost out: ${state.totalCreditsRemaining} renders left.`;
    case 'low':
      return `Running low: ${state.totalCreditsRemaining} renders left.`;
    default:
      return null;
  }
}

export function ShopPlanControl({
  shop,
  state,
  plans,
  packs,
}: {
  shop: string;
  state: ShopEntitlement;
  plans: PlanCatalogItem[];
  packs: CreditPackCatalogItem[];
}) {
  const [planKey, setPlanKey] = useState(state.planKey ?? plans[0]?.planKey ?? '');
  const [packKey, setPackKey] = useState(packs[0]?.packKey ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const run = useCallback(
    async (label: string, fn: () => Promise<{ replayed: boolean }>) => {
      setBusy(label);
      setFeedback(null);
      try {
        const result = await fn();
        setFeedback({
          tone: 'ok',
          text: result.replayed
            ? 'Already applied. Nothing changed.'
            : `${label} applied. The merchant sees it immediately.`,
        });
        setNote('');
      } catch (error) {
        setFeedback({
          tone: 'error',
          text: error instanceof Error ? error.message : 'The action failed.',
        });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  if (shop === 'default') {
    return (
      <p className="text-sm text-muted-foreground">
        Plans belong to a shop. Pick a merchant shop above to see and change what it is
        entitled to.
      </p>
    );
  }

  const usedPct =
    state.rendersIncluded > 0
      ? Math.min(
          100,
          Math.round(
            ((state.rendersIncluded - state.planCreditsRemaining) / state.rendersIncluded) * 100,
          ),
        )
      : 0;
  const banner = bannerLine(state);
  const currentPlan = plans.find((p) => p.planKey === state.planKey);
  const targetPlan = plans.find((p) => p.planKey === planKey);
  const isDowngrade =
    !!currentPlan && !!targetPlan && targetPlan.rendersIncluded < currentPlan.rendersIncluded;
  const canRenew = state.status === 'grace' || state.status === 'expired';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{state.planName ?? 'No plan'}</span>
          <Badge variant={statusTone(state.status)}>{state.status}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {state.currentPeriodEnd
            ? `Period ends ${new Date(state.currentPeriodEnd).toLocaleDateString()}`
            : 'Not activated'}
        </span>
        {state.pendingPlanKey && (
          <span className="text-sm text-muted-foreground">
            Downgrades to {state.pendingPlanKey} next period
          </span>
        )}
      </div>

      {banner && (
        <p
          className={`text-sm ${
            state.bannerState === 'expired' ||
            state.bannerState === 'cancelled' ||
            state.bannerState === 'exhausted'
              ? 'text-destructive'
              : 'text-muted-foreground'
          }`}
        >
          {banner}
        </p>
      )}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            {state.planCreditsRemaining} of {state.rendersIncluded} plan renders left
          </span>
          {state.topUpCreditsRemaining > 0 && (
            <span className="text-muted-foreground">
              plus {state.topUpCreditsRemaining} from top-ups
            </span>
          )}
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${usedPct}% of plan renders used`}
        >
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="plan_note">Payment reference</Label>
        <Input
          id="plan_note"
          value={note}
          maxLength={200}
          placeholder="Instapay 14 Jul, 15 USD"
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Stored with the ledger entry so any future question about this shop has an answer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="plan_select">Plan</Label>
          <select
            id="plan_select"
            value={planKey}
            onChange={(e) => setPlanKey(e.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          >
            {plans.map((plan) => (
              <option key={plan.planKey} value={plan.planKey}>
                {plan.name}, {money(plan.priceMinor, plan.currency)} for {plan.rendersIncluded}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm" className="h-10 sm:h-8"
              disabled={busy !== null || !planKey || isDowngrade}
              onClick={() =>
                run('Activation', () =>
                  activatePlan({ shop, planKey, note, actionKey: crypto.randomUUID() }),
                )
              }
            >
              {state.status === 'none' ? 'Activate' : 'Activate or upgrade'}
            </Button>
            <Button
              type="button"
              size="sm" className="h-10 sm:h-8"
              variant="outline"
              disabled={busy !== null || !canRenew}
              title={canRenew ? undefined : 'Renewal opens at the period boundary'}
              onClick={() =>
                run('Renewal', () => renewPlan({ shop, note, actionKey: crypto.randomUUID() }))
              }
            >
              Renew
            </Button>
            {isDowngrade && (
              <Button
                type="button"
                size="sm" className="h-10 sm:h-8"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run('Downgrade', () =>
                    scheduleDowngrade({ shop, planKey, actionKey: crypto.randomUUID() }),
                  )
                }
              >
                Schedule downgrade
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pack_select">Top-up pack</Label>
          <select
            id="pack_select"
            value={packKey}
            onChange={(e) => setPackKey(e.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          >
            {packs.map((pack) => (
              <option key={pack.packKey} value={pack.packKey}>
                {pack.name}, {money(pack.priceMinor, pack.currency)} for {pack.renders}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 w-fit sm:h-8"
            disabled={busy !== null || !packKey || !state.available}
            title={state.available ? undefined : 'Top-ups need an active or grace subscription'}
            onClick={() =>
              run('Top-up', () =>
                applyTopUp({ shop, packKey, note, actionKey: crypto.randomUUID() }),
              )
            }
          >
            Add top-up
          </Button>
        </div>
      </div>

      {busy && <p className="text-sm text-muted-foreground">{busy} in progress…</p>}
      {feedback && (
        <p className={`text-sm ${feedback.tone === 'ok' ? 'text-muted-foreground' : 'text-destructive'}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
