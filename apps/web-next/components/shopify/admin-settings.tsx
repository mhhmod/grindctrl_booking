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
  loadingStyle: 'steps' | 'pulse' | 'bar';
  showDownload: boolean;
  showWhatsapp: boolean;
  showAddToCart: boolean;
  showTryAgain: boolean;
  disclaimerText: string | null;
  loadingSteps: string[] | null;
};

const APP_CLIENT_ID = 'fc095fe656d9029fdc249a4af2315f19';

/* Preset themes modeled on the most common Shopify storefront button
   styles (Dawn-style minimal black, warm editorial, bold commerce
   accents). Picking one fills the color fields; editing any = Custom. */
const THEMES: Array<{
  key: string;
  label: string;
  accentBg: string;
  accentFg: string;
  iconBgFrom: string;
  iconBgTo: string;
  radiusPx: number;
}> = [
  { key: 'minimal', label: 'Minimal Black', accentBg: '#121212', accentFg: '#ffffff', iconBgFrom: '#3a3a3a', iconBgTo: '#6b6b6b', radiusPx: 4 },
  { key: 'cream', label: 'Warm Cream', accentBg: '#2a2826', accentFg: '#f0ede9', iconBgFrom: '#ff9a3d', iconBgTo: '#ffd76e', radiusPx: 999 },
  { key: 'bold', label: 'Bold Orange', accentBg: '#eb7805', accentFg: '#ffffff', iconBgFrom: '#ffb25c', iconBgTo: '#ffe08a', radiusPx: 999 },
  { key: 'ocean', label: 'Ocean Blue', accentBg: '#1a73e8', accentFg: '#ffffff', iconBgFrom: '#6ab7ff', iconBgTo: '#a7d9ff', radiusPx: 8 },
  { key: 'forest', label: 'Forest Green', accentBg: '#1f7a4d', accentFg: '#ffffff', iconBgFrom: '#5cc98d', iconBgTo: '#b6f0cd', radiusPx: 8 },
  { key: 'luxe', label: 'Luxe Gold', accentBg: '#191919', accentFg: '#e8c872', iconBgFrom: '#e8c872', iconBgTo: '#f7e7b8', radiusPx: 0 },
];

