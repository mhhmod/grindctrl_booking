'use client';

import * as React from 'react';
import posthog from 'posthog-js';
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
import {
  getDateLocale,
  getTryOnDashboardCopy,
  planStatusLabel,
  type TryOnDashboardCopy,
} from '@/lib/try-on/dashboard-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Owner-side plan control. Payment happens outside the product (bank
   transfer, Instapay), so every action here records what the owner already
   collected: the note carries the payment reference into the ledger. */

/* ponytail: not currency formatting, just a floor — the else-branch used to
   emit no marker at all, so a non-USD plan rendered as a bare "150.00" in the
   selector the owner activates from. Falling back to the ISO code costs one
   line and changes nothing that renders today, since every catalog row is
   USD. Intl.NumberFormat is the real answer, but it needs a locale, restates
   the USD output, and collides with this branch's deliberate Latin-digit
   choice — all decisions that belong to the per-country pricing work. */
function money(minor: number, currency: string): string {
  const amount = (minor / 100).toFixed(2);
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}

function statusTone(status: ShopEntitlement['status']) {
  if (status === 'active') return 'secondary' as const;
  if (status === 'grace') return 'outline' as const;
  return 'destructive' as const;
}

/* Plain sentences, because the owner reads this while deciding who to invoice. */
function bannerLine(c: TryOnDashboardCopy, state: ShopEntitlement): string | null {
  switch (state.bannerState) {
    case 'expired':
      return c.bannerExpired;
    case 'cancelled':
      return c.bannerCancelled;
    case 'grace':
      return c.bannerGrace(state.daysRemaining);
    case 'urgent':
      return c.bannerUrgent(state.daysRemaining);
    case 'renewal_due':
      return c.bannerRenewalDue(state.daysRemaining);
    case 'exhausted':
      return c.bannerExhausted;
    case 'critical':
      return c.bannerCritical(state.totalCreditsRemaining);
    case 'low':
      return c.bannerLow(state.totalCreditsRemaining);
    default:
      return null;
  }
}

