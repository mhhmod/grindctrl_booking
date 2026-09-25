/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import Link from 'next/link';
import { PasswordChip } from '@/components/site/password-chip';
import { BOOKING_URL } from '@/lib/booking';
import { D_SHOPIFY } from '../story-marks';
import type { V, ViewProps } from '../story-types';

export function DeskCta({ v, t }: ViewProps) {
  return (
    <>
      <section aria-labelledby="cta-title" style={{ position: "relative", padding: "120px 120px 176px", overflow: "hidden", textAlign: "center", background: "var(--foreground)", color: "var(--background)" }}>
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-180px", top: "-300px", width: "780px", height: "780px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--background) 10%, transparent), transparent)", "--dx": "130px", "--dy": "60px", animation: "gcs-drift 19s ease-in-out infinite" } as React.CSSProperties} />
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "820px", top: "-160px", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--background) 7%, transparent), transparent)", "--dx": "-140px", "--dy": "50px", animation: "gcs-drift 24s ease-in-out infinite" } as React.CSSProperties} />
        <svg aria-hidden="true" width="1440" height="150" viewBox="0 0 1440 150" style={{ position: "absolute", insetInlineStart: "0", bottom: "0" }} fill="none" stroke="color-mix(in srgb, var(--background) 8%, transparent)" strokeWidth="1">
          <line x1="-36.4" y1="0" x2="-1200" y2="150" />
          <line x1="10.9" y1="0" x2="-1080" y2="150" />
          <line x1="58.1" y1="0" x2="-960" y2="150" />
          <line x1="105.4" y1="0" x2="-840" y2="150" />
          <line x1="152.7" y1="0" x2="-720" y2="150" />
          <line x1="200.0" y1="0" x2="-600" y2="150" />
          <line x1="247.2" y1="0" x2="-480" y2="150" />
          <line x1="294.5" y1="0" x2="-360" y2="150" />
          <line x1="341.8" y1="0" x2="-240" y2="150" />
          <line x1="389.0" y1="0" x2="-120" y2="150" />
          <line x1="436.3" y1="0" x2="0" y2="150" />
          <line x1="483.6" y1="0" x2="120" y2="150" />
          <line x1="530.8" y1="0" x2="240" y2="150" />
          <line x1="578.1" y1="0" x2="360" y2="150" />
          <line x1="625.4" y1="0" x2="480" y2="150" />
          <line x1="672.7" y1="0" x2="600" y2="150" />
          <line x1="719.9" y1="0" x2="720" y2="150" />
          <line x1="767.2" y1="0" x2="840" y2="150" />
          <line x1="814.5" y1="0" x2="960" y2="150" />
          <line x1="861.7" y1="0" x2="1080" y2="150" />
          <line x1="909.0" y1="0" x2="1200" y2="150" />
          <line x1="956.3" y1="0" x2="1320" y2="150" />
          <line x1="1003.5" y1="0" x2="1440" y2="150" />
          <line x1="1050.8" y1="0" x2="1560" y2="150" />
          <line x1="1098.1" y1="0" x2="1680" y2="150" />
          <line x1="1145.3" y1="0" x2="1800" y2="150" />
          <line x1="1192.6" y1="0" x2="1920" y2="150" />
          <line x1="1239.9" y1="0" x2="2040" y2="150" />
          <line x1="1287.2" y1="0" x2="2160" y2="150" />
          <line x1="1334.4" y1="0" x2="2280" y2="150" />
          <line x1="1381.7" y1="0" x2="2400" y2="150" />
          <line x1="1429.0" y1="0" x2="2520" y2="150" />
          <line x1="1476.2" y1="0" x2="2640" y2="150" />
          <line x1="0" y1="1.6" x2="1440" y2="1.6" />
          <line x1="0" y1="5.9" x2="1440" y2="5.9" />
          <line x1="0" y1="12.7" x2="1440" y2="12.7" />
          <line x1="0" y1="21.9" x2="1440" y2="21.9" />
          <line x1="0" y1="33.5" x2="1440" y2="33.5" />
          <line x1="0" y1="47.4" x2="1440" y2="47.4" />
          <line x1="0" y1="63.6" x2="1440" y2="63.6" />
          <line x1="0" y1="81.9" x2="1440" y2="81.9" />
          <line x1="0" y1="102.5" x2="1440" y2="102.5" />
          <line x1="0" y1="125.1" x2="1440" y2="125.1" />
          <line x1="0" y1="0" x2="1440" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "150px", animation: "gcs-floor 5.4s cubic-bezier(0.55, 0, 0.9, 0.35) -0.0s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="1440" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "150px", animation: "gcs-floor 5.4s cubic-bezier(0.55, 0, 0.9, 0.35) -1.8s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="1440" y2="0" stroke="color-mix(in srgb, var(--background) 30%, transparent)" style={{ opacity: "0", "--d": "150px", animation: "gcs-floor 5.4s cubic-bezier(0.55, 0, 0.9, 0.35) -3.6s infinite" } as React.CSSProperties} />
        </svg>
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "250px", bottom: "144px", width: "940px", height: "12px", overflow: "hidden" }}>
          <div style={{ position: "absolute", insetInlineStart: "0", top: "5px", width: "940px", height: "1px", background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--background) 60%, transparent) 50%, transparent 100%)" }} />
          <div style={{ position: "absolute", insetInlineStart: "0", top: "4px", width: "200px", height: "3px", borderRadius: "3px", opacity: "0", background: "linear-gradient(90deg, transparent 0%, var(--background) 50%, transparent 100%)", boxShadow: "0 0 12px 1px color-mix(in srgb, var(--background) 45%, transparent)", "--from": "-200px", "--to": "940px", animation: "gcs-sweep 5.5s ease-in-out infinite" } as React.CSSProperties} />
        </div>
        <h2 id="cta-title" style={{ position: "relative", margin: "0 auto", maxWidth: "900px", fontSize: "50px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))", color: "var(--background)" }}>{t("Give shoppers a reason to feel sure before checkout.")}</h2>
        <p style={{ position: "relative", margin: "18px auto 0", maxWidth: "620px", fontSize: "18px", lineHeight: "1.6", color: "var(--gc-inactive)" }}>{t("Book a call and we will map try-on and Store Chat to your Shopify theme, catalog and customer questions.")}</p>
        <div style={{ position: "relative", marginTop: "32px", display: "flex", justifyContent: "center", gap: "12px" }}>
          <Link href="/try-on" data-tryon-link="" style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "52px", padding: "0 24px", borderRadius: "26px", background: "var(--background)", color: "var(--foreground)", textDecoration: "none", fontSize: "15px", fontWeight: "700", boxShadow: "0 14px 44px -14px color-mix(in srgb, var(--background) 50%, transparent)" }} onClick={v.tryFrom('cta')}>
            {t("Try it on yourself")}
            <span data-icon="inline-end" style={{ display: "inline-flex", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "gcs-nudge 2.4s ease-in-out infinite" }} data-flip="">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
          <a href={BOOKING_URL} target="_blank" onClick={v.bookFrom('cta')} rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", height: "52px", padding: "0 24px", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)", color: "var(--background)", textDecoration: "none", fontSize: "15px", fontWeight: "600" }}>{t("Book a call")}</a>
        </div>
        <div style={{ position: "relative", marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <a href="https://grindctrl.myshopify.com" onClick={v.storeFrom('cta')} target="_blank" rel="noopener noreferrer" data-cta="" style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "50px", padding: "0 20px", borderRadius: "25px", background: "var(--background)", color: "var(--foreground)", textDecoration: "none", fontSize: "15px", fontWeight: "700", whiteSpace: "nowrap", transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease" }}>
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
