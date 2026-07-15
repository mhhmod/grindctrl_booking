'use client';

import * as React from 'react';

/* Shared live preview of the storefront surfaces: try-on button (with the
   scan-beam icon), the expanded journey, and the catalog card pill.
   Used by the Shopify embedded admin and the GrindCTRL dashboard. */

export type WidgetPreviewSettings = {
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: 'light' | 'dark';
  iconBgFrom: string;
  iconBgTo: string;
};

function ScanIcon({ clipId }: { clipId: string }) {
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

export function WidgetPreview({ s }: { s: WidgetPreviewSettings }) {
  const dark = s.widgetTheme === 'dark';
  const sub = dark ? '#9c968f' : '#8a8378';
  const cardBg = dark ? '#242220' : '#ffffff';
  const cardBorder = dark ? '#3a3733' : '#e8e4de';

  return (
    <div
      className="rounded-lg border p-6 sm:p-8"
      style={{ background: dark ? '#1b1917' : '#faf8f5' }}
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
        @media (prefers-reduced-motion: reduce) {
          .pv-scan, .pv-spark { animation: none; opacity: 1; transform: none; }
          .pv-badge::after { animation: none; opacity: 0; }
        }
      `}</style>

      {/* ── The button ── */}
      <div
        className="mx-auto flex w-full max-w-md items-center justify-center px-5 py-3 text-sm font-semibold"
        style={{ background: s.accentBg, color: s.accentFg, borderRadius: `${s.radiusPx}px` }}
      >
        <span
          className="pv-badge flex h-7 w-7 flex-none items-center justify-center rounded-full p-[3px]"
          style={
            {
              marginInlineEnd: 10,
              background: `linear-gradient(120deg, ${s.iconBgFrom}, ${s.iconBgTo}, ${s.iconBgFrom})`,
              backgroundSize: '220% 220%',
              animation: 'pv-pan 5s ease-in-out infinite',
              '--pv-ring': s.iconBgTo,
            } as React.CSSProperties
          }
        >
          <ScanIcon clipId="pv-bust-a" />
        </span>
        <span>{s.buttonLabel || 'Try it on with AI'}</span>
      </div>

      {/* ── Journey mock ── */}
      <div
        className="mx-auto mt-4 w-full max-w-md rounded-xl border p-4"
        style={{ background: cardBg, borderColor: cardBorder, color: dark ? '#f0ede9' : '#2a2826' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-24 w-20 flex-none items-center justify-center rounded-lg border text-center text-[10px] leading-tight"
            style={{ background: dark ? '#2e2b28' : '#f5f2ec', borderColor: cardBorder, color: sub }}
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
              Shoppers always try on the product on the page they opened, image and name
              come from your store automatically.
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

      {/* ── Catalog card mock ── */}
      <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="min-w-0">
            <div
              className="relative flex aspect-[3/4] items-center justify-center rounded-lg border text-[10px]"
              style={{ background: dark ? '#2e2b28' : '#f0ece5', borderColor: cardBorder, color: sub }}
            >
              Product image
              <span
                className="absolute bottom-2 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold shadow-md"
                style={{
                  insetInlineEnd: 8,
                  background: s.accentBg,
                  color: s.accentFg,
                  borderRadius: `${Math.min(s.radiusPx, 999)}px`,
                }}
              >
                <span className="inline-flex size-3.5">
                  <ScanIcon clipId={`pv-bust-c${i}`} />
                </span>
                Try on
              </span>
            </div>
            <p className="mt-1.5 truncate text-xs font-medium" style={{ color: dark ? '#f0ede9' : '#2a2826' }}>
              Catalog product
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: sub }}>
        Live preview: the button, journey, and catalog pill exactly as they render in your store
      </p>
    </div>
  );
}
