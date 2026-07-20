'use client';

import * as React from 'react';
import { useId, useState } from 'react';

/* Interactive preview of every shopper-facing surface: the product-page
   button, the journey it expands into, and the catalog card pill with its
   dialog. Colors are the embed's own tokens, so what merchants see here is
   what ships. Used by the Shopify embedded admin and the GrindCTRL dashboard. */

export type WidgetPreviewSettings = {
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  iconBgFrom: string;
  iconBgTo: string;
  catalogLabel: string;
  catalogIconPx: number;
  catalogFontPx: number;
  catalogPadPx: number;
  buttonIconPx: number;
};

/* Mirrors app/globals.css :root / .dark token values exactly. */
const TOKENS = {
  light: {
    bg: 'oklch(0.945 0.007 75)',
    card: 'oklch(0.965 0.007 78)',
    fg: 'oklch(0.235 0.006 60)',
    mutedFg: 'oklch(0.5 0.008 66)',
    muted: 'oklch(0.905 0.008 76)',
    border: 'oklch(0.86 0.009 76)',
  },
  dark: {
    bg: 'oklch(0.135 0.004 70)',
    card: 'oklch(0.175 0.005 68)',
    fg: 'oklch(0.94 0.008 78)',
    mutedFg: 'oklch(0.68 0.012 72)',
    muted: 'oklch(0.24 0.005 68)',
    border: 'oklch(0.26 0.006 66)',
  },
};

function ScanIcon() {
  const clipId = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="h-full w-full" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="6.6" r="3.2" />
          <path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z" />
        </clipPath>
      </defs>
      <g opacity="0.5">
        <circle cx="12" cy="6.6" r="3.2" />
        <path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z" />
      </g>
      <g clipPath={`url(#${clipId})`}>
        <rect className="pv-scan" x="2" y="1" width="20" height="2.4" rx="1.2" />
      </g>
      <path className="pv-spark" d="m20 2.6.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" />
    </svg>
  );
}

/* The gradient badge that carries the icon, sized by settings. */
function IconBadge({ s, px }: { s: WidgetPreviewSettings; px: number }) {
  return (
    <span
      className="pv-badge inline-flex flex-none items-center justify-center rounded-full"
      style={
        {
          width: px,
          height: px,
          padding: Math.max(2, Math.round(px * 0.11)),
          background: `linear-gradient(120deg, ${s.iconBgFrom}, ${s.iconBgTo}, ${s.iconBgFrom})`,
          backgroundSize: '220% 220%',
          animation: 'pv-pan 5s ease-in-out infinite',
          '--pv-ring': s.iconBgTo,
        } as React.CSSProperties
      }
    >
      <ScanIcon />
    </span>
  );
}

function JourneyMock({ s, t }: { s: WidgetPreviewSettings; t: (typeof TOKENS)['light'] }) {
  return (
    <div
      className="pv-reveal rounded-xl border p-4"
      style={{ background: t.card, borderColor: t.border, color: t.fg }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-20 w-16 flex-none items-center justify-center rounded-lg border text-center text-[10px] leading-tight"
          style={{ background: t.muted, borderColor: t.border, color: t.mutedFg }}
        >
          Product
          <br />
          photo
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: t.mutedFg }}>
            Your store
          </p>
          <p className="truncate text-sm font-bold">The product being viewed</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: t.mutedFg }}>
            Image and name come from your store automatically.
          </p>
        </div>
      </div>
      <div
        className="mt-3 rounded-lg border border-dashed px-4 py-4 text-center text-xs"
        style={{ borderColor: t.border, color: t.mutedFg }}
      >
        Upload your photo
      </div>
      <div
        className="mt-3 flex items-center justify-center px-4 py-2.5 text-xs font-semibold"
        style={{
          background: s.accentBg,
          color: s.accentFg,
          borderRadius: `${Math.min(s.radiusPx, 20)}px`,
        }}
      >
        Generate my look
      </div>
    </div>
  );
}

