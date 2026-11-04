'use client';

import { useState, useTransition } from 'react';
import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
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
  launchKey,
}: {
  kind: 'shop' | 'site';
  storeKey: string;
  storeLabel: string;
  rows: StoreFlagRow[];
  /** A store's launch state (N5, N6), for testing it from here. */
  launchState?: string;
  /** The tenant the launch state is kept under, when it is not `storeKey`: a
   *  WooCommerce store's flags are keyed by its site, its launch by `site:<id>`. */
  launchKey?: string;
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
      const result = await setLaunchStateAsOperator({ shop: launchKey ?? storeKey, state });
      if (result.ok) setLaunch(result.state);
      else setError(result.message);
    });
  }

  return (
    <Paper withBorder radius="card" p="lg" lang="en" dir="ltr" data-testid="store-flags-card">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} size="h4">Store flags</Title>
          <Text size="sm" c="dimmed">
            Operator only. A v16 feature reaches {storeLabel} only while its flag is on.
          </Text>
        </Stack>
        <Stack component="ul" gap="xs" m={0} p={0} style={{ listStyle: 'none' }}>
          {rows.map((row) => {
            const on = enabled.has(row.flag);
            return (
              <Paper component="li" key={row.flag} withBorder radius="md" p="sm">
                <Group justify="space-between" gap="sm" wrap="wrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500}>
                      {row.code}, {row.title}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">{row.flag}</Text>
                  </div>
                  <Button
                    type="button"
                    size="compact-md"
                    h={44}
                    radius="pill"
                    variant={on ? 'filled' : 'default'}
                    aria-pressed={on}
                    disabled={pending}
                    onClick={() => toggle(row.flag)}
                  >
                    {on ? 'On' : 'Off'}
                  </Button>
                </Group>
              </Paper>
            );
          })}
        </Stack>
        {(kind === 'shop' || launchKey !== undefined) && launch !== undefined && (
          <Group gap="xs" role="group" aria-label="Launch state">
            <Text size="sm" fw={500}>Launch state</Text>
            {LAUNCH_STATES.map((state) => (
              <Button
                key={state}
                type="button"
                size="compact-md"
                h={44}
                radius="pill"
                variant={launch === state ? 'filled' : 'default'}
                aria-pressed={launch === state}
                disabled={pending}
                onClick={() => setState(state)}
              >
                {state}
              </Button>
            ))}
          </Group>
        )}
        {error && (
          <Text size="sm" c="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
