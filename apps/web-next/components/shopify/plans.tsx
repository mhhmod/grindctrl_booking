'use client';

import { useEffect, useState } from 'react';
import { Button, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import type { ShopifyAppPricingPresentation } from '@/lib/shopify/app-pricing';
import { MerchantPlanCard, type MerchantPlan } from './merchant-plan-card';
import { shopifyPlansCopy } from './plans-copy';

type PlanState = { shop: string; plan: MerchantPlan };

export function ShopifyPlans({
  locale, appPricing, onRetry,
}: {
  locale: 'en' | 'ar';
  appPricing: ShopifyAppPricingPresentation | null;
  onRetry: () => void;
}) {
  const c = shopifyPlansCopy[locale];
  const [state, setState] = useState<PlanState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!appPricing) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getShopifySessionToken();
        const response = await fetch('/api/shopify/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Plan read failed');
        const data = await response.json() as Partial<PlanState>;
        if (!data.plan || !data.shop) throw new Error('Plan unavailable');
        if (!cancelled) setState({ shop: data.shop, plan: data.plan });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appPricing]);

  return (
    <Stack gap="lg" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} style={{ minWidth: 0 }}>
      <Title order={1} size="h2">{c.title}</Title>
      {!appPricing || failed ? (
        <Stack gap="sm" align="flex-start">
          <Text role="alert">{c.unavailable}</Text>
          <Button onClick={onRetry}>{c.retry}</Button>
        </Stack>
      ) : !state ? (
        <Text role="status">{c.loading}</Text>
      ) : (
        <>
          <MerchantPlanCard plan={state.plan} locale={locale} />
          {appPricing.distribution === 'public' ? (
            appPricing.pricingPlansUrl && (
              <Stack gap="sm" align="flex-start">
                <Text size="sm" c="dimmed">{c.billedByShopify}</Text>
                {/* A merchant click leaves Shopify's iframe at the top level. */}
                <Button component="a" href={appPricing.pricingPlansUrl} target="_top">{c.changePlan}</Button>
              </Stack>
            )
          ) : (
            <Text size="sm" c="dimmed">{c.manualPayment}</Text>
          )}
          {(appPricing.distribution !== 'public' || appPricing.pricingPlansUrl) && (
            <Stack gap="md" component="section" aria-labelledby="shopify-compare-plans">
              <Title order={2} size="h4" id="shopify-compare-plans">{c.comparePlans}</Title>
              <Text size="sm">{c.freeAvailable}</Text>
              {appPricing.plans.length === 0 ? <Text>{c.emptyCatalog}</Text> : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {appPricing.plans.map((plan) => (
                    <Paper key={plan.id} withBorder p="lg" radius="md" style={{ minWidth: 0 }}>
                      <Stack gap="sm" h="100%">
                        <Title order={3} size="h4">{plan.name}</Title>
                        <Text fw={600}>
                          {/* One USD format in both locales; bdi stops RTL reordering it to "$US". */}
                          <bdi>{new Intl.NumberFormat('en-US', {
                            style: 'currency', currency: plan.currency, maximumFractionDigits: 2,
                          }).format(plan.priceMinor / 100)}</bdi>
                          {' '}<Text span size="sm" c="dimmed">{c.period(plan.periodCount, plan.periodUnit)}</Text>
                        </Text>
                        <Text size="sm">{c.includedLooks(plan.rendersIncluded)}</Text>
                        {appPricing.distribution !== 'public' && !plan.isFree && (
                          <Button
                            component="a"
                            href={`mailto:grindctrlnow@gmail.com?subject=${encodeURIComponent(c.requestSubject(state.shop, plan.name))}&body=${encodeURIComponent(c.requestBody(state.shop, plan.name))}`}
                            target="_top"
                            variant="outline"
                            fullWidth
                            mt="auto"
                            styles={{ label: { whiteSpace: 'normal' } }}
                          >
                            {c.askForPlan}
                          </Button>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
