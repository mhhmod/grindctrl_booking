/* Generated from the v15 prototype markup (docs/handoff/site-v15/design/
   prototype/boards/Scroll.dc.html). Sizes, spacing and timings are the
   prototype's own; colours are mapped to tokens, left and right to logical
   properties, and every visible string goes through the story's typed
   string table. Edited by hand from here on. */

import * as React from 'react';
import type { V, ViewProps } from '../story-types';

export function PhoneChat({ v, t }: ViewProps) {
  return (
    <>
      <div data-reveal="" style={{ textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", height: "26px", padding: "0 11px", borderRadius: "26px", border: "1px solid var(--border)", background: "var(--gc-chip)", fontSize: "11.5px", fontWeight: "600" }}>{t("Store Chat")}</span>
        <h2 id="chat-title" style={{ margin: "14px 0 0", fontSize: "32px", lineHeight: "1.12", fontWeight: "700", letterSpacing: "calc(-0.035em * var(--gc-ls, 1))" }}>{t("Ask the store")}</h2>
        <p style={{ margin: "10px 0 0", fontSize: "15.5px", lineHeight: "1.6", color: "var(--muted-foreground)" }}>{t("Answers from your store in Arabic or English, and a person from your team when it matters.")}</p>
      </div>
      <div data-reveal="" style={{ marginTop: "24px" }}>
        <section aria-label={t("Store Chat demo")} style={{ boxSizing: "border-box", borderRadius: "24px", border: "1px solid var(--border)", background: "color-mix(in srgb, var(--card) 94%, transparent)", boxShadow: "0 44px 90px -44px color-mix(in srgb, var(--foreground) 50%, transparent), 0 2px 6px color-mix(in srgb, var(--foreground) 5%, transparent)", display: "flex", flexDirection: "column", minWidth: "0", overflow: "hidden", height: "520px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 14px", borderBottom: "1px solid var(--secondary)" }}>
            <span style={{ width: "34px", height: "34px", flexShrink: "0", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800" }}>{t("G")}</span>
            <span style={{ flexGrow: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700" }}>{t("GrindCTRL demo store")}</span>
              <span dir={v.chatDir} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--muted-foreground)", fontFamily: v.chatFont }}>
                <span style={{ position: "relative", width: "6px", height: "6px", flexShrink: "0", borderRadius: "50%", background: "var(--foreground)" }}>
                  <span aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "var(--foreground)", opacity: "0", animation: "gcs-ping 2.4s ease-out 0s infinite" }} />
                </span>
                {v.chatNotice}
              </span>
            </span>
            <span role="group" aria-label={t("Chat language")} style={{ display: "flex", gap: "2px", padding: "3px", borderRadius: "999px", background: "var(--secondary)" }}>
              <button type="button" onClick={v.setEn} aria-pressed={v.isEn} style={{ height: "36px", minWidth: "44px", padding: "0 10px", borderRadius: "999px", border: "0", background: v.enBg, color: v.enFg, fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "background-color 0.2s ease, color 0.2s ease" }}>{t("EN")}</button>
              <button type="button" lang="ar" onClick={v.setAr} aria-pressed={v.isAr} style={{ height: "36px", minWidth: "44px", padding: "0 10px", borderRadius: "999px", border: "0", background: v.arBg, color: v.arFg, fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "background-color 0.2s ease, color 0.2s ease" }}>عربي</button>
            </span>
          </div>
          <div dir={v.chatDir} lang={v.chatLang} aria-live="polite" style={{ flexGrow: "1", minHeight: "0", height: "330px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "8px", padding: "14px 14px 10px", overflow: "hidden", fontFamily: v.chatFont, fontSize: "12.5px", lineHeight: "1.5" }}>
            {v.chatEmpty ? (
              <>
                <p style={{ margin: "auto 0 0", alignSelf: "center", maxWidth: "260px", textAlign: "center", fontSize: "12.5px", color: "var(--muted-foreground)", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{v.chatIntro}</p>
              </>
            ) : null}
            {v.thread.map((m: V, i: number) => (
              <React.Fragment key={i}>
                {m.isUser ? (
                  <>
                    <p style={{ margin: "0", alignSelf: "flex-end", maxWidth: "84%", padding: "9px 12px", borderRadius: "14px", borderEndEndRadius: "5px", background: "var(--foreground)", color: "var(--background)", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{m.text}</p>
                  </>
                ) : null}
                {m.isBot ? (
                  <>
                    <div style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", gap: "4px", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", color: "var(--muted-foreground)" }}>{m.label}</span>
                      <p style={{ margin: "0", padding: "9px 12px", borderRadius: "14px", borderEndStartRadius: "5px", border: "1px solid var(--border)", background: m.bg, color: "var(--foreground)" }}>{m.text}</p>
                    </div>
                  </>
                ) : null}
                {m.isSystem ? (
                  <>
                    <p style={{ margin: "2px 0", alignSelf: "center", fontSize: "11.5px", color: "var(--muted-foreground)", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{m.text}</p>
                  </>
                ) : null}
                {m.isHandoff ? (
                  <>
                    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px", borderRadius: "14px", border: "1px dashed var(--border)", background: "var(--background)", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", color: "var(--muted-foreground)" }}>{m.title}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "26px", height: "26px", flexShrink: "0", borderRadius: "50%", background: "var(--foreground)", color: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800" }}>{m.initial}</span>
                        <span style={{ fontSize: "12.5px", fontWeight: "700" }}>{m.who}</span>
                      </span>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 10px", borderRadius: "24px", background: "var(--foreground)", color: "var(--background)", fontSize: "11px", fontWeight: "700" }}>{m.needs}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 10px", borderRadius: "24px", border: "1px solid var(--border)", fontSize: "11px", fontWeight: "600" }}>{m.handed}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 10px", borderRadius: "24px", border: "1px solid var(--border)", fontSize: "11px", fontWeight: "600" }}>{m.assigned}</span>
                      </span>
                    </div>
                  </>
                ) : null}
                {m.isTyping ? (
                  <>
                    <span role="status" aria-label={m.label} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "4px", padding: "12px 13px", borderRadius: "14px", borderEndStartRadius: "5px", border: "1px solid var(--border)", background: "var(--background)", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0s infinite" }} />
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.15s infinite" }} />
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--muted-foreground)", animation: "gcs-typing 1.2s ease-in-out 0.3s infinite" }} />
                    </span>
                  </>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          <div dir={v.chatDir} style={{ minHeight: "98px", display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "6px", padding: "10px 14px 6px", borderTop: "1px solid var(--secondary)" }}>
            {v.chips.map((c: V, i: number) => (
              <React.Fragment key={i}>
                <button type="button" onClick={c.go} style={{ minHeight: "44px", padding: "0 13px", borderRadius: "999px", border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontFamily: v.chatFont, fontSize: "12px", fontWeight: "600", cursor: "pointer", animation: "gcs-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both" }}>{c.label}</button>
              </React.Fragment>
            ))}
          </div>
          <p dir={v.chatDir} style={{ margin: "0", padding: "6px 14px 12px", fontSize: "11px", color: "var(--muted-foreground)", fontFamily: v.chatFont }}>{v.chatPowered}</p>
        </section>
      </div>
    </>
  );
}
