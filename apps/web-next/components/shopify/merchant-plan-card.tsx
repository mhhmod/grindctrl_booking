'use client';

import { Badge, Group, Paper, Progress, Stack, Text, Title } from '@mantine/core';
import type { ShopEntitlement } from '@/lib/try-on/entitlement';
import { shopifyPlansCopy } from './plans-copy';

/** This is the existing entitlement returned by the embedded settings API. */
export type MerchantPlan = Pick<
  ShopEntitlement,
  | 'planName'
  | 'status'
  | 'rendersIncluded'
  | 'planCreditsRemaining'
  | 'topUpCreditsRemaining'
  | 'totalCreditsRemaining'
  | 'currentPeriodEnd'
  | 'graceEndsAt'
  | 'daysRemaining'
  | 'bannerState'
>;

export function MerchantPlanCard({ plan, locale }: { plan: MerchantPlan; locale: 'en' | 'ar' }) {
  const c = shopifyPlansCopy[locale];
  const used = Math.max(0, plan.rendersIncluded - plan.planCreditsRemaining);
  const usedPct = plan.rendersIncluded > 0 ? Math.min(100, (used / plan.rendersIncluded) * 100) : 0;
  const periodEnd = plan.currentPeriodEnd ? new Date(plan.currentPeriodEnd) : null;
  const date = periodEnd && Number.isFinite(periodEnd.getTime())
    ? periodEnd.toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    : null;

  return (
    <Paper component="section" withBorder p="lg" radius="md" aria-labelledby="shopify-current-plan">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={2} size="h4" id="shopify-current-plan">{c.yourPlan}</Title>
          <Badge variant="light">{c.status[plan.status]}</Badge>
        </Group>
        <Text fw={600} size="xl">{plan.planName ?? c.noPlan}</Text>
        {date && <Text size="sm" c="dimmed">{c.periodEnds(date)}</Text>}
        <Title order={3} size="h5">{c.looksThisCycle}</Title>
        <Text fw={600} size="xl">{c.looksLeft(plan.totalCreditsRemaining)}</Text>
        <Progress value={usedPct} aria-label={c.looksUsed} />
        <Text size="sm" c="dimmed">{c.includedRemaining(plan.planCreditsRemaining, plan.rendersIncluded)}</Text>
        {plan.topUpCreditsRemaining > 0 && (
          <Text size="sm" c="dimmed">{c.addedLooks(plan.topUpCreditsRemaining)}</Text>
        )}
        {plan.status === 'expired' || plan.status === 'cancelled' ? (
          <Text size="sm" role="status">{c.paused}</Text>
        ) : plan.totalCreditsRemaining === 0 && <Text size="sm">{c.exhausted}</Text>}
      </Stack>
    </Paper>
  );
}
