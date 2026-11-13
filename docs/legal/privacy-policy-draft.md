# Privacy policy

Published at /privacy on 2026-11-12; this document remains the English source for the EN/AR copy in apps/web-next/components/marketing/legal-copy.ts.

How Grind CTRL handles merchant and shopper information, privacy requests, and retention.

## 1. Who we are

Grind CTRL ("GrindCTRL", "we", "us", or "our") operates an AI-powered virtual try-on and customer chat product from Egypt, available at grindctrl.cloud, through Shopify apps and a WooCommerce plugin, and through pasted Store Chat code on other websites.

Grind CTRL is the privacy operator. Contact us about privacy at grindctrlnow@gmail.com.

## 2. Who this policy covers

For merchant account data, including sign-in identity, workspace settings, and billing communications, we act as the controller. We decide how this information is used to operate the service.

For shopper data collected through a merchant’s storefront, including photos, chat messages, and contact details, we act as a processor or service provider on the merchant’s behalf. The merchant controls the relationship with their shoppers and is responsible for their own privacy notice and lawful basis for processing.

## 3. Information we collect

- Merchant account identity: your Clerk-issued user ID and account email, used to sign you in.
- Workspace and store information: store domain, connected Shopify shop, WooCommerce or pasted-code site connection, workspace settings, plan, and credit balance.
- Shopify Admin API access tokens: issued on installation, encrypted at rest using AES-256-GCM, and used to operate the app for your store.
- Content you provide: Store Chat knowledge articles, saved replies, URLs submitted for knowledge imports, and communications when you email us or book a call.
- Try-on photos: your uploaded photo is sent to the AI image provider to generate a preview. We do not store the uploaded photo on our servers. Generated results are stored temporarily under the retention rules below.
- Store Chat: messages, conversation history, image attachments, captured leads, and contact details you provide. Attachments may be sent to our AI provider for handling.
- Order lookups: a signed-in shopper’s verified Shopify or WooCommerce customer identity is used to look up their orders. Otherwise, order number and email are requested to verify the shopper before showing order details.
- Error and performance data: Sentry receives error reports and page addresses to help keep the service working. Authentication tokens in page URLs are stripped before transmission.
- Product analytics: PostHog receives usage events only after active consent. Events do not include photos, message text, email addresses, or phone numbers.
- Rate limiting: Upstash processes requester IP addresses and request identifiers to enforce usage limits. Requests are denied if the limiter is unavailable.
- Abuse checks: where required for free try-on requests, Cloudflare Turnstile processes challenge tokens, request identifiers, and requester IP addresses when provided.

## 4. How we use information

We do not sell personal data or use shopper photos, chat content, or order data for advertising.

- Provide virtual try-on, Store Chat, and merchant account features.
- Manage authentication, workspace access, plans, credits, and support.
- Detect abuse and keep the service available through rate limiting and error monitoring.
- Respond to Shopify privacy requests on the merchant’s behalf.
- Improve the product using analytics only when a visitor has consented.
- Communicate with merchants about accounts, billing, and support.

## 5. Service providers

The following providers support the service. We have not independently reviewed OpenRouter’s or Groq’s own data-retention or training-use terms. We do not have signed Data Processing Agreements with merchants at this time.

- OpenRouter and the model providers it routes requests to: AI image generation, Store Chat text replies, and image understanding. Receive the shopper’s try-on photo and garment image, conversation text and relevant store knowledge, and image attachments sent in Store Chat, as needed for the feature used.
- Groq: AI assistant chat and voice, and fallback Store Chat text replies when OpenRouter is unavailable. Receives conversation text and voice audio for replies, speech-to-text, and text-to-speech, not photos.
- Supabase: database and file storage for operational, support, and generated result data, accessed through server-side controls.
- Clerk: merchant sign-in, account email, and authentication identity.
- SMTP email transport (Gmail SMTP by default, configurable by the operator): account emails, team notifications, privacy-request alerts, and customer data exports sent to the privacy operator for delivery to the merchant.
- Sentry: error reports, stack traces, and page addresses with sign-in tokens removed.
- PostHog: product usage events after consent.
- Upstash: requester IP addresses and request keys for rate limiting.
- Hostinger: application hosting. Site and app traffic passes through its infrastructure.
- Cloudflare Turnstile: abuse prevention for free try-on requests. Receives challenge tokens, request identifiers, and requester IP addresses when provided.

## 6. Data retention

