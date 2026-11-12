'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack, Text } from '@mantine/core';
import { generateShopLinkCode, shopLinkCodeStatus } from '@/app/dashboard/connect-shop/actions';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import type { ShopLinkCode } from '@/lib/shopify/shop-links';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export const LINK_POLL_MS = 5_000;

function secondsUntil(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1_000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/* `hasShops`: the merchant already has a store, so the same code connects
   another store or re-links one (the Shopify page's "Link a different
   account"). The button stays available either way. */
export function ConnectShopPanel({ locale, hasShops = false, initialCode = null }: {
  locale: SiteLocale;
  hasShops?: boolean;
  /** Layout fixtures only: start from an issued code. */
  initialCode?: ShopLinkCode | null;
}) {
  const c = getTryOnDashboardCopy(locale);
  const [linkCode, setLinkCode] = useState<ShopLinkCode | null>(initialCode);
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  /** The shop the code connected, once it was entered in Shopify. */
  const [linked, setLinked] = useState<string | null>(null);
  const router = useRouter();

  const generate = useCallback(async () => {
    setStatus('generating');
    try {
      const next = await generateShopLinkCode();
      setLinkCode(next);
      setRemaining(secondsUntil(next.expiresAt));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!linkCode) return;

    const update = () => setRemaining(secondsUntil(linkCode.expiresAt));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [linkCode]);

  /* While the code can still be used, watch for it being entered in
     Shopify, then load the connected store without a reload. */
  useEffect(() => {
    if (!linkCode || linked) return;
    let reading = false;
    const interval = window.setInterval(async () => {
      if (secondsUntil(linkCode.expiresAt) === 0) { window.clearInterval(interval); return; }
      if (reading || document.visibilityState !== 'visible') return;
      reading = true;
      const { linkedShop } = await shopLinkCodeStatus(linkCode.code).catch(() => ({ linkedShop: null }));
      reading = false;
      if (!linkedShop) return;
      window.clearInterval(interval);
      setLinked(linkedShop);
      router.refresh();
    }, LINK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [linkCode, linked, router]);

  if (linked) {
    return (
      <Text size="sm" role="status" fw={600}>
        {c.shopLinked(linked)}
      </Text>
    );
  }

  if (!linkCode) {
    return (
      <Stack gap="xs" align="flex-start">
        <Button
          type="button"
          radius="pill"
          h={44}
          onClick={() => void generate()}
          loading={status === 'generating'}
          loaderProps={{ 'aria-hidden': true }}
        >
          {status === 'generating'
            ? c.generatingShopLinkCode
            : hasShops
              ? c.connectAnotherStore
              : c.connectStore}
        </Button>
        {status === 'error' && (
          <Text size="sm" c="danger" role="alert">
            {c.shopLinkCodeFailed}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm" align="flex-start" style={{ minWidth: 0 }}>
      <Stack gap={4}>
        <Text size="xs" fw={600} c="dimmed">
          {c.shopLinkCodeLabel}
        </Text>
        <Text
          component="output"
          aria-label={c.shopLinkCodeLabel}
          dir="ltr"
          ff="monospace"
          fw={600}
          fz={{ base: 24, sm: 30 }}
          style={{ letterSpacing: '0.16em', maxWidth: '100%' }}
        >
          {formatCode(linkCode.code)}
        </Text>
      </Stack>
      <Text size="sm" c="dimmed" maw="65ch">
        {c.connectStoreInstructions}
      </Text>
      <Text size="sm" c="dimmed" ff="monospace" role="status" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {c.shopLinkExpiresIn(formatCountdown(remaining))}
      </Text>
      {remaining === 0 && (
        <Button
          type="button"
          variant="default"
          radius="pill"
          h={44}
          onClick={() => void generate()}
          loading={status === 'generating'}
          loaderProps={{ 'aria-hidden': true }}
        >
          {status === 'generating' ? c.generatingShopLinkCode : c.generateNewShopLinkCode}
        </Button>
      )}
      {status === 'error' && (
        <Text size="sm" c="danger" role="alert">
          {c.shopLinkCodeFailed}
        </Text>
      )}
    </Stack>
  );
}
