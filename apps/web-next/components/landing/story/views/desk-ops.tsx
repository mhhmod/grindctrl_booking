/* Generated from the v15 prototype's markup (design/prototype/boards/
   Scroll.dc.html in the site-v15 handoff bundle, whose notes are in
   apps/web-next/docs/handoff/site-v15). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import { D_HUBSPOT, D_N8N, D_SHOPIFY } from '../story-marks';
import type { V, ViewProps } from '../story-types';

export function DeskOps({ v, t }: ViewProps) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", top: "-20svh", width: "120vw", height: "80svh", marginInlineStart: "-60vw", pointerEvents: "none", background: "radial-gradient(closest-side, color-mix(in srgb, var(--gc-cream) 8%, transparent), transparent)" }} />
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "50%", bottom: "-30svh", width: "90vw", height: "70svh", marginInlineStart: "-45vw", pointerEvents: "none", background: "radial-gradient(closest-side, color-mix(in srgb, var(--gc-cream) 5%, transparent), transparent)" }} />
      <div data-k="oblock" style={{ position: "absolute", insetInlineStart: "50%", top: "0", width: "1200px", marginInlineStart: "-600px", transformOrigin: "50% 0", transform: "translate3d(0, 96px, 0)", color: "var(--gc-cream)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "40px" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", height: "28px", padding: "0 12px", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--gc-cream) 20%, transparent)", background: "color-mix(in srgb, var(--gc-cream) 6%, transparent)", color: "var(--gc-cream)", fontSize: "12px", fontWeight: "600" }}>
              <span style={{ fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>03</span>
              <span style={{ width: "1px", height: "11px", background: "color-mix(in srgb, var(--gc-cream) 35%, transparent)" }} />
              {t("AI operations")}
            </span>
            <h2 id="ops-title" style={{ margin: "14px 0 0", fontSize: "46px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>
              {t("Your team and the AI")}
              {" "}
              <br />
              {t("run support together.")}
            </h2>
          </div>
          <p style={{ margin: "0 0 6px", maxWidth: "430px", fontSize: "16.5px", lineHeight: "1.6", color: "color-mix(in srgb, var(--gc-cream) 72%, transparent)" }}>{t("Every conversation is answered, checked or handed to the right person, and you can see all of it.")}</p>
        </div>
        <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: "36px", alignItems: "start" }}>
          <div role="group" aria-label={t("What the AI does")} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button type="button" onClick={v.goOps0} aria-pressed={v.ob0On} style={{ position: "relative", overflow: "hidden", display: "block", width: "100%", boxSizing: "border-box", padding: "15px 18px 17px", border: `1px solid ${v.ob0Line}`, borderRadius: "16px", background: v.ob0Bg, color: "var(--gc-cream)", textAlign: "start", cursor: "pointer", transition: "background-color 0.3s ease, border-color 0.3s ease" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "9px", background: "color-mix(in srgb, var(--gc-cream) 8%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 4.5h9.5a3 3 0 013 3v12H8a3 3 0 01-3-3v-12z" />
                    <path d="M5 16.5a3 3 0 013-3h9.5" />
                  </svg>
                </span>
                <span style={{ fontSize: "15.5px", fontWeight: "700", whiteSpace: "nowrap", color: v.ob0Title, transition: "color 0.3s ease" }}>{t("Answers from what you teach it")}</span>
              </span>
              {" "}
              <span style={{ display: "block", margin: "4px 0 0", marginInlineStart: "36px", fontSize: "13px", lineHeight: "1.5", color: v.ob0Sub, transition: "color 0.3s ease" }}>{t("Sizing, delivery and care, from your store knowledge, in Arabic or English.")}</span>
              {" "}
              {v.ob0On ? (
                <>
                  <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "18px", insetInlineEnd: "18px", bottom: "7px", height: "2px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 14%, transparent)" }}>
                    <span style={{ display: "block", height: "100%", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", animation: `${v.opsAnim} ${v.opsDur} linear both` }} />
                  </span>
                </>
              ) : null}
            </button>
            <button type="button" onClick={v.goOps1} aria-pressed={v.ob1On} style={{ position: "relative", overflow: "hidden", display: "block", width: "100%", boxSizing: "border-box", padding: "15px 18px 17px", border: `1px solid ${v.ob1Line}`, borderRadius: "16px", background: v.ob1Bg, color: "var(--gc-cream)", textAlign: "start", cursor: "pointer", transition: "background-color 0.3s ease, border-color 0.3s ease" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "9px", background: "color-mix(in srgb, var(--gc-cream) 8%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
                </span>
                <span style={{ fontSize: "15.5px", fontWeight: "700", whiteSpace: "nowrap", color: v.ob1Title, transition: "color 0.3s ease" }}>{t("Order status inside the chat")}</span>
              </span>
              {" "}
              <span style={{ display: "block", margin: "4px 0 0", marginInlineStart: "36px", fontSize: "13px", lineHeight: "1.5", color: v.ob1Sub, transition: "color 0.3s ease" }}>{t("Read-only, once the email matches the order. No refunds or edits.")}</span>
              {" "}
              {v.ob1On ? (
                <>
                  <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "18px", insetInlineEnd: "18px", bottom: "7px", height: "2px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 14%, transparent)" }}>
                    <span style={{ display: "block", height: "100%", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", animation: `${v.opsAnim} ${v.opsDur} linear both` }} />
                  </span>
                </>
              ) : null}
            </button>
            <button type="button" onClick={v.goOps2} aria-pressed={v.ob2On} style={{ position: "relative", overflow: "hidden", display: "block", width: "100%", boxSizing: "border-box", padding: "15px 18px 17px", border: `1px solid ${v.ob2Line}`, borderRadius: "16px", background: v.ob2Bg, color: "var(--gc-cream)", textAlign: "start", cursor: "pointer", transition: "background-color 0.3s ease, border-color 0.3s ease" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "9px", background: "color-mix(in srgb, var(--gc-cream) 8%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <rect x="3.5" y="5" width="17" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="M20.5 15.5l-5-5-9 8.5" />
                  </svg>
                </span>
                <span style={{ fontSize: "15.5px", fontWeight: "700", whiteSpace: "nowrap", color: v.ob2Title, transition: "color 0.3s ease" }}>{t("Photos read, hard cases handed off")}</span>
              </span>
              {" "}
              <span style={{ display: "block", margin: "4px 0 0", marginInlineStart: "36px", fontSize: "13px", lineHeight: "1.5", color: v.ob2Sub, transition: "color 0.3s ease" }}>{t("The AI describes the photo and hands off with the reason. Your team gets an email.")}</span>
              {" "}
              {v.ob2On ? (
                <>
                  <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "18px", insetInlineEnd: "18px", bottom: "7px", height: "2px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 14%, transparent)" }}>
                    <span style={{ display: "block", height: "100%", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", animation: `${v.opsAnim} ${v.opsDur} linear both` }} />
                  </span>
                </>
              ) : null}
            </button>
            <button type="button" onClick={v.goOps3} aria-pressed={v.ob3On} style={{ position: "relative", overflow: "hidden", display: "block", width: "100%", boxSizing: "border-box", padding: "15px 18px 17px", border: `1px solid ${v.ob3Line}`, borderRadius: "16px", background: v.ob3Bg, color: "var(--gc-cream)", textAlign: "start", cursor: "pointer", transition: "background-color 0.3s ease, border-color 0.3s ease" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span aria-hidden="true" style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "9px", background: "color-mix(in srgb, var(--gc-cream) 8%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ display: "inline-flex" }}>
                    <span aria-hidden="true" style={{ width: "16px", height: "16px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", background: "var(--gc-cream)", color: "var(--gc-ink)", border: "2px solid var(--gc-panel-dark)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: "800" }}>O</span>
                    <span aria-hidden="true" style={{ width: "16px", height: "16px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", background: "var(--gc-cream-muted)", color: "var(--gc-ink)", border: "2px solid var(--gc-panel-dark)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: "800", marginInlineStart: "-5px" }}>N</span>
                  </span>
                </span>
                <span style={{ fontSize: "15.5px", fontWeight: "700", whiteSpace: "nowrap", color: v.ob3Title, transition: "color 0.3s ease" }}>{t("Your team takes over")}</span>
              </span>
              {" "}
              <span style={{ display: "block", margin: "4px 0 0", marginInlineStart: "36px", fontSize: "13px", lineHeight: "1.5", color: v.ob3Sub, transition: "color 0.3s ease" }}>{t("Assign it, add a private note, reply with a saved answer. The AI steps back.")}</span>
              {" "}
              {v.ob3On ? (
                <>
                  <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: "18px", insetInlineEnd: "18px", bottom: "7px", height: "2px", borderRadius: "2px", overflow: "hidden", background: "color-mix(in srgb, var(--gc-cream) 14%, transparent)" }}>
                    <span style={{ display: "block", height: "100%", background: "var(--gc-cream)", transformOrigin: "var(--gc-start) center", animation: `${v.opsAnim} ${v.opsDur} linear both` }} />
                  </span>
                </>
              ) : null}
            </button>
          </div>
          <div role="img" aria-label={t("Animated demo of support run by the AI and your team: questions answered from store knowledge, order status looked up read-only, a photo described and handed to the team with the reason, and a teammate taking over with a private note and a saved reply.")} style={{ position: "relative", height: "450px", boxSizing: "border-box", borderRadius: "26px", border: "1px solid color-mix(in srgb, var(--gc-cream) 10%, transparent)", background: "var(--gc-panel-dark)", overflow: "hidden" }}>
            <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-10%", top: "-40%", width: "70%", height: "90%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--gc-cream) 7%, transparent), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", insetInlineStart: "24px", top: "26px", width: "776px", height: "254px" }}>
              <svg aria-hidden="true" width="776" height="254" viewBox="0 0 776 254" style={{ position: "absolute", insetInlineStart: "0", top: "0", overflow: "visible" }} className="rtl:-scale-x-100">
                <path d="M75,104 C75,140 75,142 75,178" pathLength="100" fill="none" stroke={v.oeChatAiBase} strokeWidth="1.6" strokeDasharray={v.oeChatAiDash} opacity={v.oeChatAiOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M75,104 C75,140 75,142 75,178" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeChatAiFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M150,210 C182,210 176,32 208,32" pathLength="100" fill="none" stroke={v.oeAiKnowBase} strokeWidth="1.6" strokeDasharray={v.oeAiKnowDash} opacity={v.oeAiKnowOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M150,210 C182,210 176,32 208,32" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeAiKnowFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M150,210 C182,210 176,127 208,127" pathLength="100" fill="none" stroke={v.oeAiOrderBase} strokeWidth="1.6" strokeDasharray={v.oeAiOrderDash} opacity={v.oeAiOrderOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M150,210 C182,210 176,127 208,127" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeAiOrderFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M150,210 C182,210 176,222 208,222" pathLength="100" fill="none" stroke={v.oeAiPhotoBase} strokeWidth="1.6" strokeDasharray={v.oeAiPhotoDash} opacity={v.oeAiPhotoOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M150,210 C182,210 176,222 208,222" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeAiPhotoFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M358,32 C390,32 384,80 416,80" pathLength="100" fill="none" stroke={v.oeKnowAnswerBase} strokeWidth="1.6" strokeDasharray={v.oeKnowAnswerDash} opacity={v.oeKnowAnswerOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M358,32 C390,32 384,80 416,80" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeKnowAnswerFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M358,127 C390,127 384,80 416,80" pathLength="100" fill="none" stroke={v.oeOrderAnswerBase} strokeWidth="1.6" strokeDasharray={v.oeOrderAnswerDash} opacity={v.oeOrderAnswerOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M358,127 C390,127 384,80 416,80" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeOrderAnswerFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M358,222 L416,222" pathLength="100" fill="none" stroke={v.oePhotoHandBase} strokeWidth="1.6" strokeDasharray={v.oePhotoHandDash} opacity={v.oePhotoHandOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M358,222 L416,222" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oePhotoHandFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M566,80 L624,80" pathLength="100" fill="none" stroke={v.oeAnswerClosedBase} strokeWidth="1.6" strokeDasharray={v.oeAnswerClosedDash} opacity={v.oeAnswerClosedOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M566,80 L624,80" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeAnswerClosedFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M566,222 L624,222" pathLength="100" fill="none" stroke={v.oeHandInboxBase} strokeWidth="1.6" strokeDasharray={v.oeHandInboxDash} opacity={v.oeHandInboxOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M566,222 L624,222" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeHandInboxFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
                <path d="M699,190 C699,150 491,156 491,112" pathLength="100" fill="none" stroke={v.oeInboxAnswerBase} strokeWidth="1.6" strokeDasharray={v.oeInboxAnswerDash} opacity={v.oeInboxAnswerOp} style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }} />
                <path d="M699,190 C699,150 491,156 491,112" pathLength="100" fill="none" stroke="var(--gc-cream)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="16 200" strokeDashoffset="16" style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--gc-cream) 85%, transparent))", animation: `${v.oeInboxAnswerFlow} 0.8s cubic-bezier(0.45, 0, 0.2, 1) both` }} />
              </svg>
              <div style={{ position: "absolute", insetInlineStart: "0px", top: "40px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onChatLine}`, background: v.onChatBg, color: v.onChatFg, opacity: v.onChatOp, boxShadow: v.onChatSh, transform: `scale(${v.onChatS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                  </svg>
                  {t("Store Chat")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onChatSubFg, transition: "color 0.35s ease" }}>{v.onChatSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "0px", top: "178px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onAiLine}`, background: v.onAiBg, color: v.onAiFg, opacity: v.onAiOp, boxShadow: v.onAiSh, transform: `scale(${v.onAiS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                {v.onAiRing ? (
                  <>
                    <span aria-hidden="true" style={{ position: "absolute", inset: "-1px", borderRadius: "15px", border: "1px solid color-mix(in srgb, var(--gc-cream) 70%, transparent)", animation: "gcs-halo 1.6s ease-out infinite", pointerEvents: "none" }} />
                  </>
                ) : null}
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <span aria-hidden="true" style={{ width: "18px", height: "18px", flexShrink: "0", boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></svg>
                  </span>
                  {t("AI agent")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onAiSubFg, transition: "color 0.35s ease" }}>{v.onAiSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "208px", top: "0px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onKnowLine}`, background: v.onKnowBg, color: v.onKnowFg, opacity: v.onKnowOp, boxShadow: v.onKnowSh, transform: `scale(${v.onKnowS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M5 4.5h9.5a3 3 0 013 3v12H8a3 3 0 01-3-3v-12z" />
                    <path d="M5 16.5a3 3 0 013-3h9.5" />
                  </svg>
                  {t("Store knowledge")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onKnowSubFg, transition: "color 0.35s ease" }}>{v.onKnowSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "208px", top: "95px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onOrderLine}`, background: v.onOrderBg, color: v.onOrderFg, opacity: v.onOrderOp, boxShadow: v.onOrderSh, transform: `scale(${v.onOrderS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_SHOPIFY} /></svg>
                  {t("Shopify orders")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onOrderSubFg, transition: "color 0.35s ease" }}>{v.onOrderSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "208px", top: "190px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onPhotoLine}`, background: v.onPhotoBg, color: v.onPhotoFg, opacity: v.onPhotoOp, boxShadow: v.onPhotoSh, transform: `scale(${v.onPhotoS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <rect x="3.5" y="5" width="17" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="M20.5 15.5l-5-5-9 8.5" />
                  </svg>
                  {t("Photo reader")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onPhotoSubFg, transition: "color 0.35s ease" }}>{v.onPhotoSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "416px", top: "48px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onAnswerLine}`, background: v.onAnswerBg, color: v.onAnswerFg, opacity: v.onAnswerOp, boxShadow: v.onAnswerSh, transform: `scale(${v.onAnswerS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M9.5 8L5 12l4.5 4" />
                    <path d="M5 12h9a5 5 0 015 5v1" />
                  </svg>
                  {t("Answer in chat")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onAnswerSubFg, transition: "color 0.35s ease" }}>{v.onAnswerSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "416px", top: "190px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onHandLine}`, background: v.onHandBg, color: v.onHandFg, opacity: v.onHandOp, boxShadow: v.onHandSh, transform: `scale(${v.onHandS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <path d="M3.5 12h8" />
                    <path d="M8.5 8.5L12 12l-3.5 3.5" />
                    <circle cx="17.5" cy="9" r="2.6" />
                    <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
                  </svg>
                  {t("Hand off")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onHandSubFg, transition: "color 0.35s ease" }}>{v.onHandSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "624px", top: "48px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onClosedLine}`, background: v.onClosedBg, color: v.onClosedFg, opacity: v.onClosedOp, boxShadow: v.onClosedSh, transform: `scale(${v.onClosedS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M8.5 12.2l2.4 2.4 4.8-5" />
                  </svg>
                  {t("Closed by AI")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onClosedSubFg, transition: "color 0.35s ease" }}>{v.onClosedSub}</span>
              </div>
              <div style={{ position: "absolute", insetInlineStart: "624px", top: "190px", width: "150px", height: "64px", boxSizing: "border-box", padding: "10px 11px", borderRadius: "15px", border: `1px solid ${v.onInboxLine}`, background: v.onInboxBg, color: v.onInboxFg, opacity: v.onInboxOp, boxShadow: v.onInboxSh, transform: `scale(${v.onInboxS})`, transition: "background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.45s ease, opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "calc(11px + 1.5px * var(--gc-ls, 1))", fontWeight: "700", whiteSpace: "nowrap" }}>
                  <span aria-hidden="true" style={{ display: "inline-flex" }}>
                    <span style={{ width: "16px", height: "16px", boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "8.5px", fontWeight: "800", background: "inherit" }}>O</span>
                    <span style={{ width: "16px", height: "16px", boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "8.5px", fontWeight: "800", background: "inherit", marginInlineStart: "-5px" }}>N</span>
                  </span>
                  {t("Team inbox")}
                </span>
                {" "}
                <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", lineHeight: "1.3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: v.onInboxSubFg, transition: "color 0.35s ease" }}>{v.onInboxSub}</span>
              </div>
            </div>
            <div style={{ position: "absolute", insetInlineStart: "24px", insetInlineEnd: "24px", bottom: "22px" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                <div style={{ padding: "13px 16px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" />
                    </svg>
                    {t("Conversations")}
                  </span>
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "25px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc0Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc0}</span>
                </div>
                <div style={{ padding: "13px 16px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></svg>
                    {t("Closed by AI")}
                  </span>
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "25px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc1Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc1}</span>
                </div>
                <div style={{ padding: "13px 16px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <path d="M3.5 12h8" />
                      <path d="M8.5 8.5L12 12l-3.5 3.5" />
                      <circle cx="17.5" cy="9" r="2.6" />
                      <path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" />
                    </svg>
                    {t("Handed to your team")}
                  </span>
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "25px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc2Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc2}</span>
                </div>
                <div style={{ padding: "13px 16px", borderRadius: "14px", background: "color-mix(in srgb, var(--gc-cream) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--gc-cream) 8%, transparent)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "color-mix(in srgb, var(--gc-cream) 64%, transparent)", whiteSpace: "nowrap" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: "0" }}>
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                    {t("Waiting now")}
                  </span>
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "25px", fontWeight: "700", letterSpacing: "calc(-0.02em * var(--gc-ls, 1))", fontVariantNumeric: "tabular-nums", transformOrigin: "var(--gc-start) center", animation: `${v.oc3Anim} 0.55s cubic-bezier(0.22, 1, 0.36, 1)` }}>{v.oc3}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ margin: "14px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", fontSize: "12.5px", lineHeight: "1.5", color: "color-mix(in srgb, var(--gc-cream) 58%, transparent)" }}>
          <p style={{ margin: "0" }}>
            {t(v.managedSetup ? "Demo data. Order status needs read access to your store's orders. Setup, tuning and ongoing care are part of the service." : "Demo data. Order status needs read access to your store's orders.")}
          </p>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--gc-cream)", border: "1px solid color-mix(in srgb, var(--gc-cream) 28%, transparent)", background: "color-mix(in srgb, var(--gc-cream) 6%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_N8N} /></svg>
              {t("n8n")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "24px", padding: "0 9px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap", color: "var(--gc-cream)", border: "1px solid color-mix(in srgb, var(--gc-cream) 28%, transparent)", background: "color-mix(in srgb, var(--gc-cream) 6%, transparent)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: "0" }}><path d={D_HUBSPOT} /></svg>
              {t("HubSpot")}
            </span>
            <span>{t("Custom steps, built during setup")}</span>
          </span>
        </div>
      </div>
    </>
  );
}