function matchTheme(s: Settings): string {
  const t = THEMES.find(
    (t) =>
      t.accentBg.toLowerCase() === s.accentBg.toLowerCase() &&
      t.accentFg.toLowerCase() === s.accentFg.toLowerCase() &&
      t.iconBgFrom.toLowerCase() === s.iconBgFrom.toLowerCase() &&
      t.iconBgTo.toLowerCase() === s.iconBgTo.toLowerCase() &&
      t.radiusPx === s.radiusPx,
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

/* Same icon SVG + animation as the storefront block (tryon.liquid). */
function TryOnButtonPreview({ s }: { s: Settings }) {
  const dark = s.widgetTheme === 'dark';
  const sub = dark ? '#9c968f' : '#8a8378';
  return (
    <div
      className="rounded-lg border p-6 sm:p-8"
      style={{ background: dark ? '#1b1917' : '#faf8f5' }}
    >
      <style>{`
        @keyframes pv-tee { 0% { opacity: 0; transform: translateY(-2.5px) scale(0.9); } 16%, 80% { opacity: 1; transform: none; } 94%, 100% { opacity: 0; transform: translateY(-2.5px) scale(0.9); } }
        @keyframes pv-spark { 0%, 10% { opacity: 0; transform: scale(0.4); } 22% { opacity: 1; transform: scale(1); } 38%, 100% { opacity: 0; transform: scale(0.4); } }
        @keyframes pv-pan { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .pv-tee { animation: pv-tee 3.6s ease-in-out infinite; transform-origin: 12px 13px; }
        .pv-spark { animation: pv-spark 3.6s ease-in-out infinite; }
        .pv-spark2 { animation-delay: 0.5s; }
        @media (prefers-reduced-motion: reduce) { .pv-tee, .pv-spark { animation: none; opacity: 1; } }
      `}</style>
      <div
        className="mx-auto flex w-full max-w-md items-center justify-center gap-0 px-5 py-3 text-sm font-semibold"
        style={{
          background: s.accentBg,
          color: s.accentFg,
          borderRadius: `${s.radiusPx}px`,
        }}
      >
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full p-[3px]"
          style={{
            marginInlineEnd: 10,
            background: `linear-gradient(120deg, ${s.iconBgFrom}, ${s.iconBgTo}, ${s.iconBgFrom})`,
            backgroundSize: '220% 220%',
            animation: 'pv-pan 5s ease-in-out infinite',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
            <circle cx="12" cy="4.6" r="2.1" />
            <path d="M9.4 20.5V15M14.6 20.5V15" />
            <path className="pv-tee" d="M8.2 9.3 6.2 12l1.9 1.5.6-.8V17h6.6v-4.3l.6.8L17.8 12l-2-2.7c-1.2-.6-2.4-.9-3.8-.9s-2.6.3-3.8.9Z" />
            <path className="pv-spark" d="m19.6 3.4.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="currentColor" stroke="none" />
            <path className="pv-spark pv-spark2" d="m4.3 6 .4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span>{s.buttonLabel || 'Try it on with AI'}</span>
      </div>

      {/* Expanded widget mock: what shoppers see after clicking the button.
          The product card always shows the product being viewed. */}
      <div
        className="mx-auto mt-4 w-full max-w-md rounded-xl border p-4"
        style={{
          background: dark ? '#242220' : '#ffffff',
          borderColor: dark ? '#3a3733' : '#e8e4de',
          color: dark ? '#f0ede9' : '#2a2826',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-24 w-20 flex-none items-center justify-center rounded-lg border text-center text-[10px] leading-tight"
            style={{
              background: dark ? '#2e2b28' : '#f5f2ec',
              borderColor: dark ? '#3a3733' : '#e8e4de',
              color: sub,
            }}
          >
            Product
            <br />
            photo
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: sub }}>
              Your store
            </p>
            <p className="truncate text-base font-bold">The product being viewed</p>
            <p className="mt-1 text-xs" style={{ color: sub }}>
              Shoppers always try on the product on the page they opened, image and
              name come from your store automatically.
            </p>
          </div>
        </div>
        <div
          className="mt-4 rounded-lg border border-dashed px-4 py-5 text-center text-xs"
          style={{ borderColor: dark ? '#4a463f' : '#d8d2c8', color: sub }}
        >
          Upload your photo
        </div>
        <div
          className="mt-3 flex items-center justify-center px-4 py-2.5 text-xs font-semibold"
          style={{ background: s.accentBg, color: s.accentFg, borderRadius: `${Math.min(s.radiusPx, 20)}px` }}
        >
          Generate my look
        </div>
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: sub }}>
        Live preview: the button and try-on journey as they render on your product page
      </p>
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

  const activeTheme = matchTheme(s);
  const deepLink = shop
    ? `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`
    : '#';

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3 px-1 pt-1">
        <span
          className="flex size-9 items-center justify-center rounded-full p-1.5 text-[#2a2826]"
          style={{ background: 'linear-gradient(120deg, #ff9a3d, #ffd76e)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
            <circle cx="12" cy="4.6" r="2.1" />
            <path d="M8.2 9.3 6.2 12l1.9 1.5.6-.8V17h6.6v-4.3l.6.8L17.8 12l-2-2.7c-1.2-.6-2.4-.9-3.8-.9s-2.6.3-3.8.9Z" />
          </svg>
        </span>
        <div>
          <p className="text-base font-bold leading-tight tracking-tight">GrindCTRL Try-On</p>
          <p className="text-xs text-muted-foreground">
            AI try-on for your product pages, managed for you
          </p>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Add try-on to your product pages</CardTitle>
          <CardDescription>
            One click opens the theme editor with the try-on block already placed. Just press
            Save there.
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
          <CardTitle>Try-on on catalog pages</CardTitle>
          <CardDescription>
            Adds a small &quot;Try on&quot; button to every product card in your
            collection grids. It opens the same try-on journey with the same
            settings below. One click, then press Save in the theme editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a
              href={
                shop
                  ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${APP_CLIENT_ID}/tryon-catalog`
                  : '#'
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Enable catalog try-on
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Try-on button &amp; journey</CardTitle>
          <CardDescription>
            Pick a theme or fine-tune colors. Changes go live within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <TryOnButtonPreview s={s} />

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
                    className="h-4 w-4 rounded-full border"
                    style={{
                      background: `linear-gradient(120deg, ${t.accentBg} 55%, ${t.iconBgFrom})`,
                    }}
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

          <div className="grid gap-2">
            <Label htmlFor="button_label">Button label</Label>
            <Input
              id="button_label"
              value={s.buttonLabel}
              maxLength={40}
              onChange={(e) => set('buttonLabel', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="accent_bg">Button color</Label>
              <Input id="accent_bg" type="color" value={s.accentBg} className="h-10 p-1" onChange={(e) => set('accentBg', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accent_fg">Button text color</Label>
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

          <div className="grid grid-cols-2 gap-4">
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
                The surface behind the try-on journey. Pick whichever matches your
                store design; the preview above shows the effect.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Result screen buttons</Label>
            <p className="text-xs text-muted-foreground">
              What shoppers can do after seeing themselves in the product.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ['showAddToCart', 'Add to cart'],
                ['showDownload', 'Download preview'],
                ['showWhatsapp', 'Request order / WhatsApp'],
                ['showTryAgain', 'Try with a different photo'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="size-4 accent-primary"
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
            <Label htmlFor="loading_style">Loading animation</Label>
            <select
              id="loading_style"
              value={s.loadingStyle ?? 'steps'}
              onChange={(e) =>
                set('loadingStyle', e.target.value === 'pulse' || e.target.value === 'bar' ? e.target.value : 'steps')
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="steps">Checklist steps</option>
              <option value="pulse">Product photo pulse</option>
              <option value="bar">Progress bar</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="loading_steps">Loading steps (one per line, empty = default)</Label>
            <textarea
              id="loading_steps"
              rows={4}
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
              <span className="text-sm text-muted-foreground">Saved — live within a minute.</span>
            )}
            {status === 'error' && (
              <span className="text-sm text-destructive">Could not save. Try again.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
