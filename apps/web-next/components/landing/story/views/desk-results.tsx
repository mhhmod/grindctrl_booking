/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import Link from 'next/link';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function DeskResults({ v, t }: ViewProps) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "-30svh", width: "140vw", height: "90svh", marginInlineStart: "-70vw", background: "radial-gradient(closest-side, color-mix(in srgb, var(--card) 72%, transparent), transparent)", pointerEvents: "none" }} />
      <div data-k="chead" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", textAlign: "center", transform: "translate3d(0, 96px, 0)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "28px", padding: "0 12px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "12px", fontWeight: "600" }}>
          <span style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>05</span>
          <span style={{ width: "1px", height: "11px", background: "var(--gc-inactive)" }} />
          {t("Real results")}
        </span>
        <h2 id="results-title" style={{ margin: "14px 0 0", fontSize: "48px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("Same shopper, every garment")}</h2>
        <p style={{ margin: "12px auto 0", maxWidth: "700px", fontSize: "17px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("Each shopper, then the same shopper in another garment. Tap a look to switch it.")}</p>
      </div>
      <div data-k="counter" aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", top: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", transform: "translate3d(0, 250px, 0)", fontSize: "12.5px", fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--foreground)" }}>
        <span>{v.resNum}</span>
        <span style={{ position: "relative", display: "block", width: "150px", height: "2px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
          <span data-k="cfill" style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: "scaleX(0)" }} />
        </span>
        <span style={{ color: "var(--muted-foreground)" }}>08</span>
      </div>
      <div data-k="track" role="group" aria-label={t("Try-on results")} style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "0", height: "0", perspective: "1600px", transform: "translate3d(0, 560px, 0)" }}>
        <div data-k="card0" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "30", opacity: "1", transform: "translate3d(0px, 0, 0) scale(1.16)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo0} aria-pressed={v.c0On} aria-label={t("Show the same shopper in embroidered abaya")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/woman-linen-shirt.webp" w={922} h={1152} alt={t("Try-on image: sage linen shirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 0.0s infinite" }} />
              <StoryImg src="/landing/v15/woman-abaya.webp" w={922} h={1152} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c0Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c0Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c0AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/garment-abaya.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c0BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c0A ? (
                  <>
                    {t("Sage linen shirt")}
                  </>
                ) : null}
                {v.c0B ? (
                  <>
                    {t("Embroidered abaya")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Womenswear")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card1" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "26", opacity: "0.92", transform: "translate3d(338px, 0, 0) scale(0.9)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo1} aria-pressed={v.c1On} aria-label={t("Show the same shopper in knit polo")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/man-denim-overshirt.webp" w={922} h={1152} alt={t("Try-on image: denim overshirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 0.7s infinite" }} />
              <StoryImg src="/landing/v15/man-knit-polo.webp" w={922} h={1152} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c1Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c1Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/garment-denim-overshirt.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c1AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/garment-knit-polo.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c1BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c1A ? (
                  <>
                    {t("Denim overshirt")}
                  </>
                ) : null}
                {v.c1B ? (
                  <>
                    {t("Knit polo")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Menswear")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card2" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "22", opacity: "0.5", transform: "translate3d(612px, 0, 0) scale(0.78)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo2} aria-pressed={v.c2On} aria-label={t("Show the same shopper in satin midi skirt")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/w1-shirt.webp" w={768} h={1024} alt={t("Try-on image: sage linen shirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 1.4s infinite" }} />
              <StoryImg src="/landing/v15/w1-skirt.webp" w={768} h={1024} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c2Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c2Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/tile2-w1-shirt.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c2AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/tile-w1-skirt.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c2BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c2A ? (
                  <>
                    {t("Sage linen shirt")}
                  </>
                ) : null}
                {v.c2B ? (
                  <>
                    {t("Satin midi skirt")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Womenswear")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card3" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "18", opacity: "0", transform: "translate3d(860px, 0, 0) scale(0.7)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo3} aria-pressed={v.c3On} aria-label={t("Show the same shopper in knit polo")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/m1-denim.webp" w={768} h={1024} alt={t("Try-on image: denim shirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 2.1s infinite" }} />
              <StoryImg src="/landing/v15/m1-polo.webp" w={768} h={1024} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c3Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c3Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/tile2-m1-denim.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c3AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/tile2-m1-polo.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c3BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c3A ? (
                  <>
                    {t("Denim shirt")}
                  </>
                ) : null}
                {v.c3B ? (
                  <>
                    {t("Knit polo")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Menswear")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card4" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "14", opacity: "0", transform: "translate3d(860px, 0, 0) scale(0.7)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo4} aria-pressed={v.c4On} aria-label={t("Show the same shopper in straight jeans")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/g-dress.webp" w={768} h={1024} alt={t("Try-on image: floral tiered dress.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 0.35s infinite" }} />
              <StoryImg src="/landing/v15/g-jeans.webp" w={768} h={1024} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c4Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c4Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/tile2-g-dress.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c4AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/tile-g-jeans.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c4BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c4A ? (
                  <>
                    {t("Floral tiered dress")}
                  </>
                ) : null}
                {v.c4B ? (
                  <>
                    {t("Straight jeans")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Girls")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card5" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "10", opacity: "0", transform: "translate3d(860px, 0, 0) scale(0.7)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo5} aria-pressed={v.c5On} aria-label={t("Show the same shopper in crew sweatshirt")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/b-denim.webp" w={768} h={1024} alt={t("Try-on image: denim shirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 1.05s infinite" }} />
              <StoryImg src="/landing/v15/b-sweat.webp" w={768} h={1024} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c5Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c5Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/tile2-b-denim.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c5AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/tile2-b-sweat.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c5BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c5A ? (
                  <>
                    {t("Denim shirt")}
                  </>
                ) : null}
                {v.c5B ? (
                  <>
                    {t("Crew sweatshirt")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Boys")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card6" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "6", opacity: "0", transform: "translate3d(860px, 0, 0) scale(0.7)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo6} aria-pressed={v.c6On} aria-label={t("Show another shopper in the same skirt")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/w3-skirt.webp" w={768} h={1024} alt={t("Try-on image: satin midi skirt.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 1.75s infinite" }} />
              <StoryImg src="/landing/v15/w1-skirt.webp" w={768} h={1024} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c6Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c6Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {t("Try-on")}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/tile-w1-skirt.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c6AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/tile-w1-skirt.webp" w={320} h={400} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "cover", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c6BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c6A ? (
                  <>
                    {t("Satin midi skirt")}
                  </>
                ) : null}
                {v.c6B ? (
                  <>
                    {t("Satin midi skirt")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Same skirt, two shoppers")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
        <div data-k="card7" style={{ position: "absolute", insetInlineStart: "-150px", top: "-225px", width: "300px", zIndex: "2", opacity: "0", transform: "translate3d(860px, 0, 0) scale(0.7)", transformOrigin: "50% 50%", willChange: "transform", transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease" }}>
          <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 40px 70px -40px color-mix(in srgb, var(--foreground) 42%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
            <button type="button" onClick={v.cGo7} aria-pressed={v.c7On} aria-label={t("Show the same shopper in sage linen shirt")} style={{ position: "relative", display: "block", width: "100%", height: "330px", padding: "0", border: "0", overflow: "hidden", background: "var(--secondary)", cursor: "pointer" }}>
              <StoryImg src="/landing/v15/shopper-woman.webp" w={768} h={960} alt={t("Shopper photo.")} sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "1", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 55%, color-mix(in srgb, var(--background) 50%, transparent) 100%)", borderBottom: "2px solid var(--background)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 22%, transparent), 0 10px 26px -4px color-mix(in srgb, var(--background) 85%, transparent)", animation: "gcs-scan-seq 8s cubic-bezier(0.4, 0, 0.2, 1) 2.45s infinite" }} />
              <StoryImg src="/landing/v15/woman-linen-shirt.webp" w={922} h={1152} alt="" sizes="300px" style={{ position: "absolute", inset: "0", zIndex: "3", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%", display: "block", clipPath: `inset(0 0 ${v.c7Clip} 0)`, transition: "clip-path 0.7s cubic-bezier(0.65, 0, 0.35, 1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.c7Sweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
              <span style={{ position: "absolute", zIndex: "5", top: "10px", insetInlineStart: "10px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                </svg>
                {v.c7A ? (
                  <>
                    {t("Her photo")}
                  </>
                ) : null}
                {v.c7B ? (
                  <>
                    {t("Try-on")}
                  </>
                ) : null}
              </span>
              <span style={{ position: "absolute", zIndex: "5", insetInlineEnd: "10px", bottom: "10px", width: "52px", height: "65px", borderRadius: "10px", background: "var(--card)", boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c7AOp, transition: "opacity 0.4s ease" }} />
                <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="52px" style={{ position: "absolute", inset: "3px", width: "calc(100% - 6px)", height: "calc(100% - 6px)", objectFit: "contain", objectPosition: "50% 30%", display: "block", borderRadius: "7px", opacity: v.c7BOp, transition: "opacity 0.4s ease" }} />
              </span>
            </button>
            <div style={{ padding: "16px 18px 18px" }}>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                {v.c7A ? (
                  <>
                    {t("Her photo")}
                  </>
                ) : null}
                {v.c7B ? (
                  <>
                    {t("Sage linen shirt")}
                  </>
                ) : null}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--muted-foreground)" }}>{t("Photo, then try-on")}</p>
              <Link href="/try-on" data-tryon-link="" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: "700", color: "var(--foreground)", textDecoration: "none" }} onClick={v.tryFrom('results')}>
                {t("Try it with your photo")}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 1.5l4 3.5-4 3.5z" /></svg>
              </Link>
            </div>
          </article>
        </div>
      </div>
      <p style={{ position: "absolute", insetInlineStart: "0", insetInlineEnd: "0", bottom: "18px", margin: "0", textAlign: "center", fontSize: "12.5px", color: "var(--muted-foreground)" }}>{t("Try-on images on AI-generated models.")}</p>
    </>
  );
}