export function ShopPlanControl({
  shop,
  state,
  plans,
  packs,
  locale = 'en',
}: {
  shop: string;
  state: ShopEntitlement;
  plans: PlanCatalogItem[];
  packs: CreditPackCatalogItem[];
  /* The dashboard operator's language, from the shared gc-locale cookie. */
  locale?: SiteLocale;
}) {
  const c = getTryOnDashboardCopy(locale);
  const [planKey, setPlanKey] = useState(state.planKey ?? plans[0]?.planKey ?? '');
  const [packKey, setPackKey] = useState(packs[0]?.packKey ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  /* `action` arrives already translated, so it reads correctly inside both the
     progress line and the success line, whichever shape the locale uses. */
  const run = useCallback(
    async (action: string, fn: () => Promise<{ replayed: boolean }>) => {
      setBusy(action);
      setFeedback(null);
      try {
        const result = await fn();
        setFeedback({
          tone: 'ok',
          text: result.replayed ? c.actionReplayed : c.actionApplied(action),
        });
        posthog.capture('shop_plan_action_completed', {
          action,
          replayed: result.replayed,
          plan_status: state.status,
        });
        setNote('');
      } catch (error) {
        /* ponytail: server errors surface in English. They come from Postgres
           and lib/try-on/entitlement.ts, so translating them belongs with
           those messages, not here. */
        setFeedback({
          tone: 'error',
          text: error instanceof Error ? error.message : c.actionFailed,
        });
      } finally {
        setBusy(null);
      }
    },
    [c, state.status],
  );

  if (shop === 'default') {
    return <p className="text-sm text-muted-foreground">{c.plansBelongToShop}</p>;
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
  const banner = bannerLine(c, state);
  const currentPlan = plans.find((p) => p.planKey === state.planKey);
  const targetPlan = plans.find((p) => p.planKey === planKey);
  const isDowngrade =
    !!currentPlan && !!targetPlan && targetPlan.rendersIncluded < currentPlan.rendersIncluded;
  const canRenew = state.status === 'grace' || state.status === 'expired';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{state.planName ?? c.noPlan}</span>
          <Badge variant={statusTone(state.status)}>{planStatusLabel(c, state.status)}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {state.currentPeriodEnd
            ? c.periodEnds(new Date(state.currentPeriodEnd).toLocaleDateString(getDateLocale(locale)))
            : c.notActivated}
        </span>
        {state.pendingPlanKey && (
          <span className="text-sm text-muted-foreground">
            {/* The catalog name, not the slug: the badge above already shows
                planName, and a raw plan_key reads as debug output in either
                language. Falls back to the slug so an unlisted plan still
                names itself. */}
            {c.downgradesTo(
              plans.find((p) => p.planKey === state.pendingPlanKey)?.name ?? state.pendingPlanKey,
            )}
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
          <span>{c.planRendersLeft(state.planCreditsRemaining, state.rendersIncluded)}</span>
          {state.topUpCreditsRemaining > 0 && (
            <span className="text-muted-foreground">
              {c.plusFromTopUps(state.topUpCreditsRemaining)}
            </span>
          )}
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={c.rendersUsedAria(usedPct)}
        >
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="plan_note">{c.paymentReference}</Label>
        <Input
          id="plan_note"
          value={note}
          maxLength={200}
          placeholder={c.paymentReferencePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{c.paymentReferenceHelp}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="plan_select">{c.planLabel}</Label>
          <select
            id="plan_select"
            value={planKey}
            onChange={(e) => setPlanKey(e.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          >
            {plans.map((plan) => (
              <option key={plan.planKey} value={plan.planKey}>
                {c.catalogOption(
                  plan.name,
                  money(plan.priceMinor, plan.currency),
                  plan.rendersIncluded,
                )}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm" className="h-10 sm:h-8"
              disabled={busy !== null || !planKey || isDowngrade}
              onClick={() =>
                run(c.actionActivation, () =>
                  activatePlan({ shop, planKey, note, actionKey: crypto.randomUUID() }),
                )
              }
            >
              {state.status === 'none' ? c.activate : c.activateOrUpgrade}
            </Button>
            <Button
              type="button"
              size="sm" className="h-10 sm:h-8"
              variant="outline"
              disabled={busy !== null || !canRenew}
              title={canRenew ? undefined : c.renewUnavailable}
              onClick={() =>
                run(c.actionRenewal, () =>
                  renewPlan({ shop, note, actionKey: crypto.randomUUID() }),
                )
              }
            >
              {c.renew}
            </Button>
            {isDowngrade && (
              <Button
                type="button"
                size="sm" className="h-10 sm:h-8"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run(c.actionDowngrade, () =>
                    scheduleDowngrade({ shop, planKey, actionKey: crypto.randomUUID() }),
                  )
                }
              >
                {c.scheduleDowngrade}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pack_select">{c.topUpPackLabel}</Label>
          <select
            id="pack_select"
            value={packKey}
            onChange={(e) => setPackKey(e.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          >
            {packs.map((pack) => (
              <option key={pack.packKey} value={pack.packKey}>
                {c.catalogOption(pack.name, money(pack.priceMinor, pack.currency), pack.renders)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 w-fit sm:h-8"
            disabled={busy !== null || !packKey || !state.available}
            title={state.available ? undefined : c.topUpUnavailable}
            onClick={() =>
              run(c.actionTopUp, () =>
                applyTopUp({ shop, packKey, note, actionKey: crypto.randomUUID() }),
              )
            }
          >
            {c.addTopUp}
          </Button>
        </div>
      </div>

      {busy && <p className="text-sm text-muted-foreground">{c.actionInProgress(busy)}</p>}
      {feedback && (
        <p className={`text-sm ${feedback.tone === 'ok' ? 'text-muted-foreground' : 'text-destructive'}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
