'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WidgetPreview } from '@/components/try-on/widget-preview';

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
  loadingStyle: 'steps' | 'pulse' | 'bar';
  catalogLabel: string;
  catalogIconPx: number;
  catalogFontPx: number;
  catalogPadPx: number;
  buttonIconPx: number;
  showDownload: boolean;
  showWhatsapp: boolean;
  showAddToCart: boolean;
  showTryAgain: boolean;
  disclaimerText: string | null;
  loadingSteps: string[] | null;
};

const APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

/* Preset themes modeled on the most common Shopify storefront button
   styles. Picking one fills the color fields; editing any = Custom. */
const THEMES: Array<{
  key: string;
  label: string;
  accentBg: string;
  accentFg: string;
  iconBgFrom: string;
  iconBgTo: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
}> = [
  { key: 'minimal', label: 'Minimal Black', accentBg: '#121212', accentFg: '#ffffff', iconBgFrom: '#3a3a3a', iconBgTo: '#6b6b6b', radiusPx: 4, widgetTheme: 'light' },
  { key: 'cream', label: 'Warm Cream', accentBg: '#2a2826', accentFg: '#f0ede9', iconBgFrom: '#ff9a3d', iconBgTo: '#ffd76e', radiusPx: 999, widgetTheme: 'light' },
  { key: 'bold', label: 'Bold Orange', accentBg: '#eb7805', accentFg: '#ffffff', iconBgFrom: '#ffb25c', iconBgTo: '#ffe08a', radiusPx: 999, widgetTheme: 'light' },
  { key: 'ocean', label: 'Ocean Blue', accentBg: '#1a73e8', accentFg: '#ffffff', iconBgFrom: '#6ab7ff', iconBgTo: '#a7d9ff', radiusPx: 8, widgetTheme: 'light' },
  { key: 'forest', label: 'Forest Green', accentBg: '#1f7a4d', accentFg: '#ffffff', iconBgFrom: '#5cc98d', iconBgTo: '#b6f0cd', radiusPx: 8, widgetTheme: 'light' },
  { key: 'midnight', label: 'Midnight', accentBg: '#e8c872', accentFg: '#191919', iconBgFrom: '#e8c872', iconBgTo: '#f7e7b8', radiusPx: 0, widgetTheme: 'dark' },
];

function matchTheme(s: Settings): string {
  const t = THEMES.find(
    (theme) =>
      theme.accentBg.toLowerCase() === s.accentBg.toLowerCase() &&
      theme.accentFg.toLowerCase() === s.accentFg.toLowerCase() &&
      theme.iconBgFrom.toLowerCase() === s.iconBgFrom.toLowerCase() &&
      theme.iconBgTo.toLowerCase() === s.iconBgTo.toLowerCase() &&
      theme.radiusPx === s.radiusPx &&
      theme.widgetTheme === s.widgetTheme,
  );
  return t?.key ?? 'custom';
}

async function withToken(): Promise<string> {
  // App Bridge script loads sync, but wait up to 5s to be safe.
  for (let i = 0; i < 50 && !window.shopify; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!window.shopify) throw new Error('App Bridge not ready');
  return window.shopify.idToken();
}

/* Range field: the value is always visible, so dragging is never blind. */
function Range({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <span className="tabular-nums text-xs text-muted-foreground">{value}px</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
      />
    </div>
  );
}

