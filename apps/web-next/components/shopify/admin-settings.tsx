'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TryOnSettingsControls,
  type TryOnWidgetSettings,
} from '@/components/try-on/settings-controls';
import { MerchantPlanCard, type MerchantPlan } from '@/components/shopify/merchant-plan-card';
import { getShopifySessionToken } from '@/lib/shopify/app-bridge-client';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';
import type { TryOnLocale } from '@/lib/try-on/i18n';
import type { ConsumeShopLinkResult } from '@/lib/shopify/shop-links';

const APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

function ShopLinkCard({
  initiallyLinked,
  c,
}: {
  initiallyLinked: boolean;
  c: ReturnType<typeof getSettingsFormCopy>;
}) {
  const [linked, setLinked] = useState(initiallyLinked);
  const [linkCode, setLinkCode] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | ConsumeShopLinkResult | 'error'
  >('idle');
  const hasError =
    status === 'invalid' ||
    status === 'expired' ||
    status === 'already_owned' ||
    status === 'error';

  const linkShop = useCallback(async () => {
    setStatus('submitting');
    try {
      const token = await getShopifySessionToken();
      const res = await fetch('/api/shopify/admin/link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: linkCode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { outcome?: unknown };
      if (
        data.outcome !== 'linked' &&
        data.outcome !== 'invalid' &&
        data.outcome !== 'expired' &&
        data.outcome !== 'already_owned'
      ) {
        throw new Error('Unexpected link outcome');
      }

      setStatus(data.outcome);
      if (data.outcome === 'linked') setLinked(true);
    } catch {
      setStatus('error');
    }
  }, [linkCode]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.shopLinkTitle}</CardTitle>
        <CardDescription>{c.shopLinkDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {linked ? (
          <p className="text-sm text-foreground" role="status">
            {status === 'linked' ? c.shopLinkSuccess : c.shopLinked}
          </p>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void linkShop();
            }}
          >
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="shop-link-code">{c.shopLinkCodeLabel}</Label>
              <Input
                id="shop-link-code"
                value={linkCode}
                onChange={(event) => {
                  setLinkCode(event.target.value);
                  if (status !== 'submitting') setStatus('idle');
                }}
                placeholder={c.shopLinkCodePlaceholder}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                required
                aria-invalid={hasError}
                aria-describedby={hasError ? 'shop-link-status' : undefined}
              />
            </div>
            <Button type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? c.linkingShop : c.linkShop}
            </Button>
            {hasError && (
              <p
                id="shop-link-status"
                className="text-sm text-destructive sm:col-span-2"
                role="alert"
              >
                {status === 'invalid'
                  ? c.shopLinkInvalid
                  : status === 'expired'
                    ? c.shopLinkExpired
                    : status === 'already_owned'
                      ? c.shopLinkAlreadyOwned
                      : c.shopLinkFailed}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ShopifyAdminSettings({ locale = 'en' }: { locale?: TryOnLocale }) {
  const c = getSettingsFormCopy(locale);
  const [shop, setShop] = useState('');
  const [s, setS] = useState<TryOnWidgetSettings | null>(null);
  const [plan, setPlan] = useState<MerchantPlan | null>(null);
  const [linked, setLinked] = useState(false);
  const [loadingStepsText, setLoadingStepsText] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(
    'loading',
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getShopifySessionToken();
        const res = await fetch('/api/shopify/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          shop: string;
          settings: TryOnWidgetSettings;
          plan?: MerchantPlan;
          linked: boolean;
        };
        if (cancelled) return;
        setShop(data.shop);
        setS(data.settings);
        if (data.plan) setPlan(data.plan);
        setLinked(data.linked);
        setLoadingStepsText(data.settings.loadingSteps?.join('\n') ?? '');
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback(
    <K extends keyof TryOnWidgetSettings>(key: K, value: TryOnWidgetSettings[K]) => {
      setS((prev) => (prev ? { ...prev, [key]: value } : prev));
      setStatus((st) => (st === 'saved' ? 'ready' : st));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!s) return;
    setStatus('saving');
    try {
      const token = await getShopifySessionToken();
      const res = await fetch('/api/shopify/admin/settings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...s,
          loadingSteps: loadingStepsText.trim()
            ? loadingStepsText.split('\n').map((l) => l.trim()).filter(Boolean)
            : null,
        }),
      });
      setStatus(res.ok ? 'saved' : 'error');
    } catch {
      setStatus('error');
    }
  }, [s, loadingStepsText]);

  if (status === 'loading') {
    return <p className="p-6 text-sm text-muted-foreground">Loading settings…</p>;
  }

  if (!s) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load settings. Open this page from your Shopify admin.
      </p>
    );
  }

  const deepLink = shop
    ? `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`
    : '#';
  const catalogLink = shop
    ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${APP_CLIENT_ID}/tryon-catalog`
    : '#';

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <ShopLinkCard initiallyLinked={linked} c={c} />

      {plan && <MerchantPlanCard plan={plan} shop={shop} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.productPages}</CardTitle>
            <CardDescription>
              Adds the try-on button under your product details. Press Save in the theme editor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <a href={deepLink} target="_blank" rel="noopener noreferrer">
                Add to product page
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.catalogPages}</CardTitle>
            <CardDescription>
              Adds a Try on pill to every product card in your collection grids.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <a href={catalogLink} target="_blank" rel="noopener noreferrer">
                Enable catalog try-on
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.appearance}</CardTitle>
          <CardDescription>
            One set of settings drives the product page, the catalog pill, and both journeys.
            Changes go live within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <TryOnSettingsControls
            locale={locale}
            value={s}
            onChange={set}
            loadingStepsText={loadingStepsText}
            onLoadingStepsTextChange={setLoadingStepsText}
          />

          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={status === 'saving'}>
              {status === 'saving' ? c.saving : c.save}
            </Button>
            {status === 'saved' && (
              <span className="text-sm text-muted-foreground">{c.saved}</span>
            )}
            {status === 'error' && (
              <span className="text-sm text-destructive">{c.saveFailed}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
