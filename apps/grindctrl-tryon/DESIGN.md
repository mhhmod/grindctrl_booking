---
name: GrindCTRL Try-On Email Campaign
description: Tailored proof for fashion commerce, delivered with email-client-safe precision.
colors:
  ink-black: "#0D0C0B"
  tailored-charcoal: "#2A2826"
  paper-white: "#F7F7F5"
  pure-surface: "#FFFFFF"
  rule-gray: "#D8D8D4"
  quiet-gray: "#666663"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.12em"
rounded:
  image: "12px"
  action: "999px"
spacing:
  compact: "12px"
  content: "24px"
  section: "32px"
components:
  action-primary:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.pure-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "16px 32px"
  action-secondary:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "12px 20px"
---

# Design System: GrindCTRL Try-On Email Campaign

## Overview

**Creative North Star: "The Tailored Proof"**

The campaign should feel like a precisely cut black garment placed on clean white paper. The structure is disciplined, the typography is direct, and the approved product visual supplies the warmth and fashion context. The email interface itself remains monochrome so the product proof, not decorative UI, carries attention.

The system is premium, editorial, and precise without borrowing magazine clichés. It rejects generic SaaS gradients, nested cards, ornamental luxury styling, and browser-only effects that fail in inboxes. Every design decision must survive Gmail, Outlook, Apple Mail, desktop, mobile, and image-disabled states.

**Key Characteristics:**

- One clear column with a 600px maximum width.
- Strong black header, white reading surface, and structural gray rules.
- Original GrindCTRL logo in the header; original approved campaign image in the proof section.
- One primary response action and one quieter live-demo path.
- Email-safe HTML, inline styles, plain-text fallback, and explicit UTF-8 MIME encoding.

## Colors

The interface is monochrome; the approved campaign image is the only permitted source of cream or gold.

### Primary

- **Ink Black:** Primary header, footer, button, and high-emphasis text.
- **Tailored Charcoal:** Secondary dark text and subtle black variation where pure visual flatness would reduce hierarchy.

### Neutral

- **Paper White:** Outer canvas that separates the email from inbox chrome.
- **Pure Surface:** Main reading surface and secondary action background.
- **Rule Gray:** One-pixel dividers, image borders, and secondary action outlines.
- **Quiet Gray:** Supporting copy, preview notes, and opt-out language while maintaining WCAG AA contrast at intended sizes.

**The Monochrome Interface Rule.** No accent color appears in email UI. The original campaign image may retain its approved cream and gold palette.

**The One Black Action Rule.** Only “Reply DEMO” receives the filled black treatment. The live-demo link is outlined or textual.

## Typography

**Display Font:** Arial (with Helvetica and generic sans-serif fallbacks)
**Body Font:** Arial (with Helvetica and generic sans-serif fallbacks)

**Character:** A single email-safe sans family creates a technical, tailored voice without relying on remote fonts that may not load. Hierarchy comes from decisive size and weight contrast.

### Hierarchy

- **Display** (700, 38px, 1.1): One campaign idea only; reduce to 32px on narrow layouts when the email client supports the media query.
- **Headline** (700, 24px, 1.25): Follow-up angles and proof-section headings.
- **Body** (400, 17px, 1.65): Main copy with a practical maximum line length of approximately 68 characters.
- **Label** (700, 12px, 0.12em, uppercase): Short eyebrow labels only; never use uppercase for sentences.

**The Inbox Font Rule.** Remote web fonts are forbidden in the email. Reliable rendering is part of the brand.

## Elevation

The email is flat by default. Depth comes from high-contrast surface changes, one-pixel borders, and spacing rather than shadows. This avoids fragile CSS, keeps Outlook rendering predictable, and makes the original campaign image the visual focal point.

**The Structural Depth Rule.** If a section needs separation, use spacing or a one-pixel full-width rule. Decorative drop shadows are prohibited.

## Components

### Buttons

- **Shape:** Fully rounded action capsule (999px radius) with a minimum 48px touch height.
- **Primary:** Ink-black background, white text, 16px vertical and 32px horizontal padding. Opens a pre-addressed reply email with “DEMO” in the subject.
- **Hover / Focus:** Underline fallback in clients that strip advanced states; visible two-pixel focus outline in preview and web-rendered versions.
- **Secondary:** White surface, black text, one-pixel Rule Gray border. Opens the live demo in a browser.

### Cards / Containers

- **Corner Style:** The email body is not a stack of cards. The main 600px column uses a single outer boundary; the proof image uses a restrained 12px corner.
- **Background:** Pure Surface on Paper White.
- **Shadow Strategy:** None.
- **Border:** One-pixel Ink Black for the main frame; Rule Gray for low-emphasis separators.
- **Internal Padding:** 24px on mobile and 32px on wider clients.

### Navigation

- **Style:** No conventional navigation bar. The header contains only the correctly proportioned GrindCTRL logo and the “TRY-ON” product descriptor.
- **Mobile treatment:** Logo remains left-aligned and never shrinks below a legible width.

### Proof Image

The original approved campaign image is displayed at a fixed intrinsic width and height, scaled responsively with `width: 100%; height: auto;`. It must have meaningful alt text and a working public HTTPS source or a standards-compliant inline MIME attachment.

### Action Pair

“Reply DEMO” is visually dominant. “Open the live demo” sits beneath it as a smaller secondary path. The actions never appear side by side on mobile.

## Do's and Don'ts

### Do:

- **Do** use a 600px maximum email width and a single-column table structure.
- **Do** use the original GrindCTRL logo asset with explicit width and height.
- **Do** keep the approved campaign image unchanged while making the surrounding interface monochrome.
- **Do** encode the HTML and plain-text MIME parts as UTF-8 and test smart punctuation before sending.
- **Do** provide both “Reply DEMO” and the quieter live-demo path with distinct hierarchy.
- **Do** verify Gmail, Outlook, Apple Mail, desktop, mobile, and image-disabled rendering before activating a campaign.

### Don't:

- **Don't** use generic SaaS campaign styling with blue gradients, decorative dashboards, nested cards, or stock illustrations.
- **Don't** use luxury clichés such as excessive gold UI, ornamental serif typography, or vague prestige language.
- **Don't** ship broken or improvised email HTML, mojibake, missing images, clipped layouts, or styling that depends on unsupported browser CSS.
- **Don't** use manipulative urgency, false scarcity, “last chance” language, pricing-led outreach, or deceptive subject lines.
- **Don't** bury the one-product demo offer under dense copy or several competing primary actions.
- **Don't** use a normal Next.js webpage as the email body; render a dedicated React Email component to email-safe HTML.
