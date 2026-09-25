/* Generated from the v15 prototype's markup (design/prototype/boards/
   Scroll.dc.html in the site-v15 handoff bundle, whose notes are in
   apps/web-next/docs/handoff/site-v15). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import Link from 'next/link';
import { PasswordChip } from '@/components/site/password-chip';
import { BOOKING_URL } from '@/lib/booking';
import { D_SHOPIFY } from '../story-marks';
import type { V, ViewProps } from '../story-types';

export function PhoneCta({ v, t }: ViewProps) {
  return (
    <>
      <section aria-labelledby="m-cta-title" style={{ position: "relative", padding: "72px 20px 116px", overflow: "hidden", textAlign: "center", background: "var(--foreground)", color: "var(--background)" }}>
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-150px", top: "-170px", width: "460px", height: "460px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--background) 10%, transparent), transparent)", "--dx": "50px", "--dy": "40px", animation: "gcs-drift 19s ease-in-out infinite" } as React.CSSProperties} />
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "140px", top: "170px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--background) 7%, transparent), transparent)", "--dx": "-60px", "--dy": "-30px", animation: "gcs-drift 24s ease-in-out infinite" } as React.CSSProperties} />
        <svg aria-hidden="true" width="390" height="90" viewBox="0 0 390 90" style={{ position: "absolute", insetInlineStart: "0", bottom: "0" }} fill="none" stroke="color-mix(in srgb, var(--background) 8%, transparent)" strokeWidth="1">
          <line x1="11.7" y1="0" x2="-253" y2="90" />
          <line x1="34.6" y1="0" x2="-197" y2="90" />
          <line x1="57.5" y1="0" x2="-141" y2="90" />
          <line x1="80.4" y1="0" x2="-85" y2="90" />
          <line x1="103.3" y1="0" x2="-29" y2="90" />
          <line x1="126.2" y1="0" x2="27" y2="90" />
          <line x1="149.1" y1="0" x2="83" y2="90" />
          <line x1="172.0" y1="0" x2="139" y2="90" />
          <line x1="194.9" y1="0" x2="195" y2="90" />
          <line x1="217.8" y1="0" x2="251" y2="90" />
          <line x1="240.7" y1="0" x2="307" y2="90" />
          <line x1="263.6" y1="0" x2="363" y2="90" />
          <line x1="286.5" y1="0" x2="419" y2="90" />
          <line x1="309.4" y1="0" x2="475" y2="90" />
          <line x1="332.3" y1="0" x2="531" y2="90" />
          <line x1="355.2" y1="0" x2="587" y2="90" />
          <line x1="378.1" y1="0" x2="643" y2="90" />
          <line x1="0" y1="1.7" x2="390" y2="1.7" />
          <line x1="0" y1="6.5" x2="390" y2="6.5" />
          <line x1="0" y1="13.9" x2="390" y2="13.9" />
          <line x1="0" y1="24.1" x2="390" y2="24.1" />
          <line x1="0" y1="36.8" x2="390" y2="36.8" />
          <line x1="0" y1="52.1" x2="390" y2="52.1" />
          <line x1="0" y1="69.8" x2="390" y2="69.8" />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "90px", animation: "gcs-floor 4.6s cubic-bezier(0.55, 0, 0.9, 0.35) -0.0s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "90px", animation: "gcs-floor 4.6s cubic-bezier(0.55, 0, 0.9, 0.35) -1.53s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "90px", animation: "gcs-floor 4.6s cubic-bezier(0.55, 0, 0.9, 0.35) -3.07s infinite" } as React.CSSProperties} />
        </svg>
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "20px", bottom: "84px", width: "350px", height: "12px", overflow: "hidden" }}>
          <div style={{ position: "absolute", insetInlineStart: "0", top: "5px", width: "350px", height: "1px", background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--background) 60%, transparent) 50%, transparent 100%)" }} />
          <div style={{ position: "absolute", insetInlineStart: "0", top: "4px", width: "120px", height: "3px", borderRadius: "3px", opacity: "0", background: "linear-gradient(90deg, transparent 0%, var(--background) 50%, transparent 100%)", boxShadow: "0 0 12px 1px color-mix(in srgb, var(--background) 45%, transparent)", "--from": "-120px", "--to": "350px", animation: "gcs-sweep 5.5s ease-in-out infinite" } as React.CSSProperties} />
        </div>
        <h2 id="m-cta-title" style={{ position: "relative", margin: "0", fontSize: "32px", lineHeight: "1.12", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))", color: "var(--background)" }}>{t("Give shoppers a reason to feel sure before checkout.")}</h2>
        <p style={{ position: "relative", margin: "14px 0 0", fontSize: "16px", lineHeight: "1.6", color: "var(--gc-inactive)" }}>{t("Book a call and we will map try-on and Store Chat to your Shopify theme and catalog.")}</p>
        <div style={{ position: "relative", marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link href="/try-on" data-tryon-link="" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "52px", borderRadius: "26px", background: "var(--background)", color: "var(--foreground)", textDecoration: "none", fontSize: "15px", fontWeight: "700", boxShadow: "0 14px 44px -14px color-mix(in srgb, var(--background) 50%, transparent)" }} onClick={v.tryFrom('cta')}>
            {t("Try it on yourself")}
            <span data-icon="inline-end" style={{ display: "inline-flex", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "gcs-nudge 2.4s ease-in-out infinite" }} data-flip="">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
          <a href={BOOKING_URL} target="_blank" onClick={v.bookFrom('cta')} rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "52px", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)", color: "var(--background)", textDecoration: "none", fontSize: "15px", fontWeight: "600" }}>{t("Book a call")}</a>
        </div>
        <div style={{ position: "relative", marginTop: "18px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <a href="https://grindctrl.myshopify.com" onClick={v.storeFrom('cta')} target="_blank" rel="noopener noreferrer" data-cta="" style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "48px", padding: "0 18px", borderRadius: "25px", background: "var(--background)", color: "var(--foreground)", textDecoration: "none", fontSize: "14.5px", fontWeight: "700", whiteSpace: "nowrap", transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
            {t("Open the live demo store")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
              <path d="M9 5h10v10" />
              <path d="M19 5L7 17" />
            </svg>
          </a>
          <PasswordChip copy={v.passCopy} tone="dark" />
        </div>
      </section>
    </>
  );
}
