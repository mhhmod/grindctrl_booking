# Store Chat — support desk completion

**Date:** 2026-08-29
**Status:** Implemented. All four capabilities shipped 2026-08-29; see `supabase/messenger_support_desk.sql` for the schema and the new env vars. Deviations from this document are noted inline in the code they affect (JPEG segment filtering keeps the ICC profile; OAuth `state` is a signed cookie rather than a stored row; no `widget_leads` row is created because no lead-capture flag exists to enable it).
**Scope:** Four capabilities that turn Store Chat from a chat widget into a working support desk: merchant notification, AI order lookup, shopper contact capture, and attachments with AI triage.

---

## 1. Why

Store Chat shipped with the plumbing — AI answers grounded in merchant knowledge, escalation to a human, staff takeover, appearance and behaviour configuration, installation, analytics, audit, EN/AR. Three gaps stop it being usable as support:

1. **Nobody is told a shopper is waiting.** The AI escalates and the conversation sits unseen. Handoff is the feature, and it is currently a dead end.
2. **The AI cannot answer "where is my order?"** — the most common e-commerce support question. It has knowledge but no access to order data.
3. **A shopper the AI cannot help leaves with no way to be reached.**

A fourth, attachments, is included as the differentiator: competitors store a file and show it to an agent. Ours reads it.

### Success criteria

- A handoff reaches the merchant by email within a minute, and the dashboard shows a count without being refreshed.
- A shopper who proves ownership of an order gets its real status and tracking from Shopify, in their language.
- A shopper the AI could not help is asked for an email exactly once, at a moment where a reply is genuinely coming.
- A shopper photographing a damaged item gets it classified, and staff open the thread already knowing what happened.

### Non-goals

- Saved replies, conversation search, unread-per-conversation state, email transcripts, CSAT beyond 👍👎. Real gaps, separately specced later.
- Replacing the 15s staff poll with Supabase Realtime. Separate change.
- Order *mutations* of any kind — no cancels, refunds, address edits. Read-only, permanently, in this spec.
- Non-image attachments (PDF, video). Images only.

---

## 2. Decisions locked

| Question | Decision |
|---|---|
| Order data access | Per-merchant OAuth with encrypted offline access tokens; `read_orders` added to app scopes |
| Shopper proof for order data | Proxy-verified login, **or** order number + matching email; rate-limited, generic denials |
| Merchant notification | Email on handoff, throttled, plus a dashboard nav badge |
| Contact capture timing | Only on handoff, or outside business hours |
| Attachments | Images, with a vision model describing and classifying the issue |
| AI action seam | **Model proposes, server disposes** (§3) |

---

## 3. Shared foundation: the action seam

Today `generateAssistantReply` returns prose, with escalation signalled by a sentinel string. Order lookup needs the model to *request* something the server then authorizes. Attachment triage needs a second kind of model call. Both go through one seam.

**Contract.** The model may reply with prose, or with a single action line and nothing else:

```
<<GC_ACTION>>{"action":"lookup_order","order_number":"1234","email":"a@b.com"}
```

**Rules, enforced in `lib/messenger/actions.ts`:**

- Exactly **one** action per shopper turn. A second action in the same turn is discarded and the turn falls back to prose. This is the loop guard.
- The action name must be in a server-side registry. Unknown names are discarded, logged as `ai_action_rejected`, never surfaced.
- Arguments are validated server-side with the same hand-rolled `typeof`/regex style used elsewhere in `lib/messenger` (no new validation dependency).
- **The action never carries authorization.** The server re-derives who the shopper is from the conversation record and the proxy-signed token — never from the model's arguments. A model that invents `"customer_id"` gets it ignored; the field is not in the schema.
- Execution result is injected as a facts block into a second completion, which phrases the answer. The model never sees raw Shopify payloads beyond the fields §5 whitelists.

**Registry at completion of this spec:** `lookup_order` only. Attachment triage is server-initiated (§7), not model-requested, because the trigger is an upload rather than a sentence.

**Cost.** Action turns cost two completions instead of one. Only turns that actually act pay it.

**Failure.** If parsing fails, the action is rejected, or execution throws, the shopper gets one honest line ("I couldn't reach the store's order system just now") and the turn is recorded as `ai_action_failed`. Never a stack trace, never a silent empty reply.

---

## 4. Feature: merchant notification

### 4.1 Prerequisite — real merchant email

`ensureProfile` is called as `ensureProfile(clerkUserId, null)` from `listMessengerSites`, so every profile row currently stores the placeholder `user_xxx@users.noreply.clerk.dev`. Notification email cannot be sent to that.

