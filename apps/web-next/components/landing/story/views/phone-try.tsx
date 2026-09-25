/* Generated from the v15 prototype's markup (design/prototype/boards/
   Scroll.dc.html in the site-v15 handoff bundle, whose notes are in
   apps/web-next/docs/handoff/site-v15). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import Link from 'next/link';
import { BOOKING_URL } from '@/lib/booking';
import { D_SHOPIFY } from '../story-marks';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function PhoneTry({ v, t }: ViewProps) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "390px", height: "100%", marginInlineStart: "-195px" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "0", background: "radial-gradient(90% 42% at 50% 18%, var(--card) 0%, transparent 72%)" }} />
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-170px", top: "-170px", width: "480px", height: "480px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--foreground) 5.5%, transparent), transparent)", "--dx": "50px", "--dy": "-30px", animation: "gcs-drift 19s ease-in-out infinite" } as React.CSSProperties} />
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "150px", top: "380px", width: "440px", height: "440px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--foreground) 3.5%, transparent), transparent)", "--dx": "-60px", "--dy": "40px", animation: "gcs-drift 24s ease-in-out infinite" } as React.CSSProperties} />
        <svg aria-hidden="true" width="390" height="700" viewBox="0 0 390 700" style={{ position: "absolute", insetInlineStart: "0", top: "0" }}>
          <circle cx="30" cy="130" r="1.4" fill="color-mix(in srgb, var(--foreground) 18%, transparent)" style={{ animation: "gcs-twinkle 3.2s ease-in-out 0.0s infinite" }} />
          <circle cx="352" cy="118" r="1.6" fill="color-mix(in srgb, var(--foreground) 36%, transparent)" style={{ animation: "gcs-twinkle 4.1s ease-in-out 3.3s infinite" }} />
          <circle cx="64" cy="330" r="1.1" fill="color-mix(in srgb, var(--foreground) 13.5%, transparent)" style={{ animation: "gcs-twinkle 2.7s ease-in-out 2.6s infinite" }} />
          <circle cx="330" cy="300" r="1.2" fill="color-mix(in srgb, var(--foreground) 15.8%, transparent)" style={{ animation: "gcs-twinkle 3.6s ease-in-out 1.9s infinite" }} />
          <circle cx="196" cy="96" r="1" fill="color-mix(in srgb, var(--foreground) 13.5%, transparent)" style={{ animation: "gcs-twinkle 4.6s ease-in-out 1.2s infinite" }} />
          <circle cx="370" cy="520" r="1.2" fill="color-mix(in srgb, var(--foreground) 13.5%, transparent)" style={{ animation: "gcs-twinkle 3.9s ease-in-out 0.5s infinite" }} />
          <circle cx="18" cy="560" r="1.3" fill="color-mix(in srgb, var(--foreground) 15.8%, transparent)" style={{ animation: "gcs-twinkle 2.9s ease-in-out 3.8s infinite" }} />
        </svg>
      </div>
      <div data-k="floor" aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "calc(72svh - 1895px)", width: "390px", height: "2200px", marginInlineStart: "-195px" }}>
        <svg aria-hidden="true" width="390" height="300" viewBox="0 0 390 300" style={{ position: "absolute", insetInlineStart: "0", top: "1900px" }} fill="none" stroke="color-mix(in srgb, var(--foreground) 7%, transparent)" strokeWidth="1">
          <line x1="11.7" y1="0" x2="-293.7" y2="300" />
          <line x1="34.6" y1="0" x2="-232.6" y2="300" />
          <line x1="57.5" y1="0" x2="-171.5" y2="300" />
          <line x1="80.4" y1="0" x2="-110.4" y2="300" />
          <line x1="103.3" y1="0" x2="-49.4" y2="300" />
          <line x1="126.2" y1="0" x2="11.7" y2="300" />
          <line x1="149.1" y1="0" x2="72.8" y2="300" />
          <line x1="172.0" y1="0" x2="133.9" y2="300" />
          <line x1="194.9" y1="0" x2="195.0" y2="300" />
          <line x1="217.8" y1="0" x2="256.1" y2="300" />
          <line x1="240.7" y1="0" x2="317.2" y2="300" />
          <line x1="263.6" y1="0" x2="378.3" y2="300" />
          <line x1="286.5" y1="0" x2="439.4" y2="300" />
          <line x1="309.4" y1="0" x2="500.5" y2="300" />
          <line x1="332.3" y1="0" x2="561.6" y2="300" />
          <line x1="355.2" y1="0" x2="622.7" y2="300" />
          <line x1="378.1" y1="0" x2="683.8" y2="300" />
          <line x1="0" y1="5.0" x2="390" y2="5.0" />
          <line x1="0" y1="18.7" x2="390" y2="18.7" />
          <line x1="0" y1="40.3" x2="390" y2="40.3" />
          <line x1="0" y1="69.7" x2="390" y2="69.7" />
          <line x1="0" y1="106.4" x2="390" y2="106.4" />
          <line x1="0" y1="150.5" x2="390" y2="150.5" />
          <line x1="0" y1="201.7" x2="390" y2="201.7" />
          <line x1="0" y1="260.1" x2="390" y2="260.1" />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--foreground) 20%, transparent)" style={{ opacity: "0", "--d": "300px", animation: "gcs-floor 4.8s cubic-bezier(0.55, 0, 0.9, 0.35) -0.0s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--foreground) 20%, transparent)" style={{ opacity: "0", "--d": "300px", animation: "gcs-floor 4.8s cubic-bezier(0.55, 0, 0.9, 0.35) -1.6s infinite" } as React.CSSProperties} />
          <line x1="0" y1="0" x2="390" y2="0" stroke="color-mix(in srgb, var(--foreground) 20%, transparent)" style={{ opacity: "0", "--d": "300px", animation: "gcs-floor 4.8s cubic-bezier(0.55, 0, 0.9, 0.35) -3.2s infinite" } as React.CSSProperties} />
        </svg>
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", bottom: "0", height: "120px", background: "linear-gradient(180deg, transparent 0%, var(--background) 100%)" }} />
        <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "20px", top: "1895px", width: "350px", height: "12px", overflow: "hidden" }}>
          <div style={{ position: "absolute", insetInlineStart: "0", top: "5px", width: "350px", height: "1px", background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--foreground) 30%, transparent) 50%, transparent 100%)" }} />
          <div style={{ position: "absolute", insetInlineStart: "0", top: "4px", width: "120px", height: "3px", borderRadius: "3px", opacity: "0", background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--foreground) 50%, transparent) 50%, transparent 100%)", boxShadow: "0 0 10px 0 color-mix(in srgb, var(--foreground) 10%, transparent)", "--from": "-120px", "--to": "350px", animation: "gcs-sweep 5.5s ease-in-out infinite" } as React.CSSProperties} />
        </div>
      </div>
      <div data-k="glow" aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "760px", height: "900px", marginInlineStart: "-380px", pointerEvents: "none", transform: "translate3d(0, calc(60svh - 200px), 0)", opacity: "0.5", background: "radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--card) 95%, transparent) 0%, color-mix(in srgb, var(--card) 50%, transparent) 38%, transparent 70%)" }} />
      <div data-k="hero" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", zIndex: "5" }}>
        <div style={{ width: "390px", maxWidth: "100%", margin: "0 auto" }}>
          <div style={{ position: "relative", padding: "clamp(92px, 12.5svh, 108px) 20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "30px", padding: "0 12px 0 10px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "12px", fontWeight: "600", color: "var(--foreground)", animation: "gcs-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both" }}>
              <span style={{ position: "relative", width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)", boxShadow: "0 0 8px 1px color-mix(in srgb, var(--foreground) 18%, transparent)" }}>
                <span aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "var(--foreground)", opacity: "0", animation: "gcs-ping 2.4s ease-out 0s infinite" }} />
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M8.5 4.5L12 6l3.5-1.5 4.5 3-2.3 3.4-2.2-1.2V19.5h-7V9.7l-2.2 1.2L4 7.5l4.5-3z" /></svg>
                {t("AI try-on")}
              </span>
              <span aria-hidden="true" style={{ width: "1px", height: "14px", background: "var(--gc-inactive)" }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                  <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                </svg>
                {t("Store Chat")}
              </span>
              <span aria-hidden="true" style={{ width: "1px", height: "14px", background: "var(--gc-inactive)" }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
                {t("Shopify")}
              </span>
            </div>
            <h1 id="m-hero-title" style={{ margin: "20px 0 0", fontSize: "40px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "calc(-0.04em * var(--gc-ls, 1))", color: "var(--foreground)", animation: "gcs-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both" }}>{t("The fitting room your online store was missing.")}</h1>
            <p style={{ margin: "16px 0 0", fontSize: "16px", lineHeight: "1.6", color: "var(--muted-foreground)", animation: "gcs-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both" }}>
              {t(v.managedSetup ? "Shoppers see your clothes on themselves from one photo and get answers from your store in Arabic or English. We set it up and keep it running." : "Shoppers see your clothes on themselves from one photo and get answers from your store in Arabic or English.")}
            </p>
            <div style={{ marginTop: "26px", width: "100%", display: "flex", flexDirection: "column", gap: "10px", animation: "gcs-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both" }}>
              <Link href="/try-on" data-tryon-link="" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "54px", borderRadius: "27px", background: "var(--foreground)", color: "var(--background)", textDecoration: "none", fontSize: "15px", fontWeight: "700", boxShadow: "0 14px 34px -16px color-mix(in srgb, var(--foreground) 60%, transparent)" }} onClick={v.tryFrom('try')}>
                {t("Try it on yourself")}
                <span data-icon="inline-end" style={{ display: "inline-flex", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "gcs-nudge 2.4s ease-in-out infinite" }} data-flip="">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
              <a href={BOOKING_URL} target="_blank" onClick={v.bookFrom('try')} rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "54px", borderRadius: "27px", border: "1px solid var(--border)", background: "var(--gc-chip)", color: "var(--foreground)", textDecoration: "none", fontSize: "15px", fontWeight: "600" }}>{t("Book a call")}</a>
            </div>
          </div>
        </div>
      </div>
      <div data-k="cap" aria-hidden="true" style={{ position: "absolute", insetInlineStart: "20px", insetInlineEnd: "20px", top: "0", zIndex: "6", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", pointerEvents: "none", opacity: "0", transform: "translate3d(0, 120px, 0)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "28px", padding: "0 13px", borderRadius: "18px", border: "1px solid var(--border)", background: "color-mix(in srgb, var(--gc-chip) 90%, transparent)", fontSize: "12px", fontWeight: "700" }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>01</span>
          <span style={{ width: "1px", height: "12px", background: "var(--gc-inactive)" }} />
          {t("Try it on")}
          <span style={{ display: "inline-flex", gap: "5px", marginInlineStart: "2px" }}>
            <span data-k="dot1" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)", opacity: "0.22", transition: "opacity 0.35s ease" }} />
            <span data-k="dot2" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)", opacity: "0.22", transition: "opacity 0.35s ease" }} />
            <span data-k="dot3" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)", opacity: "0.22", transition: "opacity 0.35s ease" }} />
            <span data-k="dot4" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)", opacity: "0.22", transition: "opacity 0.35s ease" }} />
          </span>
        </span>
        <div style={{ position: "relative", marginTop: "10px", width: "100%", height: "54px" }}>
          <p data-k="cap1" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", margin: "0", fontSize: "21px", lineHeight: "1.25", fontWeight: "700", letterSpacing: "calc(-0.03em * var(--gc-ls, 1))", opacity: "0", transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>{t("Tap a garment. The same shopper wears it.")}</p>
          <p data-k="cap2" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", margin: "0", fontSize: "21px", lineHeight: "1.25", fontWeight: "700", letterSpacing: "calc(-0.03em * var(--gc-ls, 1))", opacity: "0", transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>{t("Compare it with the photo she started from.")}</p>
          <p data-k="cap3" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", margin: "0", fontSize: "21px", lineHeight: "1.25", fontWeight: "700", letterSpacing: "calc(-0.03em * var(--gc-ls, 1))", opacity: "0", transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>{t("Switch shoppers. Everyone sees it on themselves.")}</p>
          <p data-k="cap4" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", margin: "0", fontSize: "21px", lineHeight: "1.25", fontWeight: "700", letterSpacing: "calc(-0.03em * var(--gc-ls, 1))", opacity: "0", transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>{t("Your turn. Pick a shopper and a garment.")}</p>
        </div>
      </div>
      <div data-k="stage" style={{ position: "absolute", insetInlineStart: "50%", top: "0", zIndex: "4", width: "350px", marginInlineStart: "-175px", transformOrigin: "50% 0%", transform: "translate3d(0, 62svh, 0) perspective(1100px) rotateX(22deg) scale(0.92)", willChange: "transform" }}>
        <section aria-label={t("Try-on demo")} style={{ boxSizing: "border-box", borderRadius: "24px", border: "1px solid var(--border)", background: "color-mix(in srgb, var(--card) 94%, transparent)", boxShadow: "0 44px 90px -44px color-mix(in srgb, var(--foreground) 50%, transparent), 0 2px 6px color-mix(in srgb, var(--foreground) 5%, transparent)", display: "flex", flexDirection: "column", gap: "14px", minWidth: "0", padding: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button type="button" onPointerEnter={v.peekIn} onPointerLeave={v.peekOut} onClick={v.peekTap} aria-pressed={v.peekOn} aria-label={t("Show the shopper photo this look was made from")} style={{ position: "relative", display: "block", flexShrink: "0", width: "324px", height: "405px", padding: "0", border: "0", borderRadius: "16px", overflow: "hidden", background: "var(--secondary)", cursor: "pointer", boxShadow: "0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent), 0 24px 44px -26px color-mix(in srgb, var(--foreground) 55%, transparent)" }} data-ptr="photo">
              <StoryImg hero="phone" src="/landing/v15/woman-linen-shirt.webp" w={922} h={1152} alt={t("Try-on image: sage linen shirt on the first shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l0Z, clipPath: `inset(0 0 ${v.l0Clip} 0)`, transition: v.l0Tr }} />
              <StoryImg src="/landing/v15/woman-abaya.webp" w={922} h={1152} alt={t("Try-on image: embroidered abaya on the first shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l1Z, clipPath: `inset(0 0 ${v.l1Clip} 0)`, transition: v.l1Tr }} />
              <StoryImg src="/landing/v15/man-denim-overshirt.webp" w={922} h={1152} alt={t("Try-on image: denim overshirt on the second shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l2Z, clipPath: `inset(0 0 ${v.l2Clip} 0)`, transition: v.l2Tr }} />
              <StoryImg src="/landing/v15/man-knit-polo.webp" w={922} h={1152} alt={t("Try-on image: knit polo on the second shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l3Z, clipPath: `inset(0 0 ${v.l3Clip} 0)`, transition: v.l3Tr }} />
              <StoryImg src="/landing/v15/w1-shirt.webp" w={768} h={1024} alt={t("Try-on image: sage linen shirt on the third shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l4Z, clipPath: `inset(0 0 ${v.l4Clip} 0)`, transition: v.l4Tr }} />
              <StoryImg src="/landing/v15/w1-skirt.webp" w={768} h={1024} alt={t("Try-on image: satin midi skirt on the third shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l5Z, clipPath: `inset(0 0 ${v.l5Clip} 0)`, transition: v.l5Tr }} />
              <StoryImg src="/landing/v15/m1-denim.webp" w={768} h={1024} alt={t("Try-on image: denim shirt on the fourth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l6Z, clipPath: `inset(0 0 ${v.l6Clip} 0)`, transition: v.l6Tr }} />
              <StoryImg src="/landing/v15/m1-polo.webp" w={768} h={1024} alt={t("Try-on image: knit polo on the fourth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l7Z, clipPath: `inset(0 0 ${v.l7Clip} 0)`, transition: v.l7Tr }} />
              <StoryImg src="/landing/v15/g-dress.webp" w={768} h={1024} alt={t("Try-on image: floral tiered dress on the fifth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l8Z, clipPath: `inset(0 0 ${v.l8Clip} 0)`, transition: v.l8Tr }} />
              <StoryImg src="/landing/v15/g-jeans.webp" w={768} h={1024} alt={t("Try-on image: straight jeans on the fifth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l9Z, clipPath: `inset(0 0 ${v.l9Clip} 0)`, transition: v.l9Tr }} />
              <StoryImg src="/landing/v15/b-denim.webp" w={768} h={1024} alt={t("Try-on image: denim shirt on the sixth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l10Z, clipPath: `inset(0 0 ${v.l10Clip} 0)`, transition: v.l10Tr }} />
              <StoryImg src="/landing/v15/b-sweat.webp" w={768} h={1024} alt={t("Try-on image: crew sweatshirt on the sixth shopper.")} sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: v.l11Z, clipPath: `inset(0 0 ${v.l11Clip} 0)`, transition: v.l11Tr }} />
              <StoryImg src="/landing/v15/shopper-woman.webp" w={768} h={960} alt="" sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: "5", opacity: v.p0Op, clipPath: `inset(0 0 ${v.peekClip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <StoryImg src="/landing/v15/shopper-man.webp" w={768} h={960} alt="" sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: "5", opacity: v.p1Op, clipPath: `inset(0 0 ${v.peekClip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <StoryImg src="/landing/v15/m1-photo.webp" w={768} h={1024} alt="" sizes="324px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 16%", display: "block", zIndex: "5", opacity: v.p2Op, clipPath: `inset(0 0 ${v.peekClip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "6", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.swapSweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "7", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.peekSweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "8", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {v.chipAi ? (
                  <>
                    {t("AI render")}
                  </>
                ) : null}
                {v.chipHer ? (
                  <>
                    {t("Her photo")}
                  </>
                ) : null}
                {v.chipHis ? (
                  <>
                    {t("His photo")}
                  </>
                ) : null}
              </span>
              <span style={{ position: "absolute", zIndex: "8", insetInlineStart: "10px", insetInlineEnd: "10px", bottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: "28px", padding: "0 11px", borderRadius: "28px", background: "color-mix(in srgb, var(--background) 94%, transparent)", color: "var(--foreground)", fontSize: "12px", fontWeight: "700" }}>{v.lookName}</span>
                {v.canCompare ? (
                  <>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "28px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", color: "var(--background)", fontSize: "11px", fontWeight: "700" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v18" />
                        <path d="M8 7l-4 5 4 5" />
                        <path d="M16 7l4 5-4 5" />
                      </svg>
                      {t("Tap to compare")}
                    </span>
                  </>
                ) : null}
              </span>
            </button>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--gc-text-2)" }}>{t("Pick a shopper")}</span>
            <div role="group" aria-label={t("Pick a shopper")} style={{ display: "flex", gap: "6px", padding: "4px" }}>
              <button type="button" onClick={v.pickS0} aria-pressed={v.s0On} aria-label={t("Show the first shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s0Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s0Op }}>
                <StoryImg src="/landing/v15/face-salma.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <button type="button" onClick={v.pickS1} aria-pressed={v.s1On} aria-label={t("Show the second shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s1Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s1Op }} data-ptr="shopper2">
                <StoryImg src="/landing/v15/face-man2.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <button type="button" onClick={v.pickS2} aria-pressed={v.s2On} aria-label={t("Show the third shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s2Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s2Op }}>
                <StoryImg src="/landing/v15/face-w1.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <button type="button" onClick={v.pickS3} aria-pressed={v.s3On} aria-label={t("Show the fourth shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s3Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s3Op }}>
                <StoryImg src="/landing/v15/face-m1.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <button type="button" onClick={v.pickS4} aria-pressed={v.s4On} aria-label={t("Show the fifth shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s4Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s4Op }}>
                <StoryImg src="/landing/v15/face-g.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <button type="button" onClick={v.pickS5} aria-pressed={v.s5On} aria-label={t("Show the sixth shopper")} style={{ flexShrink: "0", width: "40px", height: "40px", padding: "0", border: "0", borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "var(--secondary)", boxShadow: v.s5Ring, transition: "box-shadow 0.2s ease, opacity 0.2s ease", opacity: v.s5Op }}>
                <StoryImg src="/landing/v15/face-b.webp" w={160} h={160} alt="" sizes="40px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            </div>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--gc-text-2)" }}>{t("Pick a garment")}</span>
            {v.sh0 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL0} aria-pressed={v.l0On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l0Border}`, background: v.l0Bg, boxShadow: v.l0Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--card)" }}>
                      <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Sage linen shirt")}</span>
                    {v.l0Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL1} aria-pressed={v.l1On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l1Border}`, background: v.l1Bg, boxShadow: v.l1Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--card)" }}>
                      <StoryImg src="/landing/v15/garment-abaya.webp" w={768} h={960} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Embroidered abaya")}</span>
                    {v.l1Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
            {v.sh1 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL2} aria-pressed={v.l2On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l2Border}`, background: v.l2Bg, boxShadow: v.l2Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--card)" }}>
                      <StoryImg src="/landing/v15/garment-denim-overshirt.webp" w={768} h={960} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Denim overshirt")}</span>
                    {v.l2Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL3} aria-pressed={v.l3On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l3Border}`, background: v.l3Bg, boxShadow: v.l3Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--card)" }}>
                      <StoryImg src="/landing/v15/garment-knit-polo.webp" w={768} h={960} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Knit polo")}</span>
                    {v.l3Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
            {v.sh2 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL4} aria-pressed={v.l4On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l4Border}`, background: v.l4Bg, boxShadow: v.l4Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-w1-shirt.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Sage linen shirt")}</span>
                    {v.l4Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL5} aria-pressed={v.l5On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l5Border}`, background: v.l5Bg, boxShadow: v.l5Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile-w1-skirt.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Satin midi skirt")}</span>
                    {v.l5Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
            {v.sh3 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL6} aria-pressed={v.l6On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l6Border}`, background: v.l6Bg, boxShadow: v.l6Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-m1-denim.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Denim shirt")}</span>
                    {v.l6Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL7} aria-pressed={v.l7On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l7Border}`, background: v.l7Bg, boxShadow: v.l7Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-m1-polo.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Knit polo")}</span>
                    {v.l7Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
            {v.sh4 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL8} aria-pressed={v.l8On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l8Border}`, background: v.l8Bg, boxShadow: v.l8Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-g-dress.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Floral tiered dress")}</span>
                    {v.l8Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL9} aria-pressed={v.l9On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l9Border}`, background: v.l9Bg, boxShadow: v.l9Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile-g-jeans.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Straight jeans")}</span>
                    {v.l9Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
            {v.sh5 ? (
              <>
                <div role="group" aria-label={t("Pick a garment")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }} data-ptr="garments">
                  <button type="button" onClick={v.pickL10} aria-pressed={v.l10On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l10Border}`, background: v.l10Bg, boxShadow: v.l10Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-b-denim.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Denim shirt")}</span>
                    {v.l10Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={v.pickL11} aria-pressed={v.l11On} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "5px", borderRadius: "14px", border: `1px solid ${v.l11Border}`, background: v.l11Bg, boxShadow: v.l11Shadow, cursor: "pointer", textAlign: "start", color: "var(--foreground)", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                    <span style={{ display: "block", height: "150px", borderRadius: "10px", overflow: "hidden", background: "var(--secondary)" }}>
                      <StoryImg src="/landing/v15/tile2-b-sweat.webp" w={320} h={400} alt="" sizes="350px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }} />
                    </span>
                    <span style={{ padding: "0 4px 2px", fontSize: "12px", fontWeight: "700", lineHeight: "1.3" }}>{t("Crew sweatshirt")}</span>
                    {v.l11Invite ? (
                      <>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "14px", border: "1px solid var(--foreground)", animation: "gcs-invite 1.6s ease-out infinite" }} />
                      </>
                    ) : null}
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <p style={{ margin: "0", fontSize: "11.5px", color: "var(--muted-foreground)" }}>{t("Try-on images on AI-generated models.")}</p>
        </section>
        <div data-k="sheen" aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "30", pointerEvents: "none", borderRadius: "24px", overflow: "hidden", opacity: "0" }}>
          <span data-k="sheenBand" style={{ position: "absolute", top: "-30%", bottom: "-30%", insetInlineStart: "0", width: "44%", transform: "translate3d(-120%, 0, 0) skewX(-16deg)", background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--card) 42%, transparent) 50%, transparent 100%)" }} />
        </div>
        <span data-k="ptr" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", zIndex: "40", width: "0", height: "0", pointerEvents: "none", opacity: "0", transform: "translate3d(0px, 0px, 0)", transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease" }}>
          <span data-k="ptrIn" style={{ position: "absolute", insetInlineStart: "-14px", top: "-14px", width: "28px", height: "28px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--foreground)", background: "color-mix(in srgb, var(--foreground) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--background) 92%, transparent), 0 8px 18px -6px color-mix(in srgb, var(--foreground) 55%, transparent)", transform: "scale(1)", transition: "transform 0.16s ease" }}>
            <span data-k="ptrRing" style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--foreground)", opacity: "0", animationName: "none", animationDuration: "0.7s", animationTimingFunction: "ease-out", animationFillMode: "both" }} />
          </span>
        </span>
      </div>
      <p style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}>
        {t("How the try-on demo plays as you scroll: Tap a garment. The same shopper wears it. Compare it with the photo she started from. Switch shoppers. Everyone sees it on themselves. Your turn. Pick a shopper and a garment.")}
      </p>
    </>
  );
}
