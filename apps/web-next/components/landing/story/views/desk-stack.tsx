/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import { GrindctrlMark } from '@/components/site/marks';
import { D_HUBSPOT, D_N8N, D_SHOPIFY } from '../story-marks';
import { StoryImg } from '../story-img';
import type { V, ViewProps } from '../story-types';

export function DeskStack({ v, t }: ViewProps) {
  return (
    <>
      <div data-reveal="">
        <div style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", height: "28px", padding: "0 12px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "12px", fontWeight: "600" }}>{t("Works inside your stack")}</span>
          <h2 id="stack-title" style={{ margin: "16px 0 0", fontSize: "44px", lineHeight: "1.1", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("Plugs into the store you already run.")}</h2>
        </div>
      </div>
      <div data-reveal="">
        <div role="img" aria-label={t("How GrindCTRL connects: your Shopify store (native app and theme blocks) sends products and read-only order status to GrindCTRL, where try-on, Store Chat, the team inbox and the dashboard are live. GrindCTRL hands conversations to your team with the reason and email alerts. n8n and HubSpot connect through custom setup.")} style={{ position: "relative", marginTop: "48px", height: "400px" }}>
          <svg aria-hidden="true" width="1200" height="380" viewBox="0 0 1200 380" style={{ position: "absolute", insetInlineStart: "0", top: "0", overflow: "visible" }} className="rtl:-scale-x-100">
            <path d="M284 128 H396" fill="none" stroke="color-mix(in srgb, var(--foreground) 28%, transparent)" strokeWidth="1.4" />
            <path d="M284 128 H396" pathLength="100" fill="none" stroke="var(--foreground)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 94" style={{ animation: "gcs-flow 2.6s linear -0.0s infinite" }} />
            <path d="M804 128 H916" fill="none" stroke="color-mix(in srgb, var(--foreground) 28%, transparent)" strokeWidth="1.4" />
            <path d="M804 128 H916" pathLength="100" fill="none" stroke="var(--foreground)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 94" style={{ animation: "gcs-flow 2.6s linear -1.3s infinite" }} />
            <path d="M540 262 V292 Q540 312 520 312 H505 Q490 312 490 330 V318" fill="none" stroke="color-mix(in srgb, var(--foreground) 35%, transparent)" strokeWidth="1.4" strokeDasharray="4 5" />
            <path d="M660 262 V292 Q660 312 680 312 H695 Q710 312 710 330 V318" fill="none" stroke="color-mix(in srgb, var(--foreground) 35%, transparent)" strokeWidth="1.4" strokeDasharray="4 5" />
          </svg>
          <div style={{ position: "absolute", insetInlineStart: "0px", top: "44px", width: "284px" }}>
            <div style={{ boxSizing: "border-box", padding: "16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 24px 50px -36px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--foreground)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={D_SHOPIFY} /></svg>
                <span style={{ flex: "1", fontSize: "15px", fontWeight: "700" }}>{t("Your Shopify store")}</span>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                <StoryImg src="/landing/v15/st-riyadh-abaya.webp" w={480} h={720} alt="" sizes="58px" style={{ width: "58px", height: "72px", objectFit: "cover", borderRadius: "9px", background: "var(--gc-studio)" }} />
                <StoryImg src="/landing/v15/st-705-tee.webp" w={480} h={672} alt="" sizes="58px" style={{ width: "58px", height: "72px", objectFit: "cover", borderRadius: "9px", background: "var(--gc-studio)" }} />
                <StoryImg src="/landing/v15/st-lounge-set.webp" w={480} h={360} alt="" sizes="58px" style={{ width: "58px", height: "72px", objectFit: "cover", borderRadius: "9px", background: "var(--gc-studio)" }} />
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--card) 55%, transparent)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <rect x="4" y="4" width="16" height="16" rx="4" />
                    <path d="M9 12h6M12 9v6" />
                  </svg>
                  {t("Native app")}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--card) 55%, transparent)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <rect x="4" y="4" width="7" height="7" rx="1.5" />
                    <rect x="13" y="4" width="7" height="7" rx="1.5" />
                    <rect x="4" y="13" width="7" height="7" rx="1.5" />
                    <path d="M16.5 13v7M13 16.5h7" />
                  </svg>
                  {t("Theme blocks")}
                </span>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "284px", top: "88px", width: "116px", textAlign: "center" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontSize: "11.5px", fontWeight: "700", color: "var(--foreground)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <path d="M4 12.5V5.5A1.5 1.5 0 015.5 4h7l7.5 7.5-8.5 8.5L4 12.5z" />
                <circle cx="8.5" cy="8.5" r="1.4" />
              </svg>
              {t("Products")}
            </span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "3px", fontSize: "11px", color: "var(--muted-foreground)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" />
                <path d="M4 8l8 4 8-4M12 12v8" />
              </svg>
              {t("Orders, read-only")}
            </span>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "400px", top: "0", width: "400px" }}>
            <div style={{ boxSizing: "border-box", padding: "16px", borderRadius: "22px", background: "var(--foreground)", color: "var(--background)", boxShadow: "0 30px 60px -30px color-mix(in srgb, var(--foreground) 80%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <GrindctrlMark style={{ width: "30px", height: "20px", display: "block", color: "var(--background)" }} />
                <span style={{ fontSize: "15px", fontWeight: "800", letterSpacing: "calc(0.1em * var(--gc-ls, 1))" }}>GRINDCTRL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "42px", padding: "0 12px", borderRadius: "12px", background: "color-mix(in srgb, var(--background) 10%, transparent)" }}>
                  <span aria-hidden="true" style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", background: "var(--background)", color: "var(--foreground)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></svg>
                  </span>
                  <span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>{t("AI agent")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--background)", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--background)", animation: "gcs-live 2.4s ease-in-out infinite" }} />
                    {t("Live")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "42px", padding: "0 12px", borderRadius: "12px", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M8.5 4.5L12 6l3.5-1.5 4.5 3-2.3 3.4-2.2-1.2V19.5h-7V9.7l-2.2 1.2L4 7.5l4.5-3z" /></svg>
                  <span style={{ flex: "1", fontSize: "13.5px", fontWeight: "600" }}>{t("Try-on")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--background)", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--background)", animation: "gcs-live 2.4s ease-in-out infinite" }} />
                    {t("Live")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "42px", padding: "0 12px", borderRadius: "12px", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                  </svg>
                  <span style={{ flex: "1", fontSize: "13.5px", fontWeight: "600" }}>{t("Store Chat")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--background)", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--background)", animation: "gcs-live 2.4s ease-in-out infinite" }} />
                    {t("Live")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "42px", padding: "0 12px", borderRadius: "12px", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M4 13l2.2-7.2A1.5 1.5 0 017.6 4.7h8.8a1.5 1.5 0 011.4 1.1L20 13v5.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V13z" />
                    <path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" />
                  </svg>
                  <span style={{ flex: "1", fontSize: "13.5px", fontWeight: "600" }}>{t("Team inbox")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--background)", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--background)", animation: "gcs-live 2.4s ease-in-out infinite" }} />
                    {t("Live")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "42px", padding: "0 12px", borderRadius: "12px", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 19.5V12" />
                    <path d="M12 19.5V5" />
                    <path d="M19 19.5v-8" />
                  </svg>
                  <span style={{ flex: "1", fontSize: "13.5px", fontWeight: "600" }}>{t("Dashboard")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--background)", border: "1px solid color-mix(in srgb, var(--background) 28%, transparent)", background: "color-mix(in srgb, var(--background) 6%, transparent)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--background)", animation: "gcs-live 2.4s ease-in-out infinite" }} />
                    {t("Live")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "800px", top: "88px", width: "116px", textAlign: "center" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontSize: "11.5px", fontWeight: "700", color: "var(--foreground)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <path d="M3.5 12h8" />
                <path d="M8.5 8.5L12 12l-3.5 3.5" />
                <circle cx="17.5" cy="9" r="2.6" />
                <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
              </svg>
              {t("Handoffs")}
            </span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "3px", fontSize: "11px", color: "var(--muted-foreground)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                <path d="M4 7l8 6 8-6" />
              </svg>
              {t("Email alerts")}
            </span>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "916px", top: "44px", width: "284px" }}>
            <div style={{ boxSizing: "border-box", padding: "16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 24px 50px -36px color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--foreground)" }}>
                <span style={{ display: "inline-flex" }}>
                  <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", border: "2px solid var(--card)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800" }}>O</span>
                  <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", background: "var(--gc-inactive)", color: "var(--foreground)", border: "2px solid var(--card)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", marginInlineStart: "-8px" }}>N</span>
                </span>
                <span style={{ flex: "1", fontSize: "15px", fontWeight: "700" }}>{t("Your team")}</span>
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", height: "36px", padding: "0 11px", borderRadius: "11px", background: "var(--gc-studio)", color: "var(--foreground)", fontSize: "12.5px", fontWeight: "600" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M3.5 12h8" />
                    <path d="M8.5 8.5L12 12l-3.5 3.5" />
                    <circle cx="17.5" cy="9" r="2.6" />
                    <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
                  </svg>
                  {t("Handoff with the reason")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", height: "36px", padding: "0 11px", borderRadius: "11px", background: "var(--gc-studio)", color: "var(--foreground)", fontSize: "12.5px", fontWeight: "600" }}>
                  <span aria-hidden="true" style={{ width: "20px", height: "20px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", border: "2px solid var(--gc-studio)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "800" }}>O</span>
                  {t("Assigned to Omar")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", height: "36px", padding: "0 11px", borderRadius: "11px", background: "var(--gc-studio)", color: "var(--foreground)", fontSize: "12.5px", fontWeight: "600" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5.5 4.5h13v10l-5 5h-8v-15z" />
                    <path d="M13.5 19.5v-5h5" />
                  </svg>
                  {t("Private note added")}
                </div>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "380px", top: "330px", width: "220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "54px", boxSizing: "border-box", padding: "0 14px", borderRadius: "16px", border: "1px dashed var(--gc-line-strong)", background: "color-mix(in srgb, var(--card) 70%, transparent)", color: "var(--foreground)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={D_N8N} /></svg>
              <span style={{ flex: "1", fontSize: "14px", fontWeight: "700" }}>{t("n8n")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px dashed color-mix(in srgb, var(--foreground) 25%, transparent)", background: "color-mix(in srgb, var(--card) 50%, transparent)" }}>
                <span style={{ width: "6px", height: "6px", boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid var(--foreground)" }} />
                {t("Custom setup")}
              </span>
            </div>
          </div>
          <div style={{ position: "absolute", insetInlineStart: "610px", top: "330px", width: "230px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "54px", boxSizing: "border-box", padding: "0 14px", borderRadius: "16px", border: "1px dashed var(--gc-line-strong)", background: "color-mix(in srgb, var(--card) 70%, transparent)", color: "var(--foreground)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={D_HUBSPOT} /></svg>
              <span style={{ flex: "1", fontSize: "14px", fontWeight: "700" }}>{t("HubSpot")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 9px", borderRadius: "11px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--foreground)", border: "1px dashed color-mix(in srgb, var(--foreground) 25%, transparent)", background: "color-mix(in srgb, var(--card) 50%, transparent)" }}>
                <span style={{ width: "6px", height: "6px", boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid var(--foreground)" }} />
                {t("Custom setup")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