**Change:** the dashboard page resolves the Clerk user's primary email address (`currentUser()` from `@clerk/nextjs/server`) and passes it into provisioning. `ensureProfile` upgrades a stored placeholder to a real address when one arrives, and never downgrades a real address to a placeholder.

### 4.2 Trigger

Exactly one trigger: a conversation transitions **into** `handoff_requested`. Both paths already funnel through `requestHandoff()` in `lib/messenger/conversations.ts`, so the notification keys off that single transition rather than off each call site.

`conversations.ts` stays a pure data module — it does not send email. The notification lives in `lib/messenger/notify.ts` and is invoked by a thin `escalateAndNotify()` wrapper that the send route and staff actions call instead of `requestHandoff()` directly. `requestHandoff()` returning non-null is the "I won the transition" signal, so the wrapper sends at most once by construction.

No notification for conversations the AI resolved. No notification on `handoff_active` (staff are already there).

### 4.3 Throttle

Two limits, both required:

- **Per conversation:** at most one email, ever. Enforced by a new `handoff_notified_at timestamptz` column on `widget_conversations`, set in the same guarded update that performs the transition — so two concurrent transitions cannot both send.
- **Per site:** at most 10 notification emails per rolling hour, counted from `widget_events` where `event_name = 'handoff_notified'`. On exceeding it, the email is skipped and one `handoff_notify_throttled` event is recorded. The badge still counts these; only email is suppressed.

### 4.4 Recipients

Workspace members with role `owner` or `admin`, whose profile email is a real address. Overridable per site via `settings_json.notifications.recipients` (a list of validated addresses). If the list is empty and no member has a real address, the send is skipped and recorded — never thrown.

### 4.5 Content

Reuses the nodemailer/SMTP path that already ships Try-On campaigns (`lib/email/`), with its own template. Subject: `A shopper needs you — <store name>`. Body: store name, shopper name/email if known, the AI's handoff reason and summary, the last three messages, and a deep link to `/dashboard/messenger?site=<id>&tab=conversations`. Nothing else — no order data, no attachments, no full transcript.

Arabic when the site's configured locale is `ar`, English otherwise.

### 4.6 Badge

The dashboard nav shows a count of conversations in `handoff_requested` across the user's sites. One indexed count query (`idx_widget_conversations_site_status_last` already covers it) resolved in the dashboard layout. No polling in v1: it refreshes on navigation. Zero renders nothing, not a `0`.

### 4.7 Settings

`settings_json.notifications`: `{ emailOnHandoff: boolean (default true), recipients: string[] (default []) }`. Surfaced in the Behaviour tab.

---

## 5. Feature: order lookup

### 5.1 Access — per-merchant OAuth

The app currently holds no per-merchant Admin token; `tryon_shops` has no token column, and the one Admin token in `app_credentials` is a dev-store custom app without order scope.

**Changes:**

- `shopify.app.toml` scopes become `read_products,read_orders,write_app_proxy`. **Existing installs must re-consent** — this is a real rollout cost and is called out in §10.
- New table `shopify_shop_tokens`: `shop_domain` (PK), `access_token_ciphertext`, `token_iv`, `token_tag`, `scopes`, `installed_at`, `rotated_at`. Service-role only, browser roles revoked, RLS enabled with no policy — matching the `tryon_*` and `messenger_*` posture.
- Tokens are encrypted at rest with AES-256-GCM (`node:crypto`, no new dependency) under `SHOPIFY_TOKEN_ENC_KEY` (32-byte base64, new env var, required at boot in production). Supabase already restricts the table; encryption means a database dump alone does not yield live store credentials.
- OAuth routes: `GET /api/shopify/oauth/start` (redirects to Shopify with a signed, single-use `state` stored server-side with a 10-minute TTL) and `GET /api/shopify/oauth/callback` (verifies HMAC and `state`, exchanges the code, encrypts and stores the token). Both reject a `shop` that fails the `^[a-z0-9][a-z0-9-]*\.myshopify\.com$` pattern already used elsewhere.
- Uninstall (`app/uninstalled` webhook, already subscribed) deletes the token row.

### 5.2 Proof rule

Two accepted paths, and no others:

**Verified shopper.** The conversation's `metadata.identity.verified === true` and its bound `customer_id` came from the proxy-signed token. Orders are fetched for that customer id. No order number needed.

**Anonymous shopper.** Must supply **both** an order number and an email. The server fetches the order by name, then compares the order's email to the supplied one — lowercased and trimmed on both sides. A mismatch is treated identically to "no such order".

