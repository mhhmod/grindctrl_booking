/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import { PasswordChip } from '@/components/site/password-chip';
import { GrindctrlMark } from '@/components/site/marks';
import { D_SHOPIFY } from '../story-marks';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function PhoneStore({ v, t }: ViewProps) {
  return (
    <>
      <div data-k="sblock" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "350px", marginInlineStart: "-175px", transformOrigin: "50% 0", transform: "translate3d(0, 80px, 0)" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "26px", padding: "0 11px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "11.5px", fontWeight: "600" }}>
            <span style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>02</span>
            <span style={{ width: "1px", height: "11px", background: "var(--gc-inactive)" }} />
            {t("Live store")}
          </span>
          <h2 id="store-title" style={{ margin: "12px 0 0", fontSize: "28px", lineHeight: "1.12", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("A real store. Try it there.")}</h2>
          <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--card) 55%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
              {t("Shopify store")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--card) 55%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M8.5 4.5L12 6l3.5-1.5 4.5 3-2.3 3.4-2.2-1.2V19.5h-7V9.7l-2.2 1.2L4 7.5l4.5-3z" /></svg>
              {t("Try-on on every product")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--card) 55%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" /></svg>
              {t("Store Chat")}
            </span>
          </div>
        </div>
        <div style={{ marginTop: "14px" }}>
          <div dir="ltr" lang="en" data-notr-zone="" style={{ position: "relative", borderRadius: "16px", overflow: "hidden", background: "var(--st-bg)", border: "1px solid var(--st-warm-3)", boxShadow: "0 44px 90px -46px color-mix(in srgb, var(--gc-ink) 55%, transparent), 0 2px 0 color-mix(in srgb, var(--st-bg) 60%, transparent) inset", textAlign: "start" }}>
            <div style={{ height: "44px", display: "flex", alignItems: "center", gap: "8px", padding: "0 10px", background: "var(--st-warm)", borderBottom: "1px solid var(--st-warm-2)" }}>
              <span style={{ flex: "1", height: "30px", borderRadius: "10px", background: "var(--st-bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", color: "var(--gc-ink)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--st-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                  <rect x="5" y="10.5" width="14" height="10" rx="2" />
                  <path d="M8 10.5V8a4 4 0 018 0v2.5" />
                </svg>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--gc-ink)" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
                grindctrl.myshopify.com
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--st-text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
                <path d="M19.5 4.5v4h-4" />
              </svg>
            </div>
            <div data-k="sview" style={{ position: "relative", height: "432px", overflow: "hidden", background: "var(--st-bg)" }}>
              <div role="img" aria-label="The GrindCTRL demo store on Shopify: shop by category, the Abayas collection with Try on buttons, and the Riyadh abaya product page with the try-on panel and Store Chat." style={{ position: "absolute", inset: "0" }}>
                <div style={{ height: "26px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--st-line)", fontSize: "10px", fontWeight: "500", color: "var(--st-ink)" }}>Test Store — For Demo & Evaluation Purposes Only</div>
                <div style={{ height: "46px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "center", padding: "0 12px", color: "var(--st-ink)" }}>
                  <span style={{ display: "flex", gap: "12px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M4 8h16M4 16h16" /></svg>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="M20 20l-4.2-4.2" />
                    </svg>
                  </span>
                  <span style={{ textAlign: "center", fontSize: "15px", fontWeight: "800" }}>GrindCTRL</span>
                  <span style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <circle cx="12" cy="8.5" r="3.8" />
                      <path d="M4.8 20.5c1.2-3.6 4-5.3 7.2-5.3s6 1.7 7.2 5.3" />
                    </svg>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <path d="M5.5 8.5h13l-1 12h-11l-1-12z" />
                      <path d="M9 8.5V7a3 3 0 016 0v1.5" />
                    </svg>
                  </span>
                </div>
                <div style={{ position: "absolute", zIndex: "0", insetInlineStart: "0", insetInlineEnd: "0", top: "72px", bottom: "0", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: "0", overflow: "hidden", background: "var(--st-bg)", opacity: v.sv0Op, transition: "opacity 0.5s ease" }}>
                    <div style={{ padding: "14px 14px 0" }}>
                      <p style={{ margin: "0 0 12px", fontSize: "19px", fontWeight: "800", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", color: "var(--st-ink)" }}>Shop by category</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 10px" }}>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-lounge-set.webp" w={480} h={360} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Sets</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-crew-tee.webp" w={480} h={320} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>{"Men's Basic Tees"}</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-705-tee.webp" w={480} h={672} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>{"Women's Basic Tees"}</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-coastline-ringer.webp" w={480} h={318} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Ring Tees</span>
                        </div>
                        <div data-sp="tile-abayas" style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-nida-abaya.webp" w={480} h={744} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Abayas</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-cargo-pants.webp" w={480} h={320} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Baggy Pants</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-cascade-jeans.webp" w={480} h={720} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Baggy Jeans</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <StoryImg src="/landing/v15/st-drift-trouser.webp" w={480} h={638} alt="" sizes="350px" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "var(--st-soft)" }} />
                          {" "}
                          <span style={{ display: "block", marginTop: "7px", textAlign: "center", fontSize: "11.5px", color: "var(--st-ink)" }}>Baggy Trousers</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: "absolute", inset: "0", overflow: "hidden", background: "var(--st-bg)", opacity: v.sv1Op, transition: "opacity 0.5s ease" }}>
                    <div style={{ padding: "14px 14px 0" }}>
                      <p style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", color: "var(--st-ink)" }}>Abayas</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px 10px" }}>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "relative" }}>
                            <StoryImg src="/landing/v15/st-muscat-abaya.webp" w={480} h={600} alt="" sizes="350px" style={{ display: "block", width: "100%", height: "200px", objectFit: "cover", background: "var(--st-soft)" }} />
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", width: "76px", height: "28px" }}>
                              <span aria-hidden="true" style={{ position: "absolute", inset: "-5px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "10px", pointerEvents: "none", opacity: v.sA1, transform: `scale(${v.sA1S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                                <span style={{ position: "absolute", top: "-30px", insetInlineStart: "-8px", zIndex: "3", display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px 0 7px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", letterSpacing: "0", boxShadow: "0 6px 14px -8px color-mix(in srgb, var(--gc-ink) 70%, transparent)" }}>
                                  <GrindctrlMark style={{ width: "15px", height: "10px", display: "block", color: "var(--gc-cream)" }} />
                                  GrindCTRL try-on
                                </span>
                              </span>
                            </span>
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--st-bg)", fontSize: "11px", fontWeight: "700" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                                <circle cx="12" cy="9" r="3.6" />
                                <path d="M5.5 19.5c1-3.2 3.6-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
                              </svg>
                              Try on
                            </span>
                          </div>
                          {" "}
                          <span style={{ display: "block", marginTop: "8px", fontSize: "11.5px", color: "var(--st-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Muscat Everyday Crepe Abaya</span>
                          {" "}
                          <span style={{ display: "block", marginTop: "2px", fontSize: "11px", fontWeight: "600", color: "var(--st-ink)" }}>$79.00</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "relative" }}>
                            <StoryImg src="/landing/v15/st-zahra-abaya.webp" w={480} h={720} alt="" sizes="350px" style={{ display: "block", width: "100%", height: "200px", objectFit: "cover", background: "var(--st-soft)" }} />
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", width: "76px", height: "28px" }}>
                              <span aria-hidden="true" style={{ position: "absolute", inset: "-5px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "10px", pointerEvents: "none", opacity: v.sA1, transform: `scale(${v.sA1S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                            </span>
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--st-bg)", fontSize: "11px", fontWeight: "700" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                                <circle cx="12" cy="9" r="3.6" />
                                <path d="M5.5 19.5c1-3.2 3.6-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
                              </svg>
                              Try on
                            </span>
                          </div>
                          {" "}
                          <span style={{ display: "block", marginTop: "8px", fontSize: "11.5px", color: "var(--st-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Zahra Embroidered Occasion Abaya</span>
                          {" "}
                          <span style={{ display: "block", marginTop: "2px", fontSize: "11px", fontWeight: "600", color: "var(--st-ink)" }}>$138.00</span>
                        </div>
                        <div data-sp="card-riyadh" style={{ position: "relative" }}>
                          <div style={{ position: "relative" }}>
                            <StoryImg src="/landing/v15/st-riyadh-abaya.webp" w={480} h={720} alt="" sizes="350px" style={{ display: "block", width: "100%", height: "200px", objectFit: "cover", background: "var(--st-soft)" }} />
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", width: "76px", height: "28px" }}>
                              <span aria-hidden="true" style={{ position: "absolute", inset: "-5px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "10px", pointerEvents: "none", opacity: v.sA1, transform: `scale(${v.sA1S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                            </span>
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--st-bg)", fontSize: "11px", fontWeight: "700" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                                <circle cx="12" cy="9" r="3.6" />
                                <path d="M5.5 19.5c1-3.2 3.6-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
                              </svg>
                              Try on
                            </span>
                          </div>
                          {" "}
                          <span style={{ display: "block", marginTop: "8px", fontSize: "11.5px", color: "var(--st-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Riyadh Tie-Waist Open Abaya</span>
                          {" "}
                          <span style={{ display: "block", marginTop: "2px", fontSize: "11px", fontWeight: "600", color: "var(--st-ink)" }}>$95.00</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "relative" }}>
                            <StoryImg src="/landing/v15/st-nida-abaya.webp" w={480} h={744} alt="" sizes="350px" style={{ display: "block", width: "100%", height: "200px", objectFit: "cover", background: "var(--st-soft)" }} />
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", width: "76px", height: "28px" }}>
                              <span aria-hidden="true" style={{ position: "absolute", inset: "-5px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "10px", pointerEvents: "none", opacity: v.sA1, transform: `scale(${v.sA1S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                            </span>
                            <span style={{ position: "absolute", insetInlineEnd: "9px", bottom: "9px", display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 10px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--st-bg)", fontSize: "11px", fontWeight: "700" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                                <circle cx="12" cy="9" r="3.6" />
                                <path d="M5.5 19.5c1-3.2 3.6-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
                              </svg>
                              Try on
                            </span>
                          </div>
                          {" "}
                          <span style={{ display: "block", marginTop: "8px", fontSize: "11.5px", color: "var(--st-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Nida Closed-Front Abaya</span>
                          {" "}
                          <span style={{ display: "block", marginTop: "2px", fontSize: "11px", fontWeight: "600", color: "var(--st-ink)" }}>$88.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: "absolute", inset: "0", overflow: "hidden", background: "var(--st-bg)", opacity: v.sv2Op, transition: "opacity 0.5s ease" }}>
                    <div data-sscroll="" style={{ transform: v.sScrollY, transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1)", willChange: "transform" }}>
                      <StoryImg src="/landing/v15/st-riyadh-main.webp" w={760} h={1140} alt="" sizes="350px" style={{ display: "block", width: "100%", height: "440px", objectFit: "cover", objectPosition: "50% 30%", background: "var(--st-soft)" }} />
                      <div style={{ padding: "16px 14px 40px" }}>
                        <p style={{ margin: "0", fontSize: "22px", lineHeight: "1.12", fontWeight: "800", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", color: "var(--st-ink)", maxWidth: "300px" }}>Riyadh Tie-Waist Open Abaya</p>
                        <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "var(--st-ink)" }}>$95.00</p>
                        <div style={{ height: "1px", marginTop: "16px", background: "var(--st-line)" }} />
                        <p style={{ margin: "12px 0 7px", fontSize: "11.5px", color: "var(--st-ink)" }}>Color</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-ink)", background: "var(--st-ink)", color: "var(--st-bg)", fontSize: "11.5px" }}>Black</span>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-line)", background: "var(--st-bg)", color: "var(--st-ink)", fontSize: "11.5px" }}>Sand</span>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-line)", background: "var(--st-bg)", color: "var(--st-ink)", fontSize: "11.5px" }}>Taupe</span>
                        </div>
                        <p style={{ margin: "12px 0 7px", fontSize: "11.5px", color: "var(--st-ink)" }}>Size</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-ink)", background: "var(--st-ink)", color: "var(--st-bg)", fontSize: "11.5px" }}>S</span>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-line)", background: "var(--st-bg)", color: "var(--st-ink)", fontSize: "11.5px" }}>M</span>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-line)", background: "var(--st-bg)", color: "var(--st-ink)", fontSize: "11.5px" }}>L</span>
                          <span style={{ flex: "1 1 0", minWidth: "0", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", border: "1px solid var(--st-line)", background: "var(--st-bg)", color: "var(--st-ink)", fontSize: "11.5px" }}>XL</span>
                        </div>
                        <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                          <span style={{ width: "96px", height: "40px", border: "1px solid var(--st-line)", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "space-around", color: "var(--st-ink)", fontSize: "12px" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M6 12h12" /></svg>
                            1
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M6 12h12M12 6v12" /></svg>
                          </span>
                          <span style={{ flex: "1", height: "40px", borderRadius: "9px", background: "var(--st-ink)", color: "var(--st-bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "12.5px" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                              <path d="M5.5 8.5h13l-1 12h-11l-1-12z" />
                              <path d="M9 8.5V7a3 3 0 016 0v1.5" />
                            </svg>
                            Add to cart
                          </span>
                        </div>
                        <div style={{ marginTop: "10px", height: "40px", borderRadius: "9px", background: "var(--st-ink)", color: "var(--st-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12.5px" }}>Buy it now</div>
                        <p style={{ margin: "18px 0 0", fontSize: "12px", lineHeight: "1.6", color: "var(--st-ink)" }}>
                          An open-front abaya in soft, drapey crepe that falls open over your outfit and closes with a self-tie sash at the waist. Wide dropped shoulders and a relaxed A-line cut make it an easy layering piece for warm days.
                        </p>
                        <div data-sp="tryon-btn" style={{ position: "relative", marginTop: "16px", height: "50px", borderRadius: "8px", background: "var(--gc-ink)", color: "var(--st-bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "14px", fontWeight: "700" }}>
                          <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "color-mix(in srgb, var(--st-bg) 18%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                              <circle cx="12" cy="9" r="3.6" />
                              <path d="M5.5 19.5c1-3.2 3.6-4.8 6.5-4.8s5.5 1.6 6.5 4.8" />
                            </svg>
                          </span>
                          Try it on with AI
                          <span aria-hidden="true" style={{ position: "absolute", inset: "-6px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "12px", pointerEvents: "none", opacity: v.sA2, transform: `scale(${v.sA2S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                            <span style={{ position: "absolute", top: "-12px", insetInlineEnd: "14px", zIndex: "3", display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px 0 7px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", letterSpacing: "0", boxShadow: "0 6px 14px -8px color-mix(in srgb, var(--gc-ink) 70%, transparent)" }}>
                              <GrindctrlMark style={{ width: "15px", height: "10px", display: "block", color: "var(--gc-cream)" }} />
                              GrindCTRL try-on
                            </span>
                          </span>
                        </div>
                        {v.sPanelOn ? (
                          <>
                            <div style={{ position: "relative", marginTop: "14px", padding: "12px", borderRadius: "14px", background: "var(--st-warm)", animation: "gcs-open 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                                <StoryImg src="/landing/v15/st-riyadh-abaya.webp" w={480} h={720} alt="" sizes="44px" style={{ width: "44px", height: "58px", objectFit: "cover", borderRadius: "7px", background: "var(--st-bg)" }} />
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--gc-ink)" }}>Riyadh Tie-Waist Open Abaya</span>
                              </div>
                              <div style={{ position: "relative", padding: "12px", borderRadius: "12px", border: "1px solid var(--st-warm-2)", background: "var(--st-warm)" }}>
                                {v.sUp ? (
                                  <>
                                    <p style={{ margin: "0", fontSize: "13.5px", fontWeight: "700", color: "var(--gc-ink)" }}>Upload your photo</p>
                                    <p style={{ margin: "4px 0 0", fontSize: "11.5px", lineHeight: "1.45", color: "var(--st-text)" }}>Upload a full or half-body photo to preview how the Riyadh Tie-Waist Open Abaya looks on you.</p>
                                    <p style={{ margin: "12px 0 6px", fontSize: "11.5px", color: "var(--gc-ink)" }}>Your photo</p>
                                    <div style={{ height: "112px", border: "1.5px dashed var(--st-warm-3)", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--gc-ink)" }}>
                                      <span style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--st-warm)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                                          <path d="M12 16V5" />
                                          <path d="M7.5 9.5L12 5l4.5 4.5" />
                                          <path d="M5 19h14" />
                                        </svg>
                                      </span>
                                      <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Drag and drop your photo here</span>
                                      <span style={{ fontSize: "10.5px", color: "var(--st-text)" }}>or click to browse · JPG, PNG, WebP · Max 8 MB</span>
                                    </div>
                                  </>
                                ) : null}
                                {v.sReady ? (
                                  <>
                                    <p style={{ margin: "0", fontSize: "13.5px", fontWeight: "700", color: "var(--gc-ink)" }}>Ready to generate your preview</p>
                                    <p style={{ margin: "4px 0 0", fontSize: "11.5px", lineHeight: "1.45", color: "var(--st-text)" }}>Review the details below and tap generate when ready.</p>
                                    <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                                      <StoryImg src="/landing/v15/shopper-woman.webp" w={768} h={960} alt="" sizes="54px" style={{ width: "54px", height: "68px", objectFit: "cover", borderRadius: "9px", animation: "gcs-drop 0.7s cubic-bezier(0.22, 1, 0.36, 1) both" }} />
                                      <span style={{ flex: "1", minWidth: "0" }}>
                                        <span style={{ display: "block", fontSize: "12.0px", fontWeight: "700", color: "var(--gc-ink)" }}>Your photo is ready</span>
                                        {" "}
                                        <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "var(--st-text)", textDecoration: "underline" }}>Change photo</span>
                                      </span>
                                    </div>
                                    <p style={{ margin: "10px 0 0", fontSize: "10.5px", lineHeight: "1.45", color: "var(--st-text)" }}>
                                      <b style={{ color: "var(--gc-ink)" }}>Privacy:</b>
                                      {" "}Your photo is used only to create this try-on preview. It is not stored permanently or shared publicly.
                                    </p>
                                    <div data-sp="gen-btn" style={{ position: "relative", marginTop: "12px", height: "42px", borderRadius: "10px", background: "var(--gc-ink)", color: "var(--gc-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12.5px", fontWeight: "700", animation: v.sRing }}>
                                      Generate Try-On Preview
                                      <span style={{ position: "absolute", insetInlineStart: "50%", bottom: "calc(100% + 10px)", transform: `translate(-50%, ${v.sCallY})`, opacity: v.sCallOp, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)", display: "inline-flex", alignItems: "center", gap: "7px", height: "30px", padding: "0 12px", borderRadius: "9px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", boxShadow: "0 10px 22px -12px color-mix(in srgb, var(--gc-ink) 80%, transparent)" }} lang={v.pageLang} dir={v.pageDir}>
                                        <GrindctrlMark style={{ width: "15px", height: "10px", display: "block", color: "var(--gc-cream)" }} />
                                        {t("Your turn: press it on the live store")}
                                      </span>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                              <span aria-hidden="true" style={{ position: "absolute", inset: "-6px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "18px", pointerEvents: "none", opacity: v.sA2, transform: `scale(${v.sA2S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {v.sChatHint ? (
                  <>
                    <span style={{ position: "absolute", insetInlineEnd: "62px", bottom: "20px", padding: "7px 11px", borderRadius: "9px", background: "var(--st-bg)", border: "1px solid var(--st-soft)", fontSize: "11px", color: "var(--st-ink)", whiteSpace: "nowrap", boxShadow: "0 6px 16px -10px color-mix(in srgb, var(--st-ink) 40%, transparent)" }}>Hi, how can we help?</span>
                  </>
                ) : null}
                {v.sChatOpen ? (
                  <>
                    <div style={{ position: "absolute", zIndex: "5", insetInlineEnd: "12px", bottom: "66px", width: "244px", boxSizing: "border-box", borderRadius: "16px", background: "var(--st-bg)", border: "1px solid var(--st-warm-2)", boxShadow: "0 24px 50px -24px color-mix(in srgb, var(--st-ink) 45%, transparent)", animation: "gcs-open 0.5s cubic-bezier(0.22, 1, 0.36, 1) both", transformOrigin: "90% 100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderBottom: "1px solid var(--st-warm)" }}>
                        <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: "var(--gc-ink)", color: "var(--gc-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800" }}>G</span>
                        <span style={{ flex: "1" }}>
                          <span style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--gc-ink)" }}>Support</span>
                          {" "}
                          <span style={{ display: "block", fontSize: "10px", color: "var(--st-text)" }}>Assistant may reply automatically</span>
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--st-text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </div>
                      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "96px" }}>
                        {v.sChatQ ? (
                          <>
                            <span style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "7px 10px", borderRadius: "12px 12px 3px 12px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "11.5px", lineHeight: "1.4", animation: "gcs-open 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>Which abayas come in Sand?</span>
                          </>
                        ) : null}
                        {v.sChatA ? (
                          <>
                            <span style={{ alignSelf: "flex-start", maxWidth: "88%", padding: "7px 10px", borderRadius: "12px 12px 12px 3px", background: "var(--st-warm)", color: "var(--gc-ink)", fontSize: "11.5px", lineHeight: "1.4", animation: "gcs-open 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}>Muscat and Riyadh both come in Sand, in sizes S to XL.</span>
                          </>
                        ) : null}
                      </div>
                      <span aria-hidden="true" style={{ position: "absolute", inset: "-6px", zIndex: "2", border: "1.5px solid var(--gc-ink)", borderRadius: "20px", pointerEvents: "none", opacity: v.sA3, transform: `scale(${v.sA3S})`, transition: "opacity 0.45s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                        <span style={{ position: "absolute", top: "-30px", insetInlineStart: "-8px", zIndex: "3", display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px 0 7px", borderRadius: "7px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", letterSpacing: "0", boxShadow: "0 6px 14px -8px color-mix(in srgb, var(--gc-ink) 70%, transparent)" }}>
                          <GrindctrlMark style={{ width: "15px", height: "10px", display: "block", color: "var(--gc-cream)" }} />
                          GrindCTRL Store Chat
                        </span>
                      </span>
                    </div>
                  </>
                ) : null}
                <span style={{ position: "absolute", insetInlineEnd: "12px", bottom: "12px", width: "42px", height: "42px", borderRadius: "12px", background: "var(--gc-ink)", color: "var(--gc-cream)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 22px -12px color-mix(in srgb, var(--st-ink) 60%, transparent)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.1" />
                    <path d="M12 16.8v.2" />
                  </svg>
                </span>
              </div>
              <span data-k="sptr" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", zIndex: "40", width: "0", height: "0", pointerEvents: "none", opacity: "0", transform: "translate3d(600px, 300px, 0)", transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease" }}>
                <span data-k="sptrIn" style={{ position: "absolute", insetInlineStart: "-14px", top: "-14px", width: "28px", height: "28px", boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--gc-ink)", background: "color-mix(in srgb, var(--gc-ink) 14%, transparent)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--st-bg) 92%, transparent), 0 8px 18px -6px color-mix(in srgb, var(--gc-ink) 55%, transparent)", transform: "scale(1)", transition: "transform 0.16s ease" }}>
                  <span data-k="sptrRing" style={{ position: "absolute", inset: "-2px", borderRadius: "50%", border: "2px solid var(--gc-ink)", opacity: "0", animationName: "none", animationDuration: "0.7s", animationTimingFunction: "ease-out", animationFillMode: "both" }} />
                </span>
              </span>
              <a href={v.sHref} onClick={v.storeFrom('store')} target="_blank" rel="noopener noreferrer" data-live-link="" aria-label={t("Open this page on the live demo store, in a new tab")} style={{ position: "absolute", inset: "0", zIndex: "50", borderRadius: "0" }}>
                <span data-live-chip="" style={{ position: "absolute", insetInlineStart: "50%", top: "14px", transform: "translate(-50%, -6px)", display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 13px", borderRadius: "16px", background: "var(--gc-ink)", color: "var(--gc-cream)", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", opacity: "0", transition: "opacity 0.25s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: "none" }} lang={v.pageLang} dir={v.pageDir}>
                  {t("Open this page on the live store")}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M9 5h10v10" />
                    <path d="M19 5L7 17" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
        </div>
        <div style={{ marginTop: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <a href="https://grindctrl.myshopify.com" onClick={v.storeFrom('store')} target="_blank" rel="noopener noreferrer" data-cta="" style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "48px", padding: "0 18px", borderRadius: "25px", background: "var(--foreground)", color: "var(--background)", textDecoration: "none", fontSize: "14.5px", fontWeight: "700", whiteSpace: "nowrap", transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
              {t("Open the live store")}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <path d="M9 5h10v10" />
                <path d="M19 5L7 17" />
              </svg>
            </a>
            <PasswordChip copy={v.passCopy} />
          </div>
        </div>
        <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: "11px", color: "var(--muted-foreground)" }}>{t("Real store and products. The chat lines are demo text.")}</p>
      </div>
    </>
  );
}
