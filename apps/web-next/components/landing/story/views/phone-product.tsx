/* Generated from the v15 prototype's markup (design/prototype/boards/
   Scroll.dc.html in the site-v15 handoff bundle, whose notes are in
   apps/web-next/docs/handoff/site-v15). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function PhoneProduct({ v, t }: ViewProps) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "-30svh", width: "140vw", height: "90svh", marginInlineStart: "-70vw", background: "radial-gradient(closest-side, color-mix(in srgb, var(--card) 72%, transparent), transparent)", pointerEvents: "none" }} />
      <div data-k="bblock" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "350px", marginInlineStart: "-175px", transformOrigin: "50% 0", transform: "translate3d(0, 80px, 0)" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "26px", padding: "0 11px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "11.5px", fontWeight: "600" }}>
            <span style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>04</span>
            <span style={{ width: "1px", height: "11px", background: "var(--gc-inactive)" }} />
            {t("The product")}
          </span>
          <h2 id="m-product-title" style={{ margin: "14px 0 0", fontSize: "32px", lineHeight: "1.12", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("One system, five connected parts")}</h2>
        </div>
        <div style={{ position: "relative", marginTop: "18px", boxSizing: "border-box", padding: "16px", borderRadius: "22px", overflow: "hidden", background: "var(--foreground)", color: "var(--background)" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: "0", background: "radial-gradient(70% 60% at 60% 45%, color-mix(in srgb, var(--background) 8%, transparent) 0%, transparent 70%)" }} />
          <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "120px", top: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--background) 8%, transparent), transparent)", "--dx": "-50px", "--dy": "40px", animation: "gcs-drift 22s ease-in-out infinite" } as React.CSSProperties} />
          <div style={{ position: "relative", height: "458px" }}>
            <div aria-hidden={v.pane0Hide} style={{ position: "absolute", inset: "0", boxSizing: "border-box", padding: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", opacity: v.pane0Op, transform: `translateY(${v.pane0Y})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: v.pane0Pe }}>
              <div role="img" aria-label={t("Animated demo: on a product page a shopper taps Try it on with AI, adds her photo, generates a try-on preview of the shirt on herself and adds it to her cart.")} style={{ position: "relative", boxSizing: "border-box", borderRadius: "16px", background: "var(--card)", color: "var(--foreground)", overflow: "hidden", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 12%, transparent), 0 30px 60px -30px color-mix(in srgb, var(--foreground) 85%, transparent)", textAlign: "start", width: "318px", height: "430px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "40px", padding: "0 16px", borderBottom: "1px solid var(--secondary)" }}>
                  <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: "calc(0.14em * var(--gc-ls, 1))" }}>{t("GRINDCTRL DEMO STORE")}</span>
                  <span style={{ position: "relative", display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 8h14l-1 12H6L5 8z" />
                      <path d="M9 8V6.5a3 3 0 016 0V8" strokeLinecap="round" />
                    </svg>
                    <span style={{ position: "absolute", top: "-6px", insetInlineEnd: "-8px", width: "16px", height: "16px", borderRadius: "8px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", opacity: v.sfCart, transform: `scale(${v.sfCartS})`, transition: "opacity 0.3s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>1</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: "14px", padding: "12px 14px" }}>
                  <div style={{ width: "112px", height: "142px", flexShrink: "0", borderRadius: "12px", overflow: "hidden", background: "var(--card)" }}>
                    <StoryImg src="/landing/v15/garment-linen-shirt.webp" w={768} h={960} alt="" sizes="112px" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px", minWidth: "0", flexGrow: "1" }}>
                    <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.2" }}>{t("Sage linen shirt")}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gc-text-2)" }}>{t("Size")}</span>
                      <span style={{ display: "flex", gap: "5px" }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "26px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", border: "1px solid var(--border)" }}>{t("S")}</span>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "26px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", background: "var(--foreground)", color: "var(--background)" }}>{t("M")}</span>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "26px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", border: "1px solid var(--border)" }}>{t("L")}</span>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "26px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", border: "1px solid var(--border)" }}>{t("XL")}</span>
                      </span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "34px", borderRadius: "17px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", background: "var(--foreground)", color: "var(--background)" }}>{t("Add to cart")}</span>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "34px", borderRadius: "17px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", border: "1px solid var(--foreground)", background: v.sfTryBg, transform: `scale(${v.sfTryS})`, transition: "background-color 0.25s ease, transform 0.2s ease" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--foreground)" />
                      </svg>
                      {t("Try it on with AI")}
                    </span>
                  </div>
                </div>
                <div style={{ position: "absolute", zIndex: "10", insetInlineStart: "10px", insetInlineEnd: "10px", top: "48px", bottom: "10px", boxSizing: "border-box", padding: "13px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--background)", boxShadow: "0 24px 50px -28px color-mix(in srgb, var(--foreground) 55%, transparent)", display: "flex", flexDirection: "column", gap: "8px", clipPath: v.sfClip, opacity: v.sfEmbedOp, transition: v.sfEmbedTr }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px", fontWeight: "700", color: "var(--muted-foreground)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--muted-foreground)" />
                    </svg>
                    {t("Try it on with AI")}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>
                    {v.sfT1 ? (
                      <>
                        {t("Upload your photo")}
                      </>
                    ) : null}
                    {v.sfT2 ? (
                      <>
                        {t("Your photo is ready")}
                      </>
                    ) : null}
                    {v.sfT3 ? (
                      <>
                        {t("Creating your preview")}
                      </>
                    ) : null}
                    {v.sfT4 ? (
                      <>
                        {t("Try-On Preview")}
                      </>
                    ) : null}
                  </span>
                  <div style={{ position: "relative", flexShrink: "0", height: "176px", boxSizing: "border-box", borderRadius: "12px", overflow: "hidden", background: "var(--card)", border: `1.5px dashed ${v.sfBoxLine}`, transition: "border-color 0.3s ease" }}>
                    <span style={{ position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", padding: "0 14px", color: "var(--muted-foreground)", textAlign: "center" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 15V4" />
                        <path d="M7.5 8.5L12 4l4.5 4.5" />
                        <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
                      </svg>
                      <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--foreground)" }}>{t("Drag and drop your photo here")}</span>
                      <span style={{ fontSize: "10.5px" }}>{t("or click to browse · JPG, PNG, WebP")}</span>
                    </span>
                    <StoryImg src="/landing/v15/shopper-woman.webp" w={768} h={960} alt="" sizes="318px" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%", display: "block", opacity: v.sfPhotoOp, transform: `scale(${v.sfPhotoS})`, transition: "opacity 0.4s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                    <StoryImg src="/landing/v15/woman-linen-shirt.webp" w={922} h={1152} alt="" sizes="318px" style={{ position: "absolute", inset: "0", zIndex: "2", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%", display: "block", clipPath: `inset(0 0 ${v.sfResClip} 0)`, transition: v.sfResTr }} />
                    <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "3", opacity: "0", pointerEvents: "none", background: "linear-gradient(180deg, transparent 0%, transparent 60%, color-mix(in srgb, var(--background) 35%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", animation: `${v.sfScanAnim} 1.5s ease-in-out infinite` }} />
                    <span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "4", pointerEvents: "none", opacity: "0", background: "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--background) 30%, transparent) 100%)", borderBottom: "2px solid color-mix(in srgb, var(--background) 95%, transparent)", boxShadow: "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent), 0 10px 22px -6px color-mix(in srgb, var(--background) 75%, transparent)", animation: `${v.sfSweep} 0.95s cubic-bezier(0.65, 0, 0.35, 1) both` }} />
                    {v.sfLoad ? (
                      <>
                        <span style={{ position: "absolute", zIndex: "5", insetInlineStart: "8px", bottom: "8px", display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 10px 0 8px", borderRadius: "26px", background: "color-mix(in srgb, var(--foreground) 74%, transparent)", fontSize: "11.5px", fontWeight: "700", color: "var(--background)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                          </svg>
                          {v.sfL1 ? (
                            <>
                              {t("Mapping product to your photo…")}
                            </>
                          ) : null}
                          {v.sfL2 ? (
                            <>
                              {t("Rendering try-on preview…")}
                            </>
                          ) : null}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div style={{ minHeight: "14px", fontSize: "10px", lineHeight: "1.4", color: "var(--muted-foreground)" }}>
                    {v.sfPriv ? (
                      <>
                        {t("Your photo is used only to create this try-on preview.")}
                      </>
                    ) : null}
                    {v.sfGen ? (
                      <>
                        <span style={{ display: "block", height: "6px", marginTop: "4px", borderRadius: "3px", background: "var(--secondary)", overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: v.sfProg, background: "var(--foreground)", transition: "width 0.75s linear" }} />
                        </span>
                      </>
                    ) : null}
                    {v.sfNote ? (
                      <>
                        <span style={{ animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both", display: "block" }}>{t("The preview is visual guidance, not an exact sizing guarantee.")}</span>
                      </>
                    ) : null}
                  </div>
                  <div style={{ marginTop: "auto" }}>
                    {v.sfBtnGen ? (
                      <>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "38px", borderRadius: "21px", background: "var(--foreground)", color: "var(--background)", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", transition: "opacity 0.25s ease, transform 0.2s ease", opacity: v.sfGenOp, transform: `scale(${v.sfGenS})` }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 2.5c.7 4.9 3.6 7.8 8.5 8.5-4.9.7-7.8 3.6-8.5 8.5-.7-4.9-3.6-7.8-8.5-8.5 4.9-.7 7.8-3.6 8.5-8.5z" fill="var(--background)" />
                          </svg>
                          {t("Generate Try-On Preview")}
                        </span>
                      </>
                    ) : null}
                    {v.sfBtnCart ? (
                      <>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", height: "38px", borderRadius: "21px", background: "var(--foreground)", color: "var(--background)", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", transition: "opacity 0.25s ease, transform 0.2s ease", transform: `scale(${v.sfCartBtnS})`, animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          {v.sfAdding ? (
                            <>
                              {t("Adding…")}
                            </>
                          ) : null}
                          {v.sfAddIdle ? (
                            <>
                              {t("Add to cart")}
                            </>
                          ) : null}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", top: "0", zIndex: "40", width: "24px", height: "24px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--foreground)", background: "color-mix(in srgb, var(--foreground) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--background) 90%, transparent), 0 6px 14px -6px color-mix(in srgb, var(--foreground) 50%, transparent)", opacity: v.sfPOp, transform: `translate(${v.sfPX}, ${v.sfPY})`, transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease" }}>
                  <span style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--foreground)", opacity: "0", animation: `${v.sfPTap} 0.7s ease-out both` }} />
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--gc-inactive)" }}>{t("What the shopper sees on your product page · Demo data")}</span>
            </div>
            <div aria-hidden={v.pane1Hide} style={{ position: "absolute", inset: "0", boxSizing: "border-box", padding: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", opacity: v.pane1Op, transform: `translateY(${v.pane1Y})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: v.pane1Pe }}>
              <div role="img" aria-label={t("Animated demo: a shopper asks about sizing and the assistant answers from the store knowledge. She rates the answer, asks about stock, leaves her email for the reply, and the team joins with an answer.")} style={{ position: "relative", boxSizing: "border-box", borderRadius: "16px", background: "var(--card)", color: "var(--foreground)", overflow: "hidden", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 12%, transparent), 0 30px 60px -30px color-mix(in srgb, var(--foreground) 85%, transparent)", textAlign: "start", width: "318px", height: "430px" }}>
                <div style={{ position: "absolute", top: "0", insetInlineEnd: "0", bottom: "0", width: "318px", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 14px", borderBottom: "1px solid var(--secondary)" }}>
                    <span style={{ width: "30px", height: "30px", flexShrink: "0", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700" }}>{t("G")}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700" }}>{t("GrindCTRL demo store")}</span>
                      <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)" }}>{t("Assistant may reply automatically")}</span>
                    </span>
                  </div>
                  <div style={{ flexGrow: "1", minHeight: "0", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "8px", padding: "12px 14px", overflow: "hidden", fontSize: "11.5px", lineHeight: "1.45", WebkitMaskImage: "linear-gradient(180deg, transparent 0, var(--foreground) 30px)", maskImage: "linear-gradient(180deg, transparent 0, var(--foreground) 30px)" }}>
                    {v.cv1 ? (
                      <>
                        <p style={{ margin: "0", alignSelf: "flex-end", maxWidth: "85%", padding: "8px 12px", borderRadius: "16px", borderEndEndRadius: "6px", background: "var(--foreground)", color: "var(--background)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Does the sage linen shirt run true to size? I'm between M and L.")}</p>
                      </>
                    ) : null}
                    {v.cv2 ? (
                      <>
                        <div style={{ alignSelf: "flex-start", maxWidth: "86%", display: "flex", flexDirection: "column", gap: "3px", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          <span style={{ padding: "0 4px", fontSize: "10px", fontWeight: "600", color: "var(--muted-foreground)" }}>{t("Assistant")}</span>
                          <p style={{ margin: "0", padding: "8px 12px", borderRadius: "16px", borderEndStartRadius: "6px", border: "1px solid var(--border)", background: "var(--card)" }}>
                            {t("It's cut oversized, so M already sits relaxed and L gives a longer, looser fit. Want a teammate to confirm stock in sage?")}
                          </p>
                          {v.cvRate ? (
                            <>
                              <span style={{ display: "flex", gap: "2px", color: "var(--gc-text-2)" }}>
                                <span style={{ display: "flex", padding: "4px 7px", borderRadius: "12px", background: v.cvUpBg, transition: "background-color 0.2s ease" }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M7 10v11" />
                                    <path d="M15 5.9L14 10h5.8a2 2 0 011.9 2.6l-2.3 7.9A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.8a2 2 0 001.8-1.1L12 2a3.1 3.1 0 013 3.9z" />
                                  </svg>
                                </span>
                                <span style={{ display: "flex", padding: "4px 7px", borderRadius: "12px" }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: "rotate(180deg)" }}>
                                    <path d="M7 10v11" />
                                    <path d="M15 5.9L14 10h5.8a2 2 0 011.9 2.6l-2.3 7.9A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.8a2 2 0 001.8-1.1L12 2a3.1 3.1 0 013 3.9z" />
                                  </svg>
                                </span>
                              </span>
                            </>
                          ) : null}
                          {v.cvThanks ? (
                            <>
                              <span style={{ padding: "2px 4px", fontSize: "10.5px", color: "var(--muted-foreground)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Thanks for your feedback!")}</span>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    {v.cv3 ? (
                      <>
                        <p style={{ margin: "0", alignSelf: "flex-end", maxWidth: "85%", padding: "8px 12px", borderRadius: "16px", borderEndEndRadius: "6px", background: "var(--foreground)", color: "var(--background)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Yes please, is M in stock in sage?")}</p>
                      </>
                    ) : null}
                    {v.cv4 ? (
                      <>
                        <div style={{ alignSelf: "flex-start", maxWidth: "86%", display: "flex", flexDirection: "column", gap: "3px", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          <span style={{ padding: "0 4px", fontSize: "10px", fontWeight: "600", color: "var(--muted-foreground)" }}>{t("Team")}</span>
                          <p style={{ margin: "0", padding: "8px 12px", borderRadius: "16px", borderEndStartRadius: "6px", border: "1px solid var(--border)", background: "var(--secondary)" }}>{t("Good news: M in sage is in stock. You can order it now.")}</p>
                        </div>
                      </>
                    ) : null}
                    {v.cvT1 ? (
                      <>
                        <span style={{ alignSelf: "flex-start", display: "inline-flex", gap: "4px", padding: "10px 12px", borderRadius: "16px", borderEndStartRadius: "6px", border: "1px solid var(--border)", background: "var(--card)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0s infinite" }} />
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.15s infinite" }} />
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.3s infinite" }} />
                        </span>
                      </>
                    ) : null}
                    {v.cvT2 ? (
                      <>
                        <span style={{ alignSelf: "flex-start", display: "inline-flex", gap: "4px", padding: "10px 12px", borderRadius: "16px", borderEndStartRadius: "6px", border: "1px solid var(--border)", background: "var(--card)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0s infinite" }} />
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.15s infinite" }} />
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.3s infinite" }} />
                        </span>
                      </>
                    ) : null}
                    {v.cvBanner ? (
                      <>
                        <p style={{ margin: "0", alignSelf: "center", fontSize: "10.5px", color: "var(--muted-foreground)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          {v.cvB1 ? (
                            <>
                              {t("Connecting you with our team…")}
                            </>
                          ) : null}
                          {v.cvB2 ? (
                            <>
                              {t("Our team joined the conversation")}
                            </>
                          ) : null}
                        </p>
                      </>
                    ) : null}
                    {v.cvContact ? (
                      <>
                        <div style={{ alignSelf: "center", width: "92%", boxSizing: "border-box", padding: "10px 11px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                          {v.cvForm ? (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                                <span style={{ fontSize: "11.5px", fontWeight: "700" }}>{t("Where should we reply?")}</span>
                                <span style={{ display: "flex", alignItems: "center", height: "30px", padding: "0 10px", borderRadius: "8px", border: `1px solid ${v.cvInLine}`, background: "var(--background)", fontSize: "12px", transition: "border-color 0.2s ease" }}>
                                  {v.cvPh ? (
                                    <>
                                      <span style={{ color: "var(--muted-foreground)" }}>{t("you@example.com")}</span>
                                    </>
                                  ) : null}
                                  {v.cvTyped ? (
                                    <>
                                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", clipPath: "inset(0 100% 0 0)", animation: `${v.cvType} 0.9s steps(17, end) 0.15s both` }}>{t("salma@example.com")}</span>
                                    </>
                                  ) : null}
                                </span>
                                <span style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                                  <span style={{ padding: "5px 11px", borderRadius: "14px", fontSize: "10.5px", color: "var(--muted-foreground)" }}>{t("Not now")}</span>
                                  <span style={{ padding: "5px 13px", borderRadius: "14px", background: "var(--foreground)", color: "var(--background)", fontSize: "10.5px", fontWeight: "700", transform: `scale(${v.cvSendS})`, transition: "transform 0.2s ease" }}>{t("Send")}</span>
                                </span>
                              </div>
                            </>
                          ) : null}
                          {v.cvDone ? (
                            <>
                              <p style={{ margin: "0", textAlign: "center", fontSize: "10.5px", color: "var(--muted-foreground)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Thanks — we will reply to you there.")}</p>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div style={{ margin: "0 12px 6px", display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 5px 0 13px", borderRadius: "19px", border: "1px solid var(--border)", background: "var(--background)" }}>
                    <span style={{ flexGrow: "1", fontSize: "12px", color: "var(--muted-foreground)" }}>{t("Ask anything…")}</span>
                    <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--background)" }}>
                      <span data-icon="inline-end" style={{ display: "inline-flex", flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-flip="">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <span style={{ padding: "0 0 8px", textAlign: "center", fontSize: "10px", color: "var(--muted-foreground)" }}>{t("Powered by GRINDCTRL")}</span>
                </div>
                <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", top: "0", zIndex: "40", width: "24px", height: "24px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--foreground)", background: "color-mix(in srgb, var(--foreground) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--background) 90%, transparent), 0 6px 14px -6px color-mix(in srgb, var(--foreground) 50%, transparent)", opacity: v.cvPOp, transform: `translate(${v.cvPX}, ${v.cvPY})`, transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease" }}>
                  <span style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--foreground)", opacity: "0", animation: `${v.cvPTap} 0.7s ease-out both` }} />
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--gc-inactive)" }}>{t("What the shopper sees in Store Chat · Demo data")}</span>
            </div>
            <div aria-hidden={v.pane2Hide} style={{ position: "absolute", inset: "0", boxSizing: "border-box", padding: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", opacity: v.pane2Op, transform: `translateY(${v.pane2Y})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: v.pane2Pe }}>
              <div role="img" aria-label={t("Animated demo: a new conversation from Salma arrives in the team inbox and opens with the whole thread, what the AI said and why it was handed off.")} style={{ position: "relative", boxSizing: "border-box", borderRadius: "16px", background: "var(--card)", color: "var(--foreground)", overflow: "hidden", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 12%, transparent), 0 30px 60px -30px color-mix(in srgb, var(--foreground) 85%, transparent)", textAlign: "start", width: "318px", height: "430px" }}>
                <div style={{ position: "absolute", insetInlineStart: "0", top: "0", bottom: "0", width: "318px", boxSizing: "border-box", padding: "12px 10px", display: "flex", flexDirection: "column", gap: "7px" }}>
                  <span style={{ padding: "0 4px", fontSize: "13px", fontWeight: "700" }}>{t("Conversations")}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "0 4px 3px" }}>
                    <span style={{ display: "flex", alignItems: "center", height: "28px", padding: "0 10px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--background)", fontSize: "10.5px", color: "var(--muted-foreground)" }}>{t("Search conversations")}</span>
                    <span style={{ display: "flex", gap: "5px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("All")}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("Assigned to me")}</span>
                    </span>
                  </span>
                  {v.cuNew ? (
                    <>
                      <div style={{ display: "flex", gap: "9px", padding: "9px 10px", borderRadius: "12px", border: `1px solid ${v.cuSLine}`, background: v.cuSBg, transition: "border-color 0.3s ease, background-color 0.3s ease", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                        <span style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>{t("S")}</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0", flexGrow: "1" }}>
                          <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("Salma")}</span>
                            <span style={{ flexShrink: "0", fontSize: "10px", color: "var(--muted-foreground)" }}>{t("now")}</span>
                          </span>
                          <span style={{ fontSize: "10.5px", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("Yes please, is M in stock in sage?")}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("Needs a reply")}</span>
                            {v.cuUnread ? (
                              <>
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "16px", height: "16px", padding: "0 4px", boxSizing: "border-box", borderRadius: "8px", background: "var(--foreground)", color: "var(--background)", fontSize: "9.5px", fontWeight: "800" }}>1</span>
                              </>
                            ) : null}
                            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{t("AI handed this off")}</span>
                          </span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  <div style={{ display: "flex", gap: "9px", padding: "9px 10px", borderRadius: "12px", border: `1px solid ${v.cuALine}`, background: v.cuABg, transition: "border-color 0.3s ease, background-color 0.3s ease" }}>
                    <span style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "50%", background: "var(--secondary)", color: "var(--gc-text-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>{t("A")}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0", flexGrow: "1" }}>
                      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("Anonymous shopper")}</span>
                        <span style={{ flexShrink: "0", fontSize: "10px", color: "var(--muted-foreground)" }}>{t("4h ago")}</span>
                      </span>
                      <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("Do you ship to Alexandria, and how long does it take?")}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("AI handling")}</span>
                      </span>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "9px", padding: "9px 10px", borderRadius: "12px", border: "1px solid transparent" }}>
                    <span style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "50%", background: "var(--secondary)", color: "var(--gc-text-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>{t("N")}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0", flexGrow: "1" }}>
                      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("noura@example.com")}</span>
                        <span style={{ flexShrink: "0", fontSize: "10px", color: "var(--muted-foreground)" }}>{t("1d ago")}</span>
                      </span>
                      <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("Can I exchange it for a smaller size?")}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("Resolved")}</span>
                      </span>
                    </span>
                  </div>
                </div>
                <div style={{ position: "absolute", inset: "0", zIndex: "5", display: "flex", flexDirection: "column", background: "var(--card)", transform: `translateX(${v.cuDetailX})`, transition: v.cuDetailTr }}>
                  <span style={{ padding: "10px 14px 0", fontSize: "11px", fontWeight: "700", color: "var(--gc-text-2)" }}>{t("← Back to conversations")}</span>
                  <div style={{ display: "flex", flexDirection: "column", flexGrow: "1", minHeight: "0" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "10px 12px", borderBottom: "1px solid var(--secondary)" }}>
                      {v.cuHand ? (
                        <>
                          <span style={{ fontSize: "10.5px", color: "var(--gc-text-2)", whiteSpace: "nowrap" }}>{t("↪ AI handed this conversation to your team")}</span>
                        </>
                      ) : null}
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {v.cuS1 ? (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>{t("Needs a reply")}</span>
                          </>
                        ) : null}
                        {v.cuS2 ? (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "20px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("You are replying")}</span>
                          </>
                        ) : null}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {v.cuTake ? (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "14px", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap", border: "1px solid var(--border)" }}>{t("Take over")}</span>
                          </>
                        ) : null}
                        {v.cuRet ? (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "14px", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap", border: "1px solid var(--border)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Return to AI")}</span>
                          </>
                        ) : null}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "14px", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap", border: "1px solid var(--border)", background: v.cuSelBg, transition: "background-color 0.25s ease" }}>
                          {v.cuNoOne ? (
                            <>
                              <span style={{ fontWeight: "600", color: "var(--gc-text-2)" }}>{t("Assign to…")}</span>
                            </>
                          ) : null}
                          {v.cuOmar ? (
                            <>
                              <span style={{ animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Omar")}</span>
                            </>
                          ) : null}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 10px", borderRadius: "14px", fontSize: "10.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--gc-text-2)" }}>{t("Mark resolved")}</span>
                      </span>
                    </div>
                    <div style={{ flexGrow: "1", minHeight: "0", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "7px", padding: "12px 14px", fontSize: "11px", lineHeight: "1.4", overflow: "hidden" }}>
                      {v.cuThS ? (
                        <>
                          <div style={{ alignSelf: "flex-start", maxWidth: "84%", padding: "7px 11px", borderRadius: "14px", background: "var(--secondary)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0s both" }}>{t("Does the sage linen shirt run true to size? I'm between M and L.")}</div>
                          <div style={{ alignSelf: "flex-end", maxWidth: "84%", padding: "7px 11px", borderRadius: "14px", background: "var(--foreground)", color: "var(--background)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both" }}>
                            {t("It's cut oversized, so M already sits relaxed and L gives a longer, looser fit. Want a teammate to confirm stock in sage?")}
                            {" "}
                            <span style={{ display: "block", marginTop: "2px", fontSize: "9.5px", opacity: "0.7" }}>{t("AI")}</span>
                          </div>
                          <div style={{ alignSelf: "flex-start", maxWidth: "84%", padding: "7px 11px", borderRadius: "14px", background: "var(--secondary)", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.24s both" }}>{t("Yes please, is M in stock in sage?")}</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", top: "0", zIndex: "40", width: "24px", height: "24px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--foreground)", background: "color-mix(in srgb, var(--foreground) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--background) 90%, transparent), 0 6px 14px -6px color-mix(in srgb, var(--foreground) 50%, transparent)", opacity: v.cuPOp, transform: `translate(${v.cuPX}, ${v.cuPY})`, transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease" }}>
                  <span style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--foreground)", opacity: "0", animation: `${v.cuPTap} 0.7s ease-out both` }} />
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--gc-inactive)" }}>{t("What your team sees in the inbox · Demo data")}</span>
            </div>
            <div aria-hidden={v.pane3Hide} style={{ position: "absolute", inset: "0", boxSizing: "border-box", padding: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", opacity: v.pane3Op, transform: `translateY(${v.pane3Y})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: v.pane3Pe }}>
              <div role="group" aria-label={t("How work moves between the AI and your team. Pick a case: a sizing question the AI answers, a stock question it hands to your team with an email alert, or a photo the AI reads and labels for your team. Each case ends in the dashboard.")} style={{ position: "relative", boxSizing: "border-box", borderRadius: "16px", background: "var(--card)", color: "var(--foreground)", overflow: "hidden", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 12%, transparent), 0 30px 60px -30px color-mix(in srgb, var(--foreground) 85%, transparent)", textAlign: "start", width: "318px", height: "430px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "9px", padding: "12px 12px 10px", borderBottom: "1px solid var(--secondary)" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700" }}>{t("How work moves")}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{t("Pick a case to follow it")}</span>
                  </span>
                  <div role="group" aria-label={t("Pick a case")} style={{ display: "flex", gap: "6px" }}>
                    <button type="button" onClick={v.pickCase0} aria-pressed={v.wfC0On} style={{ height: "32px", padding: "0 9px", borderRadius: "16px", border: "1px solid var(--foreground)", background: v.wfC0Bg, color: v.wfC0Fg, fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap", transition: "background-color 0.25s ease, color 0.25s ease" }}>{t("Sizing")}</button>
                    <button type="button" onClick={v.pickCase1} aria-pressed={v.wfC1On} style={{ height: "32px", padding: "0 9px", borderRadius: "16px", border: "1px solid var(--foreground)", background: v.wfC1Bg, color: v.wfC1Fg, fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap", transition: "background-color 0.25s ease, color 0.25s ease" }}>{t("Stock")}</button>
                    <button type="button" onClick={v.pickCase2} aria-pressed={v.wfC2On} style={{ height: "32px", padding: "0 9px", borderRadius: "16px", border: "1px solid var(--foreground)", background: v.wfC2Bg, color: v.wfC2Fg, fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap", transition: "background-color 0.25s ease, color 0.25s ease" }}>{t("Photo")}</button>
                  </div>
                </div>
                <div style={{ flexGrow: "1", minHeight: "0", display: "flex", flexDirection: "column", padding: "12px 12px 0" }}>
                  {v.wfP0Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP0Line}`, background: v.wfP0Bg, color: v.wfP0Fg, boxShadow: v.wfP0Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>1</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP0Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP0Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {v.wfK0Show ? (
                    <>
                      <span aria-hidden="true" style={{ position: "relative", display: "block", marginInlineStart: "22px", width: "2px", height: "9px", background: v.wfK0Base }}>
                        <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "top", transform: "scaleY(0)", animation: `${v.wfK0Flow} 0.6s ease both` }} />
                      </span>
                    </>
                  ) : null}
                  {v.wfP1Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP1Line}`, background: v.wfP1Bg, color: v.wfP1Fg, boxShadow: v.wfP1Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>2</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP1Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP1Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {v.wfK1Show ? (
                    <>
                      <span aria-hidden="true" style={{ position: "relative", display: "block", marginInlineStart: "22px", width: "2px", height: "9px", background: v.wfK1Base }}>
                        <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "top", transform: "scaleY(0)", animation: `${v.wfK1Flow} 0.6s ease both` }} />
                      </span>
                    </>
                  ) : null}
                  {v.wfP2Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP2Line}`, background: v.wfP2Bg, color: v.wfP2Fg, boxShadow: v.wfP2Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>3</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP2Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP2Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {v.wfK2Show ? (
                    <>
                      <span aria-hidden="true" style={{ position: "relative", display: "block", marginInlineStart: "22px", width: "2px", height: "9px", background: v.wfK2Base }}>
                        <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "top", transform: "scaleY(0)", animation: `${v.wfK2Flow} 0.6s ease both` }} />
                      </span>
                    </>
                  ) : null}
                  {v.wfP3Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP3Line}`, background: v.wfP3Bg, color: v.wfP3Fg, boxShadow: v.wfP3Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>4</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP3Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP3Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {v.wfK3Show ? (
                    <>
                      <span aria-hidden="true" style={{ position: "relative", display: "block", marginInlineStart: "22px", width: "2px", height: "9px", background: v.wfK3Base }}>
                        <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "top", transform: "scaleY(0)", animation: `${v.wfK3Flow} 0.6s ease both` }} />
                      </span>
                    </>
                  ) : null}
                  {v.wfP4Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP4Line}`, background: v.wfP4Bg, color: v.wfP4Fg, boxShadow: v.wfP4Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>5</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP4Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP4Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {v.wfK4Show ? (
                    <>
                      <span aria-hidden="true" style={{ position: "relative", display: "block", marginInlineStart: "22px", width: "2px", height: "9px", background: v.wfK4Base }}>
                        <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "top", transform: "scaleY(0)", animation: `${v.wfK4Flow} 0.6s ease both` }} />
                      </span>
                    </>
                  ) : null}
                  {v.wfP5Show ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: "0", height: "38px", boxSizing: "border-box", padding: "0 12px", borderRadius: "12px", border: `1px solid ${v.wfP5Line}`, background: v.wfP5Bg, color: v.wfP5Fg, boxShadow: v.wfP5Sh, transition: "background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, box-shadow 0.3s ease" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: "800" }}>6</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700" }}>{v.wfP5Title}</span>
                          <span style={{ fontSize: "10px", opacity: "0.75", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.wfP5Sub}</span>
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "56px", boxSizing: "border-box", padding: "8px 12px", borderTop: "1px solid var(--secondary)" }}>
                  <span style={{ flexShrink: "0", display: "inline-flex", alignItems: "center", height: "24px", padding: "0 9px", borderRadius: "12px", background: "var(--secondary)", fontSize: "10.5px", fontWeight: "700", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v.wfStep}</span>
                  {v.wfLA ? (
                    <>
                      <p style={{ margin: "0", minWidth: "0", fontSize: "11.5px", fontWeight: "600", lineHeight: "1.35", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{v.wfLine}</p>
                    </>
                  ) : null}
                  {v.wfLB ? (
                    <>
                      <p style={{ margin: "0", minWidth: "0", fontSize: "11.5px", fontWeight: "600", lineHeight: "1.35", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{v.wfLine}</p>
                    </>
                  ) : null}
                </div>
              </div>
              <span style={{ fontSize: "12px", color: "var(--gc-inactive)" }}>{t("How work moves between the AI and your team · Demo data")}</span>
            </div>
            <div aria-hidden={v.pane4Hide} style={{ position: "absolute", inset: "0", boxSizing: "border-box", padding: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", opacity: v.pane4Op, transform: `translateY(${v.pane4Y})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: v.pane4Pe }}>
              <div role="img" aria-label={t("Animated demo: the dashboard counts Store Chat conversations, AI-closed chats, handoffs, reply time and satisfaction, and try-on generations per day.")} style={{ position: "relative", boxSizing: "border-box", borderRadius: "16px", background: "var(--card)", color: "var(--foreground)", overflow: "hidden", boxShadow: "0 0 0 1px color-mix(in srgb, var(--background) 12%, transparent), 0 30px 60px -30px color-mix(in srgb, var(--foreground) 85%, transparent)", textAlign: "start", width: "318px", height: "430px", display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>{t("Dashboard")}</span>
                  <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)" }}>{t("Revenue attribution is planned.")}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: "1", minHeight: "0" }}>
                  <div style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--background)", gap: "5px", padding: "10px 12px", flex: "0 0 auto", minWidth: "0" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: "700" }}>{t("Store Chat")}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", color: "var(--gc-text-2)" }}>
                        <span style={{ position: "relative", width: "6px", height: "6px", borderRadius: "50%", background: "var(--foreground)" }}>
                          <span aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "var(--foreground)", opacity: "0", animation: "gcs-ping 2.4s ease-out 0s infinite" }} />
                        </span>
                        {t("Store Chat is live")}
                      </span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Conversations · 7 days")}</span>
                      <span style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpConv}</span>
                    </span>
                    <span style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "var(--secondary)" }}>
                      <span style={{ display: "block", width: v.rpSplit, background: "var(--foreground)", transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                    </span>
                    <span style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted-foreground)" }}>
                      <span>{t("Closed by AI")}{" "}{v.rpAi}</span>
                      <span>{t("Needed your team")}{" "}{v.rpTeam}</span>
                    </span>
                    <span style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "7px", borderTop: "1px solid var(--secondary)" }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0", flex: "1 1 0" }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpReply}</span>
                        <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Median first reply (7d)")}</span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0", flex: "1 1 0" }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpSat}</span>
                        <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Satisfaction · 30 days")}</span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0", flex: "1 1 0" }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpOpen}</span>
                        <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Open right now")}</span>
                      </span>
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--background)", gap: "5px", padding: "10px 12px", flex: "0 0 auto", minWidth: "0" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: "700" }}>{t("Try-on")}</span>
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{t("avg render 11.4s")}</span>
                    </span>
                    <span style={{ display: "flex", gap: "14px" }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 0" }}>
                        <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Generations, 7 days")}</span>
                        <span style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpGen}</span>
                        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{t("up 25% on last week")}</span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 0" }}>
                        <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", lineHeight: "1.3" }}>{t("Success rate, 7 days")}</span>
                        <span style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" }}>{v.rpRate}</span>
                        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{t("3 failed")}</span>
                      </span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "auto" }}>
                      <span style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "54px", paddingTop: "18px" }}>
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar0, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.0s, background-color 0.25s ease" }} />
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar1, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.07s, background-color 0.25s ease" }} />
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar2, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.14s, background-color 0.25s ease" }} />
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar3, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.21s, background-color 0.25s ease" }} />
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar4, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.28s, background-color 0.25s ease" }} />
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar5, borderRadius: "5px 5px 2px 2px", background: v.rpHi, transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.35s, background-color 0.25s ease" }}>
                          {v.rpTip ? (
                            <>
                              <span style={{ position: "absolute", insetInlineEnd: "-4px", bottom: "calc(100% + 7px)", padding: "5px 8px", borderRadius: "8px", background: "var(--foreground)", color: "var(--background)", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap", animation: "gcs-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{t("Sep 16 · 12 generations")}</span>
                            </>
                          ) : null}
                        </span>
                        <span style={{ position: "relative", flex: "1 1 0", alignSelf: "flex-end", height: v.rpBar6, borderRadius: "5px 5px 2px 2px", background: "var(--muted-foreground)", transition: "height 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.42s, background-color 0.25s ease" }} />
                      </span>
                      <span style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "var(--muted-foreground)" }}>
                        <span>{t("Sep 11")}</span>
                        <span>{t("Sep 17")}</span>
                      </span>
                    </span>
                  </div>
                </div>
                <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "0", top: "0", zIndex: "40", width: "24px", height: "24px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--foreground)", background: "color-mix(in srgb, var(--foreground) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--background) 90%, transparent), 0 6px 14px -6px color-mix(in srgb, var(--foreground) 50%, transparent)", opacity: v.rpPOp, transform: `translate(${v.rpPX}, ${v.rpPY})`, transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease" }}>
                  <span style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--foreground)", opacity: "0", animation: `${v.rpPTap} 0.7s ease-out both` }} />
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--gc-inactive)" }}>{t("What you see in the dashboard · Demo data")}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <div role="group" aria-label={t("Parts of the system")} style={{ display: "flex", gap: "6px" }}>
            <button type="button" onClick={v.pickTab0} aria-pressed={v.tab0On} aria-label={t("Storefront")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.seg0S})`, animation: `${v.seg0Anim} ${v.progDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.pickTab1} aria-pressed={v.tab1On} aria-label={t("Conversation")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.seg1S})`, animation: `${v.seg1Anim} ${v.progDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.pickTab2} aria-pressed={v.tab2On} aria-label={t("Customer")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.seg2S})`, animation: `${v.seg2Anim} ${v.progDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.pickTab3} aria-pressed={v.tab3On} aria-label={t("Workflow")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.seg3S})`, animation: `${v.seg3Anim} ${v.progDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.pickTab4} aria-pressed={v.tab4On} aria-label={t("Report")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--foreground)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.seg4S})`, animation: `${v.seg4Anim} ${v.progDur} linear both` }} />
              </span>
            </button>
          </div>
          <p aria-live="polite" style={{ margin: "8px 0 0", display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{v.partNum}</span>
            <span style={{ fontSize: "17px", fontWeight: "700", letterSpacing: "calc(-0.01em * var(--gc-ls, 1))" }}>{v.partName}</span>
          </p>
          <p style={{ margin: "4px 0 0", minHeight: "40px", fontSize: "13.5px", lineHeight: "1.5", color: "var(--muted-foreground)" }}>{v.partDesc}</p>
        </div>
      </div>
    </>
  );
}