**Denial is uniform.** Wrong order number, wrong email, order belongs to another store, or rate limit hit all produce the same shopper-visible message: *"I couldn't find an order matching those details."* The reason is recorded server-side; never revealed. This is what stops the chat becoming an order-number oracle.

### 5.3 Rate limits

- 5 order-lookup attempts per conversation (lifetime), then the shopper is offered a human.
- 20 per hour per IP, via the existing Upstash limiter with a `gc-msgr-order` prefix.
- Both counted on *attempts*, not successes, so guessing is what exhausts them.

### 5.4 Data returned to the model

A strict whitelist, assembled server-side. The model sees only:

`order_number`, `order_date`, `fulfillment_status`, `payment_state`, `line_items[] {title, quantity}`, `tracking {company, number, url}`, `destination {city, country}`.

`payment_state` is a deliberately coarse mapping of Shopify's `displayFinancialStatus`, so the model never repeats a status it might misexplain: `PAID`/`PARTIALLY_PAID` → `paid`; `REFUNDED`/`PARTIALLY_REFUNDED` → `refunded`; `PENDING`/`AUTHORIZED` → `pending`; everything else → `unknown`. A shopper asking about money beyond these four states is handed to a human.

Deliberately excluded: full shipping address, phone, email, customer id, prices, discounts, payment details, internal notes, tags, other orders. The spec rule is "only what the current support task requires", and city/country is enough to answer "where is it going".

### 5.5 Query