export function ShopifyAdminSettings() {
  const [shop, setShop] = useState('');
  const [s, setS] = useState<Settings | null>(null);
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
        const data = (await res.json()) as { shop: string; settings: Settings };
        if (cancelled) return;
        setShop(data.shop);
        setS(data.settings);
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

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    setStatus((st) => (st === 'saved' ? 'ready' : st));
  }, []);

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

  const activeTheme = matchTheme(s);
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
          {/* Sticky so the preview stays in view while controls are tuned */}
          <div className="sticky top-0 z-10 -mx-6 border-b bg-background px-6 pb-4 pt-1">
            <WidgetPreview s={s} />
          </div>

          <div className="grid gap-2">
            <Label>Theme</Label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() =>
                    setS((prev) =>
                      prev
                        ? {
                            ...prev,
                            accentBg: t.accentBg,
                            accentFg: t.accentFg,
                            iconBgFrom: t.iconBgFrom,
                            iconBgTo: t.iconBgTo,
                            radiusPx: t.radiusPx,
                            widgetTheme: t.widgetTheme,
                          }
                        : prev,
                    )
                  }
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    activeTheme === t.key
                      ? 'border-foreground bg-foreground/5 font-medium'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  <span
                    className="size-4 rounded-full border"
                    style={{ background: `linear-gradient(120deg, ${t.accentBg} 55%, ${t.iconBgFrom})` }}
                  />
                  {t.label}
                </button>
              ))}
              <span
                className={`flex items-center rounded-full border px-3 py-1.5 text-sm ${
                  activeTheme === 'custom'
                    ? 'border-foreground bg-foreground/5 font-medium'
                    : 'border-dashed border-input text-muted-foreground'
                }`}
              >
                Custom
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="button_label">Button label</Label>
              <Input
                id="button_label"
                value={s.buttonLabel}
                maxLength={40}
                onChange={(e) => set('buttonLabel', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catalog_label">Catalog pill label</Label>
              <Input
                id="catalog_label"
                value={s.catalogLabel}
                maxLength={24}
                onChange={(e) => set('catalogLabel', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="accent_bg">Button color</Label>
              <Input id="accent_bg" type="color" value={s.accentBg} className="h-10 p-1" onChange={(e) => set('accentBg', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accent_fg">Text color</Label>
              <Input id="accent_fg" type="color" value={s.accentFg} className="h-10 p-1" onChange={(e) => set('accentFg', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon_bg_from">Icon gradient start</Label>
              <Input id="icon_bg_from" type="color" value={s.iconBgFrom} className="h-10 p-1" onChange={(e) => set('iconBgFrom', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon_bg_to">Icon gradient end</Label>
              <Input id="icon_bg_to" type="color" value={s.iconBgTo} className="h-10 p-1" onChange={(e) => set('iconBgTo', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Range
              id="button_icon_px"
              label="Button icon size"
              value={s.buttonIconPx}
              min={18}
              max={40}
              onChange={(v) => set('buttonIconPx', v)}
            />
            <Range
              id="catalog_icon_px"
              label="Catalog icon size"
              value={s.catalogIconPx}
              min={10}
              max={32}
              onChange={(v) => set('catalogIconPx', v)}
            />
            <Range
              id="catalog_font_px"
              label="Catalog label size"
              value={s.catalogFontPx}
              min={9}
              max={20}
              onChange={(v) => set('catalogFontPx', v)}
            />
            <Range
              id="catalog_pad_px"
              label="Catalog pill padding"
              value={s.catalogPadPx}
              min={2}
              max={16}
              onChange={(v) => set('catalogPadPx', v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="radius_px">Corner radius (px)</Label>
              <Input
                id="radius_px"
                type="number"
                min={0}
                max={999}
                value={s.radiusPx}
                onChange={(e) => set('radiusPx', Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="widget_theme">Try-on panel background</Label>
              <select
                id="widget_theme"
                value={s.widgetTheme}
                onChange={(e) => set('widgetTheme', e.target.value === 'dark' ? 'dark' : 'light')}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-xs text-muted-foreground">
                The surface behind the try-on journey, on product pages and in the catalog
                dialog. The preview above shows it.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="loading_style">Loading animation</Label>
            <select
              id="loading_style"
              value={s.loadingStyle ?? 'steps'}
              onChange={(e) =>
                set('loadingStyle', e.target.value === 'pulse' || e.target.value === 'bar' ? e.target.value : 'steps')
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs"
            >
              <option value="steps">Checklist steps</option>
              <option value="pulse">Product photo pulse</option>
              <option value="bar">Progress bar</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Result screen buttons</Label>
            <p className="text-xs text-muted-foreground">
              What shoppers can do after seeing themselves in the product.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['showAddToCart', 'Add to cart'],
                ['showDownload', 'Download preview'],
                ['showWhatsapp', 'Request order / WhatsApp'],
                ['showTryAgain', 'Try with a different photo'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="size-4 accent-foreground"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="disclaimer_text">Disclaimer under the result (empty = default)</Label>
            <textarea
              id="disclaimer_text"
              rows={2}
              value={s.disclaimerText ?? ''}
              onChange={(e) => set('disclaimerText', e.target.value || null)}
              placeholder="This preview is visual guidance only..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="loading_steps">Loading steps (one per line, empty = default)</Label>
            <textarea
              id="loading_steps"
              rows={3}
              value={loadingStepsText}
              onChange={(e) => setLoadingStepsText(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

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
