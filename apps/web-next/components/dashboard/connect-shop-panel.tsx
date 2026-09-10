'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateShopLinkCode } from '@/app/dashboard/connect-shop/actions';
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import type { ShopLinkCode } from '@/lib/shopify/shop-links';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

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

export function ConnectShopPanel({ locale }: { locale: SiteLocale }) {
  const c = getTryOnDashboardCopy(locale);
  const [linkCode, setLinkCode] = useState<ShopLinkCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');

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

  if (!linkCode) {
    return (
      <div className="grid justify-items-start gap-2">
        <Button type="button" size="sm" onClick={() => void generate()} disabled={status === 'generating'}>
          {status === 'generating' ? c.generatingShopLinkCode : c.connectStore}
        </Button>
        {status === 'error' && (
          <p className="text-sm text-destructive" role="alert">
            {c.shopLinkCodeFailed}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 justify-items-start gap-3">
      <div className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{c.shopLinkCodeLabel}</span>
        <output
          aria-label={c.shopLinkCodeLabel}
          className="max-w-full font-mono text-2xl font-semibold tracking-[0.16em] text-foreground sm:text-3xl"
          dir="ltr"
        >
          {formatCode(linkCode.code)}
        </output>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {c.connectStoreInstructions}
      </p>
      <p className="font-mono text-sm tabular-nums text-muted-foreground" role="status">
        {c.shopLinkExpiresIn(formatCountdown(remaining))}
      </p>
      {remaining === 0 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void generate()}
          disabled={status === 'generating'}
        >
          {status === 'generating' ? c.generatingShopLinkCode : c.generateNewShopLinkCode}
        </Button>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive" role="alert">
          {c.shopLinkCodeFailed}
        </p>
      )}
    </div>
  );
}
