'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

declare global {
  interface Window {
    shopify?: { idToken(): Promise<string> };
  }
}

type Settings = {
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  iconBgFrom: string;
  iconBgTo: string;
  loadingSteps: string[] | null;
};

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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await withToken();
        const res = await fetch('/api/shopify/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { shop: string; settings: Settings };
        if (cancelled) return;
        setShop(data.shop);
        setSettings(data.settings);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!settings) return;
      setStatus('saving');
      try {
        const form = new FormData(e.currentTarget);
        const loadingStepsRaw = String(form.get('loading_steps') || '').trim();
        const token = await withToken();
        const res = await fetch('/api/shopify/admin/settings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buttonLabel: String(form.get('button_label') || ''),
            accentBg: String(form.get('accent_bg') || ''),
            accentFg: String(form.get('accent_fg') || ''),
            radiusPx: Number(form.get('radius_px')),
            widgetTheme: String(form.get('widget_theme') || 'light'),
            iconBgFrom: String(form.get('icon_bg_from') || ''),
            iconBgTo: String(form.get('icon_bg_to') || ''),
            loadingSteps: loadingStepsRaw
              ? loadingStepsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
              : null,
          }),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    },
    [settings],
  );

  if (status === 'loading') {
    return <p className="p-6 text-sm text-muted-foreground">Loading settings…</p>;
  }

  if (status === 'error' && !settings) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load settings. Open this page from your Shopify admin.
      </p>
    );
  }

  const deepLink = shop
    ? `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`
    : '#';

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add try-on to your product pages</CardTitle>
          <CardDescription>
            One click opens the theme editor with the try-on block already placed.
            Just press Save there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              Add block to product page
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Try-on button &amp; journey</CardTitle>
          <CardDescription>
            Controls how the try-on looks in your store. Changes go live within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="button_label">Button label</Label>
              <Input
                id="button_label"
                name="button_label"
                defaultValue={settings?.buttonLabel}
                maxLength={40}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="accent_bg">Button color</Label>
                <Input id="accent_bg" name="accent_bg" type="color" defaultValue={settings?.accentBg} className="h-10 p-1" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accent_fg">Button text color</Label>
                <Input id="accent_fg" name="accent_fg" type="color" defaultValue={settings?.accentFg} className="h-10 p-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="icon_bg_from">Icon gradient start</Label>
                <Input id="icon_bg_from" name="icon_bg_from" type="color" defaultValue={settings?.iconBgFrom} className="h-10 p-1" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon_bg_to">Icon gradient end</Label>
                <Input id="icon_bg_to" name="icon_bg_to" type="color" defaultValue={settings?.iconBgTo} className="h-10 p-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="radius_px">Corner radius (px)</Label>
                <Input id="radius_px" name="radius_px" type="number" min={0} max={999} defaultValue={settings?.radiusPx} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="widget_theme">Widget theme</Label>
                <select
                  id="widget_theme"
                  name="widget_theme"
                  defaultValue={settings?.widgetTheme}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loading_steps">Loading steps (one per line, empty = default)</Label>
              <textarea
                id="loading_steps"
                name="loading_steps"
                rows={4}
                defaultValue={settings?.loadingSteps?.join('\n') ?? ''}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={status === 'saving'}>
                {status === 'saving' ? 'Saving…' : 'Save settings'}
              </Button>
              {status === 'saved' && (
                <span className="text-sm text-muted-foreground">Saved — live within a minute.</span>
              )}
              {status === 'error' && settings && (
                <span className="text-sm text-destructive">Could not save. Try again.</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
