/* Generated from the v15 prototype's markup (design/prototype/boards/
   Scroll.dc.html in the site-v15 handoff bundle, whose notes are in
   apps/web-next/docs/handoff/site-v15). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import type { V, ViewProps } from '../story-types';

export function PhoneOps({ v, t }: ViewProps) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "-20svh", width: "120vw", height: "80svh", marginInlineStart: "-60vw", pointerEvents: "none", background: "radial-gradient(closest-side, color-mix(in srgb, var(--gc-cream) 8%, transparent), transparent)" }} />
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", bottom: "-30svh", width: "90vw", height: "70svh", marginInlineStart: "-45vw", pointerEvents: "none", background: "radial-gradient(closest-side, color-mix(in srgb, var(--gc-cream) 5%, transparent), transparent)" }} />
      <div data-k="oblock" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "350px", marginInlineStart: "-175px", transformOrigin: "50% 0", transform: "translate3d(0, 80px, 0)", color: "var(--gc-cream)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "26px", padding: "0 11px", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--gc-cream) 20%, transparent)", background: "color-mix(in srgb, var(--gc-cream) 6%, transparent)", color: "var(--gc-cream)", fontSize: "11.5px", fontWeight: "600" }}>
          <span style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>03</span>
          <span style={{ width: "1px", height: "11px", background: "color-mix(in srgb, var(--gc-cream) 35%, transparent)" }} />
          {t("AI operations")}
        </span>
        <h2 id="m-ops-title" style={{ margin: "12px 0 0", fontSize: "28px", lineHeight: "1.12", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("Your team and the AI run support together.")}</h2>
        <div style={{ marginTop: "14px" }}>
          <div role="group" aria-label={t("What the AI does")} style={{ display: "flex", gap: "6px" }}>
            <button type="button" onClick={v.goOps0} aria-pressed={v.ob0On} aria-label={t("Answers from what you teach it")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.os0S})`, animation: `${v.os0Anim} ${v.opsDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.goOps1} aria-pressed={v.ob1On} aria-label={t("Order status inside the chat")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.os1S})`, animation: `${v.os1Anim} ${v.opsDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.goOps2} aria-pressed={v.ob2On} aria-label={t("Photos read, hard cases handed off")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.os2S})`, animation: `${v.os2Anim} ${v.opsDur} linear both` }} />
              </span>
            </button>
            <button type="button" onClick={v.goOps3} aria-pressed={v.ob3On} aria-label={t("Your team takes over")} style={{ flex: "1 1 0", minWidth: "0", height: "30px", padding: "0", border: "0", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span style={{ position: "relative", display: "block", width: "100%", height: "3px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }}>
                <span style={{ position: "absolute", inset: "0", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", transform: `scaleX(${v.os3S})`, animation: `${v.os3Anim} ${v.opsDur} linear both` }} />
              </span>
            </button>
          </div>
          <p aria-live="polite" style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "color-mix(in srgb, var(--gc-cream) 60%, transparent)", fontVariantNumeric: "tabular-nums" }}>{v.obNum}</span>
            <span style={{ fontSize: "16.5px", fontWeight: "700" }}>{v.obTitle}</span>
          </p>
          <p style={{ margin: "4px 0 0", minHeight: "40px", fontSize: "13px", lineHeight: "1.5", color: "color-mix(in srgb, var(--gc-cream) 66%, transparent)" }}>{v.obDesc}</p>
        </div>
        <div role="img" aria-label={t("Animated demo of support run by the AI and your team: questions answered from store knowledge, order status looked up read-only, a photo described and handed to the team with the reason, and a teammate taking over with a private note and a saved reply.")} style={{ marginTop: "12px", boxSizing: "border-box", padding: "12px", borderRadius: "20px", border: "1px solid color-mix(in srgb, var(--gc-cream) 10%, transparent)", background: "var(--gc-panel-dark)" }}>
          {v.opS0Show ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "50px", boxSizing: "border-box", padding: "0 12px", borderRadius: "14px", border: `1px solid ${v.opS0Line}`, background: v.opS0Bg, color: v.opS0Fg, boxShadow: v.opS0Sh, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease" }}>
                <span style={{ flexShrink: "0", width: "26px", height: "26px", boxSizing: "border-box", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={v.opS0IcFill} stroke={v.opS0IcStroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><use href={v.opS0Ic} /></svg>
                </span>
                <span style={{ minWidth: "0" }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{v.opS0Title}</span>
                  {" "}
                  <span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: v.opS0SubFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.opS0Sub}</span>
                </span>
              </div>
            </>
          ) : null}
          {v.opK0Show ? (
            <>
              <div aria-hidden="true" style={{ position: "relative", width: "2px", height: "12px", marginInlineStart: "23px" }}>
                <span style={{ position: "absolute", inset: "0", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }} />
                <span style={{ position: "absolute", inset: "0", background: v.opK0Base, transformOrigin: "50% 0", animation: `${v.opK0Flow} 0.5s ease both` }} />
              </div>
            </>
          ) : null}
          {v.opS1Show ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "50px", boxSizing: "border-box", padding: "0 12px", borderRadius: "14px", border: `1px solid ${v.opS1Line}`, background: v.opS1Bg, color: v.opS1Fg, boxShadow: v.opS1Sh, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease" }}>
                <span style={{ flexShrink: "0", width: "26px", height: "26px", boxSizing: "border-box", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={v.opS1IcFill} stroke={v.opS1IcStroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><use href={v.opS1Ic} /></svg>
                </span>
                <span style={{ minWidth: "0" }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{v.opS1Title}</span>
                  {" "}
                  <span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: v.opS1SubFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.opS1Sub}</span>
                </span>
              </div>
            </>
          ) : null}
          {v.opK1Show ? (
            <>
              <div aria-hidden="true" style={{ position: "relative", width: "2px", height: "12px", marginInlineStart: "23px" }}>
                <span style={{ position: "absolute", inset: "0", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }} />
                <span style={{ position: "absolute", inset: "0", background: v.opK1Base, transformOrigin: "50% 0", animation: `${v.opK1Flow} 0.5s ease both` }} />
              </div>
            </>
          ) : null}
          {v.opS2Show ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "50px", boxSizing: "border-box", padding: "0 12px", borderRadius: "14px", border: `1px solid ${v.opS2Line}`, background: v.opS2Bg, color: v.opS2Fg, boxShadow: v.opS2Sh, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease" }}>
                <span style={{ flexShrink: "0", width: "26px", height: "26px", boxSizing: "border-box", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={v.opS2IcFill} stroke={v.opS2IcStroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><use href={v.opS2Ic} /></svg>
                </span>
                <span style={{ minWidth: "0" }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{v.opS2Title}</span>
                  {" "}
                  <span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: v.opS2SubFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.opS2Sub}</span>
                </span>
              </div>
            </>
          ) : null}
          {v.opK2Show ? (
            <>
              <div aria-hidden="true" style={{ position: "relative", width: "2px", height: "12px", marginInlineStart: "23px" }}>
                <span style={{ position: "absolute", inset: "0", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }} />
                <span style={{ position: "absolute", inset: "0", background: v.opK2Base, transformOrigin: "50% 0", animation: `${v.opK2Flow} 0.5s ease both` }} />
              </div>
            </>
          ) : null}
          {v.opS3Show ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "50px", boxSizing: "border-box", padding: "0 12px", borderRadius: "14px", border: `1px solid ${v.opS3Line}`, background: v.opS3Bg, color: v.opS3Fg, boxShadow: v.opS3Sh, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease" }}>
                <span style={{ flexShrink: "0", width: "26px", height: "26px", boxSizing: "border-box", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={v.opS3IcFill} stroke={v.opS3IcStroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><use href={v.opS3Ic} /></svg>
                </span>
                <span style={{ minWidth: "0" }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{v.opS3Title}</span>
                  {" "}
                  <span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: v.opS3SubFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.opS3Sub}</span>
                </span>
              </div>
            </>
          ) : null}
          {v.opK3Show ? (
            <>
              <div aria-hidden="true" style={{ position: "relative", width: "2px", height: "12px", marginInlineStart: "23px" }}>
                <span style={{ position: "absolute", inset: "0", background: "color-mix(in srgb, var(--gc-cream) 16%, transparent)" }} />
                <span style={{ position: "absolute", inset: "0", background: v.opK3Base, transformOrigin: "50% 0", animation: `${v.opK3Flow} 0.5s ease both` }} />
              </div>
            </>
          ) : null}
          {v.opS4Show ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "50px", boxSizing: "border-box", padding: "0 12px", borderRadius: "14px", border: `1px solid ${v.opS4Line}`, background: v.opS4Bg, color: v.opS4Fg, boxShadow: v.opS4Sh, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease" }}>
                <span style={{ flexShrink: "0", width: "26px", height: "26px", boxSizing: "border-box", borderRadius: "50%", border: "1px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={v.opS4IcFill} stroke={v.opS4IcStroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><use href={v.opS4Ic} /></svg>
                </span>
                <span style={{ minWidth: "0" }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{v.opS4Title}</span>
                  {" "}
                  <span style={{ display: "block", marginTop: "1px", fontSize: "11.5px", color: v.opS4SubFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.opS4Sub}</span>
                </span>
              </div>
            </>
          ) : null}
          <div style={{ marginTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "9px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: "700", color: "color-mix(in srgb, var(--gc-cream) 82%, transparent)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                  <path d="M5 19.5V12" />
                  <path d="M12 19.5V5" />
                  <path d="M19 19.5v-8" />
                </svg>
                {t("Today in your dashboard")}
              </span>
              <span style={{ fontSize: "11.5px", color: "color-mix(in srgb, var(--gc-cream) 58%, transparent)" }}>{t("Demo data")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
              <div style={{ padding: "10px 12px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                  </svg>
                  {t("Conversations")}
                </span>
                <span style={{ display: "inline-block", marginTop: "4px", fontSize: "21px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc0Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc0}</span>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></svg>
                  {t("Closed by AI")}
                </span>
                <span style={{ display: "inline-block", marginTop: "4px", fontSize: "21px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc1Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc1}</span>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M3.5 12h8" />
                    <path d="M8.5 8.5L12 12l-3.5 3.5" />
                    <circle cx="17.5" cy="9" r="2.6" />
                    <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
                  </svg>
                  {t("Handed to your team")}
                </span>
                <span style={{ display: "inline-block", marginTop: "4px", fontSize: "21px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc2Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc2}</span>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  {t("Waiting now")}
                </span>
                <span style={{ display: "inline-block", marginTop: "4px", fontSize: "21px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc3Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc3}</span>
              </div>
            </div>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: "11px", lineHeight: "1.45", color: "color-mix(in srgb, var(--gc-cream) 56%, transparent)" }}>{t(v.managedSetup ? "Demo data. Setup and ongoing care are part of the service." : "Demo data.")}</p>
      </div>
    </>
  );
}