- Uploaded try-on photos are not stored on our servers. Provider retention is not yet independently confirmed.
- Generated try-on results are deleted when your browser has received them. Otherwise they remain readable for at most 10 minutes, with remaining files deleted by a cleanup job that runs every 10 minutes. Signed result links are valid for up to 5 minutes.
- Store Chat conversations, messages, and attachments are deleted 12 months after the conversation’s last activity. Visitor records without remaining conversations are deleted after 12 months of inactivity.
- Captured leads, including names and contact details, are deleted 12 months after creation, or earlier when their linked conversation is deleted.
- Disconnecting a pasted-code store disables its widgets and schedules deletion of its shopper data after 30 days. Reconnecting before deletion cancels that schedule. Billing and credit ledger records and their required accounting links are retained; stored images and attachments are removed by the cleanup process.
- Merchant account and workspace information is kept for the life of the account. Request account deletion by email to grindctrlnow@gmail.com. We complete account deletion within 30 days, subject to records that must be retained by law.
- Billing and credit ledger records are kept for as long as accounting law requires and are never altered by privacy deletion. Job or subscription records needed to preserve their accounting links are retained for that purpose; generated images are removed.
- Sentry retention follows the configured monitoring settings. We have not independently confirmed its retention period.

## 7. Shopper photos

Your uploaded try-on photo is sent to our AI image provider with a request to use providers that do not collect data. We do not store the upload on our own servers.

Only the generated result is stored temporarily. It is accessible through a short-lived signed link tied to your session, not a public URL, and the session lasts at most 10 minutes.

We have not confirmed whether the image provider retains your photo. A request for providers that do not collect data is not a guarantee of zero provider retention.

## 8. Cookies and consent

- Essential authentication cookies are set by Clerk to keep merchants signed in. They are required for the dashboard and are not used for tracking.
- Analytics is off by default. Analytics events and cookies start only after active opt-in on the marketing site. You can change this choice at any time using the analytics control in the footer.
- Error monitoring operates independently of analytics consent to detect and fix problems. It is configured to avoid personal content and remove authentication tokens from URLs.

## 9. Shopify privacy requests

We verify the signatures of Shopify’s mandatory privacy webhooks and durably record each request. Grind CTRL completes every Shopify privacy request within 30 days of receipt.

The operator is notified by email on receipt and reminded when a request reaches 21 days without completion. If email delivery is unavailable, the request remains pending for follow-up.

Deletion is automatic only when the store’s data has one eligible installation owner and no other app’s installation for that store is active. Shared or uncertain ownership is handled manually to protect the other app’s data.

- Customer data request: we compile the matched visitor records, conversations, and messages for that customer and shop. The export is emailed to the privacy operator to forward to the merchant, who responds to the shopper. The request remains pending delivery until the operator records delivery.
- Customer redact: we delete the customer’s matched visitor records, conversations, messages, and uploaded attachments for that shop.
- Shop redact after uninstall: we remove the store’s operational data, including eligible try-on jobs and subscriptions, settings, the stored Shopify access token, chat sites, visitors, conversations, messages, and stored attachments and result images. Billing and credit ledger records, and job or subscription records needed to preserve accounting links, are retained as described above.

## 10. Your rights and account deletion

Depending on applicable law, you may have rights to access, correct, delete, or export personal information, or to object to or restrict certain processing. Email grindctrlnow@gmail.com to exercise these rights or request account deletion. Account deletion is handled by email and completed within 30 days, subject to legally required retention.

If you are a shopper, we may direct your request to the merchant, consistent with our processor role, unless we are required to handle it directly.

We have not completed a jurisdiction-by-jurisdiction assessment of applicable privacy regimes. Nothing in this policy limits rights you have under applicable law.

## 11. Security

Our Security page describes tenant isolation, encryption of Shopify access tokens, rate limiting, and release verification.

We do not have an independent security certification or audit, or a customer-facing Data Processing Agreement. We do not claim that these are in place.

## 12. International data transfers

Our providers may process data outside Egypt. We have not completed a map of provider processing and storage locations or verified applicable transfer safeguards, including EU Standard Contractual Clauses. We do not claim that a particular international transfer mechanism has been verified.

## 13. Children’s privacy

GrindCTRL is intended for businesses and their adult customers, not children. We do not knowingly collect personal data from children. The product does not currently include age verification.

## 14. Changes to this policy

We may update this policy as the product changes and will update the date below. We will also communicate material changes affecting shopper data processed on a merchant’s behalf to merchants.

## 15. Contact us

Grind CTRL, Egypt. Privacy operator: Grind CTRL.

Email grindctrlnow@gmail.com for privacy questions, access requests, or account deletion.

**Last updated:** 2026-11-12