export function WidgetPreview({ s }: { s: WidgetPreviewSettings }) {
  const [view, setView] = useState<'product' | 'catalog'>('product');
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dark = s.widgetTheme === 'dark';
  const t = dark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="grid gap-2">
      {/* Controls: which surface, and what the shopper theme is */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-input p-0.5" role="tablist">
          {(['product', 'catalog'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                setExpanded(false);
                setDialogOpen(false);
              }}
              className={`min-h-10 rounded-md px-3.5 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'product' ? 'Product page' : 'Catalog'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Shopper view, {dark ? 'dark' : 'light'} panel
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border p-5 sm:p-6"
        style={{ background: t.bg, borderColor: t.border }}
      >
        <style>{`
          @keyframes pv-pan { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
          @keyframes pv-scan {
            0% { transform: translateY(0); opacity: 0; }
            12% { opacity: 1; }
            58% { transform: translateY(17px); opacity: 1; }
            72%, 100% { transform: translateY(17px); opacity: 0; }
          }
          @keyframes pv-ring {
            0% { transform: scale(1); opacity: 0.7; }
            75%, 100% { transform: scale(1.5); opacity: 0; }
          }
          @keyframes pv-spark {
            0%, 55% { opacity: 0; transform: scale(0.3); }
            66% { opacity: 1; transform: scale(1.1); }
            74% { transform: scale(1); }
            88%, 100% { opacity: 0; transform: scale(0.3); }
          }
          @keyframes pv-reveal {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: none; }
          }
          .pv-scan { animation: pv-scan 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
          .pv-spark { animation: pv-spark 2.6s ease-out infinite; transform-origin: 20.5px 4.9px; }
          .pv-badge { position: relative; }
          .pv-badge::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 2px solid var(--pv-ring, #ffd76e);
            animation: pv-ring 2.6s ease-out infinite;
          }
          .pv-reveal { animation: pv-reveal 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
          .pv-press { transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease; }
          .pv-press:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.18); }
          @media (prefers-reduced-motion: reduce) {
            .pv-scan, .pv-spark, .pv-reveal { animation: none; opacity: 1; transform: none; }
            .pv-badge::after { animation: none; opacity: 0; }
            .pv-press:hover { transform: none; }
          }
        `}</style>

        {view === 'product' ? (
          <div className="mx-auto grid w-full max-w-md gap-3">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="pv-press flex w-full items-center justify-center px-5 py-3 text-sm font-semibold"
              style={{
                background: s.accentBg,
                color: s.accentFg,
                borderRadius: `${s.radiusPx}px`,
              }}
            >
              <span style={{ marginInlineEnd: 10, display: 'inline-flex' }}>
                <IconBadge s={s} px={s.buttonIconPx} />
              </span>
              {s.buttonLabel || 'Try it on with AI'}
            </button>
            {expanded ? <JourneyMock s={s} t={t} /> : null}
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
            {['Catalog product', 'Another product'].map((name) => (
              <div key={name} className="min-w-0">
                <div
                  className="relative flex aspect-[3/4] items-center justify-center rounded-lg border text-[10px]"
                  style={{ background: t.muted, borderColor: t.border, color: t.mutedFg }}
                >
                  Product image
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="pv-press absolute bottom-2 inline-flex max-w-[calc(100%-16px)] items-center font-semibold shadow-md"
                    style={{
                      insetInlineEnd: 8,
                      gap: 6,
                      padding: `${s.catalogPadPx}px ${s.catalogPadPx * 2}px`,
                      fontSize: s.catalogFontPx,
                      lineHeight: 1,
                      background: s.accentBg,
                      color: s.accentFg,
                      borderRadius: 999,
                    }}
                  >
                    <span
                      className="inline-flex flex-none"
                      style={{ width: s.catalogIconPx, height: s.catalogIconPx }}
                    >
                      <ScanIcon />
                    </span>
                    {s.catalogLabel || 'Try on'}
                  </button>
                </div>
                <p className="mt-1.5 truncate text-xs font-medium" style={{ color: t.fg }}>
                  {name}
                </p>
              </div>
            ))}

            {dialogOpen ? (
              <div
                className="pv-reveal absolute inset-0 z-10 flex items-center justify-center p-4"
                style={{ background: 'rgba(20, 18, 16, 0.6)' }}
              >
                <div
                  className="relative w-full max-w-[300px] overflow-hidden rounded-2xl p-3 shadow-2xl"
                  style={{ background: t.bg }}
                >
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    aria-label="Close preview dialog"
                    className="absolute end-2 top-2 z-10 grid size-7 place-items-center rounded-full text-sm"
                    style={{ background: 'rgba(42,40,38,0.75)', color: '#f0ede9' }}
                  >
                    ×
                  </button>
                  <JourneyMock s={s} t={t} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {view === 'product'
          ? expanded
            ? 'This is the journey shoppers get on the product page. Click the button again to collapse.'
            : 'Click the button to see the journey shoppers get.'
          : dialogOpen
            ? 'The catalog dialog runs the same journey, from the same settings.'
            : 'Click a Try on pill to open the catalog dialog.'}
      </p>
    </div>
  );
}