Shopify GraphQL Admin API, version pinned to the same `2026-10` the app config already uses. Lookups are by `name:"#1234"` (normalising a shopper's `1234`, `#1234` or `no. 1234`) or by customer id. Timeout 8s, one retry on 5xx/429 honouring `Retry-After`, then a clean failure.

### 5.6 Audit

Every attempt writes a `messenger_audit` row — `order_lookup_performed` or `order_lookup_denied` — with conversation id, the matched order id on success, and the denial reason on failure. The action check constraint gains both values, plus `ai_action_rejected` and `ai_action_failed`.

---

## 6. Feature: contact capture

### 6.1 Triggers

Exactly two, and only when no verified email is already known for the visitor:

1. The conversation enters `handoff_requested`.
2. The shopper sends a message while outside configured business hours (`isWithinAvailabilityHours` already computes this).

Asked at most once per conversation, tracked by `metadata.contact_prompted_at`. A shopper who skips is never asked again in that conversation.

### 6.2 Surface

An inline block in the panel's message list — not a modal, not a blocking gate. Copy: *"Where should we reply?"* with an email field, a Send button, and a Skip link. Arabic equivalent for `ar`. The composer stays usable throughout; skipping leaves the conversation entirely functional.

### 6.3 Storage and validation

Email is validated server-side (shape, length ≤ 200, single address) in a new `POST /api/messenger/contact` route with the same key/origin/session checks as `/send`. Stored on `widget_visitors.user_email` (column exists) and mirrored into conversation metadata for the staff view.

A `widget_leads` row is created **only** when the site has lead capture enabled — a shopper asking about shipping is not a lead, and the spec forbids classifying them as one.

### 6.4 Settings

`settings_json.contactCapture`: `{ enabled: boolean (default true), askOutsideHours: boolean (default true) }`. On by default, because it only fires at moments where a reply is already owed; a merchant who does not want it can turn it off in Behaviour.

---

## 7. Feature: attachments with AI triage

### 7.1 Upload path

`POST /api/messenger/attachment` — multipart, same origin/key/session validation as `/send`. The server, not the browser, writes to storage, so no storage credential or signed-upload URL is ever exposed to a storefront.

**Accepted:** `image/jpeg`, `image/png`, `image/webp`. **Rejected:** everything else.

Validation order, all server-side:
1. Size ≤ 5 MB (streamed cap, not a trusted header).
2. **Magic bytes** must match the declared type — a `.png` that is actually something else is rejected. Content-Type from the client is a hint, never the decision.
3. Dimensions ≤ 8000×8000, to bound decode cost.
4. Per-conversation limit: 3 uploads per 10 minutes, plus 10 per conversation lifetime.

**EXIF is stripped from JPEG** before storage, by filtering `APP1`/`APPn` segments — a phone photo carries GPS coordinates, and staff should not receive a shopper's home location as a side effect of a support request. This is ~40 lines against the JPEG segment structure; no new dependency. PNG/WebP metadata is not stripped in v1 (documented limitation — they rarely carry GPS).

### 7.2 Storage

Supabase Storage bucket `messenger-attachments`, **private**. Path `<site_id>/<conversation_id>/<uuid>.<ext>` — site-scoped so a path traversal cannot cross tenants. Staff view images through short-lived signed URLs (5 minutes) minted server-side after the same `requireOwnedSite` ownership check every other staff action uses.

New table `messenger_attachments`: `id`, `widget_site_id`, `conversation_id`, `message_id`, `storage_path`, `mime`, `bytes`, `sha256`, `triage jsonb`, `created_at`. Service-role only.

**Retention: 90 days.** Deletion is lazy — a nightly sweep does not exist and this spec does not add one; instead the staff view and the API treat rows older than 90 days as gone and a cleanup runs opportunistically when a site's attachments are listed. Documented as a limitation: storage objects for stores nobody opens are not reclaimed until someone looks.

### 7.3 Triage

One vision completion per upload, server-initiated. Structured output only:

```json
{ "description": "…", "category": "damaged|wrong_item|wrong_size|unclear|not_an_issue", "confidence": 0.0-1.0 }
```

- `description` is capped at 300 characters and is written into the transcript as a **system message** (subtle, per the existing timeline treatment), and into the handoff summary if the conversation later escalates.
- `category` drives nothing automatically in v1 — it is shown to staff and stored for later analytics. No automatic refunds, no automatic anything. Deliberate: the model classifies, humans decide.
- `confidence` below 0.4 renders as "couldn't tell from the photo" rather than a guess.
- Cost control: one call per attachment, and a per-site daily cap of 200 triage calls, after which uploads still work and simply are not triaged.

Failure to triage never fails the upload. The image is still attached and staff still see it.

### 7.4 Prompt-injection note

Text inside an image is untrusted input. The triage prompt states that image content is data describing a physical object, that instructions found within it must be ignored, and that its output is a description — never an action. Triage output is inserted into the conversation as a system message, never as an authorization, and cannot trigger the action seam.

---

## 8. Data model changes

One migration, `supabase/messenger_support_desk.sql`, following the established manual-delta convention:

```
widget_conversations  + handoff_notified_at timestamptz
shopify_shop_tokens   NEW  (encrypted per-shop Admin tokens)
messenger_attachments NEW  (uploads + triage)
messenger_audit       constraint extended: order_lookup_performed,
                      order_lookup_denied, ai_action_rejected,
                      ai_action_failed, contact_captured, attachment_uploaded
```

Storage: bucket `messenger-attachments`, private, service-role only.

Grants follow `widget_dashboard_grants_lockdown.sql`: browser roles revoked, service_role only, RLS enabled.

New env: `SHOPIFY_TOKEN_ENC_KEY` (required in production; boot fails loudly without it rather than silently storing plaintext).

---

## 9. Testing

**Unit** — action-line parsing (valid, malformed, two actions, unknown name, injected `customer_id`); order-number normalisation; the proof matcher including case/whitespace and mismatch; notification throttle arithmetic; email validation; attachment magic-byte and size checks; JPEG EXIF stripping (a fixture with GPS in, no GPS out); triage output parsing including low confidence and junk.

**Integration** — send route with an action turn (Shopify and model both mocked): verified path, anonymous success, anonymous mismatch → uniform denial, rate-limit exhaustion; `requestHandoff` sends exactly one email and never two under concurrent transitions; contact route rejects a foreign origin.

**E2E** — order question → prompted for order number and email → answer rendered; upload a photo → triage note appears in the transcript; handoff → contact prompt appears once and skipping leaves the composer usable.

**Security** — an order belonging to another store is unreachable with a valid key for this one; a signed token for customer A cannot read customer B's orders; an attachment path cannot escape its site prefix.

---

## 10. Rollout

Ordered by dependency, each independently shippable:

1. **Merchant email fix + notification + badge.** No external dependencies. Unblocks handoff immediately.
2. **Contact capture.** Small, and compounds with (1) — a captured email is what the notification tells you to reply to.
3. **Attachments + triage.** Needs the storage bucket; no Shopify coupling.
4. **Order lookup.** Last, because it is the only one that needs a **scope change and merchant re-consent**.

**Re-consent risk.** Adding `read_orders` means every existing install must reauthorize. With one store installed today this is trivial; it stops being trivial later, which is an argument for doing it now rather than after a merchant push.

**Feature flags.** Each capability reads a flag in `settings_json` and defaults **off** for order lookup and attachments, **on** for notifications. A merchant opts into shopper data access deliberately.

---

## 11. Known limitations

- Attachment storage objects are reclaimed opportunistically, not by a scheduled sweep.
- PNG/WebP metadata is not stripped.
- The nav badge updates on navigation, not live.
- Triage classifies but never acts; no drafted resolution (deliberately deferred — it needs return policy modelled as structured rules).
- Order data is read-only. Any change to an order remains a human action, permanently.
