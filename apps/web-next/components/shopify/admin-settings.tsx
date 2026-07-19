'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TryOnSettingsControls,
  type TryOnWidgetSettings,
} from '@/components/try-on/settings-controls';
import { MerchantPlanCard, type MerchantPlan } from '@/components/shopify/merchant-plan-card';

declare global {
  interface Window {
    shopify?: { idToken(): Promise<string> };
  }
}

const APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

async function withToken(): Promise<string> {
  // App Bridge script loads sync, but wait up to 5s to be safe.
  for (let i = 0; i < 50 && !window.shopify; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!window.shopify) throw new Error('App Bridge not ready');
  return window.shopify.idToken();
}

export function ShopifyAdminSettings() {
  const [shop, setShop] = useState('');
  const [s, setS] = useState<TryOnWidgetSettings | null>(null);
  const [plan, setPlan] = useState<MerchantPlan | null>(null);
  const [loadingStepsText, setLoadingStepsText] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(
    'loading',
  );
  /* Shopify's own admin theme isn't readable from an embedded app, so this
     page carries its own toggle (next-themes handles persistence). */
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await withToken();
        const res = await fetch('/api/shopify/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          shop: string;
          settings: TryOnWidgetSettings;
          plan?: MerchantPlan;
        };
        if (cancelled) return;
        setShop(data.shop);
        setS(data.settings);
        if (data.plan) setPlan(data.plan);
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
      const token = await withToken();
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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-background text-foreground">{children}</div>
  );

  if (status === 'loading') {
    return shell(<p className="p-6 text-sm text-muted-foreground">Loading settings…</p>);
  }

  if (!s) {
    return shell(
      <p className="p-6 text-sm text-destructive">
        Could not load settings. Open this page from your Shopify admin.
      </p>,
    );
  }

  const deepLink = shop
    ? `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`
    : '#';
  const catalogLink = shop
    ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${APP_CLIENT_ID}/tryon-catalog`
    : '#';

  return shell(
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 px-1 pt-1">
        <BrandLogo size="sm" subtitle="AI try-on, managed for you" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Switch between light and dark"
          title="Switch between light and dark"
        >
          {/* CSS-swapped so the icon needs no client-only state */}
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </Button>
      </header>

      {plan && <MerchantPlanCard plan={plan} shop={shop} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product pages</CardTitle>
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
            <CardTitle className="text-base">Catalog pages</CardTitle>
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
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            One set of settings drives the product page, the catalog pill, and both journeys.
            Changes go live within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <TryOnSettingsControls
            value={s}
            onChange={set}
            loadingStepsText={loadingStepsText}
            onLoadingStepsTextChange={setLoadingStepsText}
          />

          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Save settings'}
            </Button>
            {status === 'saved' && (
              <span className="text-sm text-muted-foreground">Saved, live within a minute.</span>
            )}
            {status === 'error' && (
              <span className="text-sm text-destructive">Could not save. Try again.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>,
  );
}
