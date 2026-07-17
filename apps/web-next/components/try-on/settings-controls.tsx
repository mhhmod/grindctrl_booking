'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WidgetPreview } from '@/components/try-on/widget-preview';

/* The one try-on settings form. The Shopify embedded admin and the
   GrindCTRL dashboard both render this, so the two surfaces cannot drift:
   a control added here appears in both, wired to the same columns. Hosts
   own only auth and saving. */

export type TryOnWidgetSettings = {
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

/* Presets modeled on the most common Shopify storefront button styles.
   Picking one fills every colour field; editing any field reads as Custom. */
export const TRYON_THEMES: Array<{
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

export function matchTryOnTheme(s: TryOnWidgetSettings): string {
  const hit = TRYON_THEMES.find(
    (t) =>
      t.accentBg.toLowerCase() === s.accentBg.toLowerCase() &&
      t.accentFg.toLowerCase() === s.accentFg.toLowerCase() &&
      t.iconBgFrom.toLowerCase() === s.iconBgFrom.toLowerCase() &&
      t.iconBgTo.toLowerCase() === s.iconBgTo.toLowerCase() &&
      t.radiusPx === s.radiusPx &&
      t.widgetTheme === s.widgetTheme,
  );
  return hit?.key ?? 'custom';
}

/* The value rides alongside the slider: dragging is never blind. */
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

export function TryOnSettingsControls({
  value: s,
  onChange,
  loadingStepsText,
  onLoadingStepsTextChange,
}: {
  value: TryOnWidgetSettings;
  onChange: <K extends keyof TryOnWidgetSettings>(key: K, next: TryOnWidgetSettings[K]) => void;
  loadingStepsText: string;
  onLoadingStepsTextChange: (text: string) => void;
}) {
  const activeTheme = matchTryOnTheme(s);

  return (
    <div className="grid gap-6">
      {/* Sticky so the preview stays in view while controls are tuned */}
      <div className="sticky top-0 z-10 -mx-6 border-b bg-background px-6 pb-4 pt-1">
        <WidgetPreview s={s} />
      </div>

      <div className="grid gap-2">
        <Label>Theme</Label>
        <div className="flex flex-wrap gap-2">
          {TRYON_THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                onChange('accentBg', t.accentBg);
                onChange('accentFg', t.accentFg);
                onChange('iconBgFrom', t.iconBgFrom);
                onChange('iconBgTo', t.iconBgTo);
                onChange('radiusPx', t.radiusPx);
                onChange('widgetTheme', t.widgetTheme);
              }}
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
            onChange={(e) => onChange('buttonLabel', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="catalog_label">Catalog pill label</Label>
          <Input
            id="catalog_label"
            value={s.catalogLabel}
            maxLength={24}
            onChange={(e) => onChange('catalogLabel', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="accent_bg">Button color</Label>
          <Input id="accent_bg" type="color" value={s.accentBg} className="h-10 p-1" onChange={(e) => onChange('accentBg', e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="accent_fg">Text color</Label>
          <Input id="accent_fg" type="color" value={s.accentFg} className="h-10 p-1" onChange={(e) => onChange('accentFg', e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="icon_bg_from">Icon gradient start</Label>
          <Input id="icon_bg_from" type="color" value={s.iconBgFrom} className="h-10 p-1" onChange={(e) => onChange('iconBgFrom', e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="icon_bg_to">Icon gradient end</Label>
          <Input id="icon_bg_to" type="color" value={s.iconBgTo} className="h-10 p-1" onChange={(e) => onChange('iconBgTo', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Range id="button_icon_px" label="Button icon size" value={s.buttonIconPx} min={18} max={40} onChange={(v) => onChange('buttonIconPx', v)} />
        <Range id="catalog_icon_px" label="Catalog icon size" value={s.catalogIconPx} min={10} max={32} onChange={(v) => onChange('catalogIconPx', v)} />
        <Range id="catalog_font_px" label="Catalog label size" value={s.catalogFontPx} min={9} max={20} onChange={(v) => onChange('catalogFontPx', v)} />
        <Range id="catalog_pad_px" label="Catalog pill padding" value={s.catalogPadPx} min={2} max={16} onChange={(v) => onChange('catalogPadPx', v)} />
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
            onChange={(e) => onChange('radiusPx', Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="widget_theme">Try-on panel background</Label>
          <select
            id="widget_theme"
            value={s.widgetTheme}
            onChange={(e) => onChange('widgetTheme', e.target.value === 'dark' ? 'dark' : 'light')}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p className="text-xs text-muted-foreground">
            The surface behind the try-on journey, on product pages and in the catalog dialog.
            The preview above shows it.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="loading_style">Loading animation</Label>
        <select
          id="loading_style"
          value={s.loadingStyle}
          onChange={(e) =>
            onChange('loadingStyle', e.target.value === 'pulse' || e.target.value === 'bar' ? e.target.value : 'steps')
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
                onChange={(e) => onChange(key, e.target.checked)}
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
          onChange={(e) => onChange('disclaimerText', e.target.value || null)}
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
          onChange={(e) => onLoadingStepsTextChange(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
