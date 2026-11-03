'use client';

import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import { ConnectShopPanel } from '@/components/dashboard/connect-shop-panel';
import { GcIcon } from '@/components/icons';
import { shopifyAdminAppUrl } from '@/lib/shopify/app-identity';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Under Set up: the store's Shopify app, and connecting another store.
   Neither is on the board, and nowhere else in the dashboard yet. */
export function V16TryOnApp({ locale, shop }: { locale: SiteLocale; shop: string }) {
  const copy = getTryOnDashboardCopy(locale);
  return (
    <Paper withBorder radius="card" p="lg">
      <Stack gap="md" align="flex-start">
        <Stack gap={4}>
          <Title order={2} size="h4">{copy.shopifyApp}</Title>
          <Text size="sm" c="dimmed">{copy.shopifyAppBody}</Text>
        </Stack>
        <Button
          component="a"
          href={shopifyAdminAppUrl(shop)}
          target="_blank"
          rel="noopener noreferrer"
          variant="default"
          radius="pill"
          h={44}
          rightSection={<GcIcon name="ext" size={15} />}
        >
          {copy.openShopifyApp}
        </Button>
        <ConnectShopPanel locale={locale} hasShops />
      </Stack>
    </Paper>
  );
}
