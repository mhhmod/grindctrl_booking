# Privacy Policy (Draft)

> **DRAFT. Not legal advice. Not published.**
> This document has not been reviewed by a lawyer and is not live on the site. Review with a qualified lawyer (Egypt, and EU/US counsel if we knowingly serve merchants or shoppers there) before publishing anything based on it. Every factual statement below was checked against the current codebase and production configuration on 2026-09-17; re-verify before publishing if the product has changed since.

## Open questions for the owner

These need an owner decision or legal input before this can be published. They are called out again inline where relevant.

1. **Store Chat conversation retention.** There is no code-enforced retention window or deletion job for `widget_visitors`, conversations, or messages (unlike try-on results, which auto-delete). How long should this data be kept, and should a cleanup job be built to match whatever policy we publish?
2. **Account deletion process.** There is no self-service "delete my account" flow for merchants today. Do we want to build one, or handle deletion requests manually by email? What is the target turnaround time?
3. **Governing law and dispute forum.** This draft proposes Egypt. Confirm, or specify EU/US carve-outs if we sign merchants there.
4. **International data transfers.** Our sub-processors (OpenRouter, Groq, Supabase, Clerk, Upstash, Sentry, PostHog) may process data outside Egypt. We have not mapped their server locations or transfer mechanisms (e.g., SCCs). Needed before we can make any GDPR transfer claim.
5. **Legal basis for shopper data processing under GDPR/other regimes**, if we knowingly serve EU or other regulated shoppers through merchant storefronts. Today the product does not check shopper location.
6. **Children's use.** There is no age gate anywhere in the product (try-on, Store Chat, or dashboard). Decide the minimum age policy and whether an age gate or a "not directed at children" statement is legally sufficient for our markets.
7. **Merchant data controller/processor roles.** This draft states our proposed role split (processor for shopper data collected through a merchant's store, controller for merchant account data) as the closest fit to how the product actually works. Confirm this is the position we want to take contractually, since it drives whether we owe merchants a formal Data Processing Agreement (the security page already states no DPA exists yet).
8. **OpenRouter's and Groq's own data retention and training-use terms.** We have not independently reviewed their policies or DPAs. Needed before we can make any claim about what happens to a shopper's photo or chat content once it leaves our servers.
9. **Refund and dispute handling** is not addressed in this policy (see the Terms of Service draft) but may need a cross-reference once decided.
10. **Do we want a cookie consent banner beyond the existing analytics opt-in control?** Today there is no cookie banner; the analytics consent control on the marketing site is the only consent mechanism.

---

## 1. Who we are

Grind CTRL ("**GrindCTRL**," "we," "us," or "our") is a business registered in Egypt. We build and operate an AI-powered virtual try-on and customer chat product for Shopify merchants, available at grindctrl.cloud and as a Shopify app.

Contact for privacy questions: **grindctrlnow@gmail.com**

## 2. Who this policy covers

This policy applies to two different groups of people, and our role is different for each:

- **Merchants**: businesses that sign up for a GrindCTRL account, install our Shopify app, and use our dashboard. For merchant account data (sign-in identity, workspace settings, billing conversations), **we act as the controller**: we decide how that data is used to run and improve the service.
- **Shoppers**: people who visit a merchant's storefront and use the try-on widget or Store Chat embedded there. For data a shopper gives us through a merchant's storefront (a photo, a chat message, contact details), **we act as a processor / service provider on the merchant's behalf**: the merchant controls that relationship and is responsible for their own privacy notice to their shoppers. *(This role split is our draft position and has not been reviewed by a lawyer or formalized in a merchant contract; see Open Question 7.)*

## 3. Information we collect

### 3.1 From merchants (dashboard and Shopify app)

- **Account identity**: a Clerk-issued user ID and the email address linked to it, used to sign you into the dashboard.
- **Workspace and store data**: your store's domain, connected Shopify shop, workspace settings, and the plan/credit balance on your account.
- **Shopify Admin API access token**: issued when you install our Shopify app, stored encrypted at rest (AES-256-GCM), and used only to operate the app for your store.
- **Support and configuration content you enter**: Store Chat knowledge-base articles, saved replies, and any URLs you submit for us to import as knowledge.
- **Communications with us**, if you email us or book a call.

### 3.2 From shoppers (on a merchant's storefront)

**Try-on:**
- **The photo you upload** for a try-on. This photo is sent directly to our AI image provider to generate the preview and is **not stored on our servers**.
- **The generated try-on result image**, kept for up to 30 minutes and then automatically deleted by a cleanup job that runs every 10 minutes.

**Store Chat:**
- **Your messages** in the chat, and **your name and email** if you provide them (for example, to look up an order).
- **Image attachments** you send in chat, which may be sent to our AI provider for handling.
- **Order lookups**: if you are signed in to the merchant's store, your verified Shopify customer identity is used automatically to look up your orders. If you are not signed in, we ask for your order number and email to verify you before showing order details.
- Conversation history tied to your visitor record on that store.

**Note on retention:** unlike try-on photos and results, we do not currently have an automated retention or deletion schedule for Store Chat visitor records, conversations, and messages. This is Open Question 1.

### 3.3 Collected automatically

- **Error and performance data** (via Sentry), for every visitor, to keep the app working. Authentication tokens embedded in page URLs are stripped before this data is sent.
- **Product analytics** (via PostHog), only after you actively consent. The default is off. Analytics events describe behavior (for example, which step of try-on you reached) and do not include your photo, message text, email, or phone number.
- **Rate-limiting data** (via Upstash): your IP address and a request identifier, used only to enforce usage limits and rejected safely if the limiter itself is unavailable.

## 4. How we use information

- To provide the try-on and Store Chat features you or your shoppers use.
- To operate merchant accounts: authentication, workspace access, plan and credit tracking, and support.
- To detect and prevent abuse, and to keep the service available (rate limiting, error monitoring).
- To respond to Shopify's mandatory privacy webhooks on a merchant's behalf (see section 7).
- To improve the product, using analytics only where a visitor has consented.
- To communicate with merchants about their account, billing, or support requests.

We do not sell personal data. We do not use shopper photos, chat content, or order data for advertising.

## 5. Service providers that process data on our behalf

This list matches the one published at [grindctrl.cloud/security](https://grindctrl.cloud/security) and reflects what is actually wired into the product today.

| Provider | What it does | What it receives |
|---|---|---|
| OpenRouter | AI image generation | The shopper's try-on photo and garment image; image attachments sent in Store Chat |
| Groq | AI chat and voice | Conversation text and voice audio for chat replies, speech-to-text, and text-to-speech. Never receives photos. |
| Supabase | Database and file storage | Operational, support, and try-on result data, behind service-role-only access |
| Clerk | Merchant sign-in | Account email and identity used for dashboard authentication |
| Gmail SMTP | Email delivery | Account emails, team notifications, and privacy-request alerts |
| Sentry | Error and performance monitoring | Error reports, stack traces, and page addresses, with sign-in tokens removed |
| PostHog | Product analytics | Usage events, only after consent |
| Upstash | Rate limiting | Requester IP address and request keys |
| Hostinger | Application hosting | All traffic to the site and app runs through it |

We have not independently reviewed OpenRouter's or Groq's own data-retention or training-use terms (Open Question 8). We do not have signed Data Processing Agreements with merchants at this time.

## 6. Data retention

| Data | Retention |
|---|---|
| Try-on uploaded photo | Not stored; sent directly to our AI provider and discarded |
| Try-on generated result | Up to 30 minutes, then automatically deleted (cleanup runs every 10 minutes) |
| Try-on result access links | Signed links valid for up to 5 minutes |
| Store Chat visitor records, conversations, messages | To be confirmed (Open Question 1) |
| Merchant account and workspace data | Kept for the life of the account; removed on request or as required by section 7 |
| Billing and transaction (credit ledger) records | Retained; these records cannot be deleted or altered, kept for accounting and legal purposes |
| Error monitoring data (Sentry) | Governed by Sentry's own retention settings; to be confirmed |

## 7. Shopper photos

Your try-on photo is sent directly to our AI image provider to generate the preview. We do not store the uploaded photo on our own servers at any point. Only the generated result image is temporarily stored, for up to 30 minutes, and only ever reachable through a short-lived signed link tied to your session. It is never given a public URL.

## 8. Cookies and consent

- **Essential**: signing in to the dashboard uses authentication cookies set by our sign-in provider (Clerk) to keep you signed in. These are required for the dashboard to work and are not used for tracking.
- **Analytics**: off by default. No analytics events or analytics cookies are collected until a visitor actively opts in on the marketing site. You can change this choice at any time using the analytics control in the site footer.
- **Error monitoring**: runs for every visitor, independent of the analytics choice, to help us detect and fix problems. It does not collect personal content and strips authentication tokens from any URL before sending.

## 9. Shopify privacy requests

We receive Shopify's three mandatory privacy webhooks. Each one is signature-verified and durably recorded the moment it arrives, and our team is alerted by email.

- **Customer data request**: we compile the records we hold on that customer (matched Store Chat visitor, conversations, messages) and send them to the merchant, who is responsible for responding to the shopper, as Shopify's process requires.
- **Customer redact**: we delete that customer's matched visitor record, their conversations, and any uploaded attachments.
- **Shop redact** (after a merchant uninstalls): we remove the store's operational data (try-on jobs and settings, subscriptions, stored Shopify access token, chat widget sites, and chat attachments). We keep billing and transaction records, which cannot be deleted, for accounting and legal purposes.

**Current status: these requests are recorded automatically but fulfilled manually.** Automated fulfillment exists in our code but is switched off in production today; our team completes each request by hand after it is recorded and alerted.

## 10. Your rights

Depending on where you are, you may have rights to access, correct, delete, or export your personal data, or to object to or restrict certain processing. To exercise any of these rights, email **grindctrlnow@gmail.com**. If you are a shopper on a merchant's store, we may direct your request to that merchant, consistent with our processor role described in section 2, unless we are required to handle it directly.

We have not yet mapped which specific regional rights regimes (GDPR, CCPA, Egypt's data protection law, or others) apply to which of our users; see Open Questions 3 to 5.

## 11. Security

We describe our technical and organizational safeguards, including tenant isolation, encryption of Shopify access tokens, rate limiting, and release verification, in detail at [grindctrl.cloud/security](https://grindctrl.cloud/security). That page also states plainly what is not yet in place, including that we do not have an independent security certification or audit, and do not yet have a customer-facing Data Processing Agreement.

## 12. International data transfers

Our service providers may process data outside Egypt. We have not yet mapped where each provider processes and stores data, or what transfer safeguards (such as EU Standard Contractual Clauses) apply. This section will be completed before publishing if we serve merchants or shoppers in a jurisdiction that requires it (Open Question 4).

## 13. Children's privacy

GrindCTRL is intended for use by businesses and their adult customers, not by children. We do not knowingly collect personal data from children, and our product does not include an age verification step today (Open Question 6).

## 14. Changes to this policy

We may update this policy as the product changes. We will update the "last updated" date below when we do. Material changes affecting shopper data processed on a merchant's behalf will also be communicated to merchants.

## 15. Contact us

Grind CTRL, Egypt
Email: grindctrlnow@gmail.com

---

**Last updated:** [DATE, to be set on publish]
