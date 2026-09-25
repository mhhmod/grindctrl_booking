/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function DeskJourney({ v, t }: ViewProps) {
  return (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", height: "28px", padding: "0 12px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "12px", fontWeight: "600" }}>{t("How it works")}</span>
      <h2 id="journey-title" style={{ margin: "18px 0 0", fontSize: "50px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("From try-on to your team")}</h2>
      <p style={{ margin: "14px 0 0", fontSize: "18px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("Follow one shopper through GrindCTRL. Real product screens, shown with demo data.")}</p>
      <div style={{ marginTop: "48px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "24px" }}>
        <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 30px 60px -44px color-mix(in srgb, var(--foreground) 28%, transparent)" }}>
          <div style={{ position: "relative", height: "210px", overflow: "hidden", background: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: "0", background: "radial-gradient(70% 80% at 50% 100%, color-mix(in srgb, var(--background) 13%, transparent) 0%, transparent 70%)" }} />
            <div style={{ position: "relative", width: "116px", height: "146px", borderRadius: "12px", overflow: "hidden", transform: "rotate(-4deg)", "--r": "-4deg", "--y": "-8px", animation: "gcs-float 6s ease-in-out infinite", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 18%, transparent), 0 20px 40px -20px color-mix(in srgb, var(--foreground) 90%, transparent)" } as React.CSSProperties}>
              <StoryImg src="/landing/v15/woman-linen-shirt.webp" w={922} h={1152} alt="" sizes="116px" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%", display: "block" }} />
            </div>
            <div style={{ position: "relative", marginInlineStart: "-18px", marginTop: "60px", width: "86px", height: "108px", borderRadius: "10px", overflow: "hidden", background: "var(--background)", transform: "rotate(5deg)", "--r": "5deg", "--y": "-8px", animation: "gcs-float 6s ease-in-out -3s infinite", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 18%, transparent), 0 20px 40px -20px color-mix(in srgb, var(--foreground) 90%, transparent)" } as React.CSSProperties}>
              <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="86px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          </div>
          <div style={{ padding: "22px 24px 24px" }}>
            <h3 style={{ margin: "0", minHeight: "50px", fontSize: "19px", lineHeight: "1.3", fontWeight: "700", letterSpacing: "calc(-0.015em * var(--gc-ls, 1))" }}>{t("Salma tries the linen shirt on")}</h3>
            <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--muted-foreground)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 3.5L4 6l1.8 4 2.2-.9V20.5h8V9.1l2.2.9L20 6l-4.5-2.5c-.7 1.3-2 2.1-3.5 2.1s-2.8-.8-3.5-2.1z" /></svg>
                {t("Try-on")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)" }} />
                {t("Live")}
              </span>
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("One photo, any product page with the try-on block.")}</p>
          </div>
        </article>
        <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 30px 60px -44px color-mix(in srgb, var(--foreground) 28%, transparent)" }}>
          <div style={{ position: "relative", height: "210px", overflow: "hidden", background: "var(--foreground)", boxSizing: "border-box", padding: "26px 34px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "9px", fontSize: "12.5px", lineHeight: "1.45" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: "0", background: "radial-gradient(70% 80% at 50% 100%, color-mix(in srgb, var(--background) 13%, transparent) 0%, transparent 70%)" }} />
            <p style={{ position: "relative", margin: "0", alignSelf: "flex-end", maxWidth: "230px", padding: "9px 12px", borderRadius: "14px 14px 5px 14px", background: "var(--background)", color: "var(--foreground)", animation: "gcs-msg 9s ease-out -6s infinite" }}>{t("Does the sage linen shirt run true to size?")}</p>
            <p style={{ position: "relative", margin: "0", alignSelf: "flex-start", maxWidth: "250px", padding: "9px 12px", borderRadius: "14px 14px 14px 5px", background: "color-mix(in srgb, var(--background) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--background) 16%, transparent)", color: "var(--background)", animation: "gcs-msg 9s ease-out -4.8s infinite" }}>{t("It's cut oversized, so M already sits relaxed and L gives a longer, looser fit.")}</p>
          </div>
          <div style={{ padding: "22px 24px 24px" }}>
            <h3 style={{ margin: "0", minHeight: "50px", fontSize: "19px", lineHeight: "1.3", fontWeight: "700", letterSpacing: "calc(-0.015em * var(--gc-ls, 1))" }}>{t("She asks about size. The assistant answers.")}</h3>
            <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--muted-foreground)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                </svg>
                {t("Store Chat")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)" }} />
                {t("Live")}
              </span>
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("Replies are grounded in the knowledge you add.")}</p>
          </div>
        </article>
        <article style={{ borderRadius: "20px", overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 30px 60px -44px color-mix(in srgb, var(--foreground) 28%, transparent)" }}>
          <div style={{ position: "relative", height: "210px", overflow: "hidden", background: "var(--foreground)", boxSizing: "border-box", padding: "0 36px", display: "flex", alignItems: "center" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: "0", background: "radial-gradient(70% 80% at 50% 100%, color-mix(in srgb, var(--background) 13%, transparent) 0%, transparent 70%)" }} />
            <div style={{ position: "relative", width: "100%", boxSizing: "border-box", padding: "16px", borderRadius: "14px", background: "color-mix(in srgb, var(--background) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--background) 16%, transparent)", color: "var(--background)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ position: "relative", width: "28px", height: "28px", borderRadius: "50%", background: "var(--background)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800" }}>
                  {t("S")}
                  <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "50%", border: "1.5px solid color-mix(in srgb, var(--background) 60%, transparent)", opacity: "0", animation: "gcs-halo 2.6s ease-out infinite" }} />
                </span>
                <span style={{ flexGrow: "1", fontSize: "14px", fontWeight: "700" }}>{t("Salma")}</span>
                <span style={{ fontSize: "11px", color: "var(--gc-inactive)" }}>{t("3h ago")}</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "12.5px" }}>{t("Yes please, is M in stock in sage?")}</p>
              <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "26px", background: "var(--background)", color: "var(--foreground)", fontSize: "11px", fontWeight: "700" }}>{t("Needs a reply")}</span>
                <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--background) 30%, transparent)", fontSize: "11px", fontWeight: "600" }}>{t("Assigned to Omar")}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: "22px 24px 24px" }}>
            <h3 style={{ margin: "0", minHeight: "50px", fontSize: "19px", lineHeight: "1.3", fontWeight: "700", letterSpacing: "calc(-0.015em * var(--gc-ls, 1))" }}>{t("Handed to Omar with a private note")}</h3>
            <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--muted-foreground)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 13.5l2.5-8h12l2.5 8M3.5 13.5v5h17v-5M3.5 13.5h5l1 2h5l1-2h5" /></svg>
                {t("Team inbox")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)" }} />
                {t("Live")}
              </span>
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("Handoffs, assignment, private notes and saved replies for your team.")}</p>
          </div>
        </article>
      </div>
      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <a href="#store" onClick={v.goStore} style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "50px", padding: "0 24px", borderRadius: "26px", background: "var(--foreground)", color: "var(--background)", textDecoration: "none", fontSize: "15px", fontWeight: "700" }}>
          {t("See it working")}
          <span data-icon="inline-end" style={{ display: "inline-flex", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "gcs-nudge 2.4s ease-in-out infinite" }} data-flip="">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </a>
      </div>
    </>
  );
}
