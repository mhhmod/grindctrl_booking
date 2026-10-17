'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { setStoreFlag } from '@/app/dashboard/flags/actions';
import { setLaunchStateAsOperator } from '@/app/dashboard/try-on/launch-actions';

const LAUNCH_STATES = ['setup', 'preview', 'live', 'holdout'] as const;

export type StoreFlagRow = {
  flag: string;
  code: string;
  title: string;
  enabled: boolean;
};

/* The platform operator's switch for the v16 features of one store. Only
   rendered for an operator, and the action checks again. It is an internal
   tool, not a merchant screen, so it stays in English in either dashboard
   language (lang and dir are set on the card for that reason). */
export function StoreFlagsCard({
  kind,
  storeKey,
  storeLabel,
  rows,
  launchState,
}: {
  kind: 'shop' | 'site';
  storeKey: string;
  storeLabel: string;
  rows: StoreFlagRow[];
  /** A Shopify store's launch state (N5, N6), for testing it from here. */
  launchState?: string;
}) {
  const [launch, setLaunch] = useState(launchState);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.enabled).map((row) => row.flag)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(flag: string) {
    const next = !enabled.has(flag);
    setError(null);
    startTransition(async () => {
      const result = await setStoreFlag({ kind, key: storeKey, flag, enabled: next });
      if (result.ok) setEnabled(new Set(result.flags));
      else setError(result.message);
    });
  }

  function setState(state: string) {
    setError(null);
    startTransition(async () => {
      const result = await setLaunchStateAsOperator({ shop: storeKey, state });
      if (result.ok) setLaunch(result.state);
      else setError(result.message);
    });
  }

  return (
    <Card lang="en" dir="ltr" data-testid="store-flags-card">
      <CardHeader>
        <CardTitle>Store flags</CardTitle>
        <CardDescription>
          Operator only. A v16 feature reaches {storeLabel} only while its flag is on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => {
            const on = enabled.has(row.flag);
            return (
              <li key={row.flag} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {row.code}, {row.title}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{row.flag}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => toggle(row.flag)}
                >
                  {on ? 'On' : 'Off'}
                </Button>
              </li>
            );
          })}
        </ul>
        {kind === 'shop' && launch !== undefined && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Launch state">
            <span className="text-sm font-medium text-foreground">Launch state</span>
            {LAUNCH_STATES.map((state) => (
              <Button
                key={state}
                type="button"
                size="sm"
                variant={launch === state ? 'default' : 'outline'}
                aria-pressed={launch === state}
                disabled={pending}
                onClick={() => setState(state)}
              >
                {state}
              </Button>
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
