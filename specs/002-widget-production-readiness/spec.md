# Production-Readiness Specification: Embeddable Chat Widget

**Phase**: Widget productization (new phase)

**Goal**: Turn the current widget implementation into a true production embeddable product.

**Non-goal**: Aesthetic polish only. This phase is about security, tenant safety, domain enforcement, coherent configuration, operational reliability, and a copy-paste install experience that works on any customer site.

---

## 1. Executive Summary

We will ship the widget as a production embeddable product with:

- A single copy-paste snippet (one script include, one init call) using a public `embedKey`.
- Server-enforced domain allowlisting so the widget cannot function on unauthorized domains.
- A tenant-driven runtime that fetches all effective configuration from the backend, with a strict and unified settings model.
- A secure embed authentication model (public embed key for bootstrap, short-lived signed embed session token for runtime calls).
- A production conversation system (sessions, messages, transcripts, escalation state) and a lead capture system that cannot be spoofed client-side.
- A coherent dashboard experience with harmonized tabs and a single source of truth for settings.
- Reliability primitives: loader timeouts/retries, safe fallbacks, caching, health/error reporting, and widget runtime versioning.

---

## 2. Current Problems (Why The Widget Is Not Yet Production-Ready)

Observed in the current repo and widget runtime:

- Config fetch is effectively broken for real customers.
  - `src/public/scripts/grindctrl-support.js` fetches config via Supabase REST RPC and expects `apiKey` but `apiKey` defaults to empty and the public snippet does not supply it.
- Domain enforcement is not production-grade.
  - Config fetch is not domain-gated; anyone with an embed key can fetch config.
  - Domain allowlisting is not enforced as a server-side contract at bootstrap.
- Lead submission is spoofable.
  - Runtime submits to `/rest/v1/widget_leads` and includes `workspace_id` and `widget_site_id` from the client.
  - DB migration currently allows public inserts (`widget_leads: public insert`). This enables spam and cross-tenant data poisoning.
- Conversation transport is not production.
  - Runtime shows demo replies and has no defined mechanism for assistant replies (polling/SSE/Realtime) and no guaranteed persistence contract.
- Separation of concerns is blurred.
  - Widget runtime mixes demo behaviors, server config reads, and ad hoc runtime overrides.
  - `src/widget-admin.html` is a static prototype that diverges from the real dashboard (`src/app.html`).
- No end-to-end production install verification.
  - Dashboard does not show last-seen heartbeats, install status, or domain enforcement errors.
- Security posture is incomplete.
  - Public runtime access relies on direct Supabase REST in a way that cannot enforce origin/domain at the DB layer.
  - No explicit CORS contract per tenant.
  - No defined rate limits, bot protections, or abuse monitoring for public endpoints.
- No versioning/backward-compatibility strategy for snippet/runtime.
  - Customers need a stable snippet URL with a clear major-version policy.

---

## 3. Target Production Architecture

### 3.1 Separation Of Concerns (Hard Boundaries)

- Widget loader (CDN) 
  - Minimal bootstrap shim.
  - Queue + command system.
  - Loads the runtime bundle.
  - Never talks to Supabase directly.

- Widget runtime bundle (CDN)
  - Shadow DOM UI.
  - Calls backend APIs using a short-lived embed session token.
  - Renders tenant-driven config (branding/intents/leads/routing rules).

- Dashboard/admin app (this repo: `src/app.html` + `src/scripts/app.js`)
  - Auth via Clerk.
  - Writes configuration to Supabase (protected by RLS).
  - Generates snippet and install guidance.
  - Shows domain verification + install status.

- Widget configuration data model (Supabase Postgres)
  - Single source of truth for widget settings.
  - Separate tables where cardinality requires it (domains, intents, conversations/messages, leads).

- Backend API surface (Supabase Edge Functions)
  - Public bootstrap endpoint with domain enforcement.
  - Authenticated widget endpoints (send message, poll messages, submit lead, event ingest) using embed session token.

- Event ingestion
  - Accepts low-risk telemetry from runtime.
  - Stores to DB and optionally forwards to n8n.

- Lead capture
  - Server-side insert only.
  - Links lead to conversation/session/intent.

- Conversation persistence
  - DB tables for conversations and messages.
  - Clear state machine and transcript contract.

- Domain validation
  - Enforced at bootstrap and on every widget API call.
  - CORS is per-tenant and per-allowed-origin.

- Tenant isolation
  - All backend reads/writes are scoped by `widget_site_id` and `workspace_id` derived server-side.
  - Dashboard uses RLS and Clerk user context.
  - Widget runtime uses embed session token only.

### 3.2 High-Level Data Flow

1. Host site includes loader script.
1. Loader reads queued init config containing `embedKey`.
1. Loader loads runtime.
1. Runtime calls `widget/bootstrap` with `embedKey`.
1. Backend validates the request origin against allowed domains and returns:
  - effective widget config
  - short-lived `embed_session_token`
  - recommended polling/timeout parameters
1. Runtime uses `embed_session_token` for all subsequent widget API calls.

---

## 4. Widget Runtime Architecture

### 4.1 Script Loading Model (Decisive)

We will ship two files on the CDN, but customers paste one script tag.

- `https://cdn.grindctrl.com/widget/v1/loader.js`
  - Defines `window.GrindctrlSupport` as a queue-capable factory.
  - Loads `https://cdn.grindctrl.com/widget/v1/runtime.js` asynchronously.

- `https://cdn.grindctrl.com/widget/v1/runtime.js`
  - Implements the full widget (Shadow DOM).
  - Exposes the same global API as the loader.

**Compatibility**: Existing snippet URL `https://cdn.grindctrl.com/grindctrl-support.js` remains supported as an alias that serves the `v1/loader.js` content.

### 4.2 Canonical Snippet (Queue Pattern)

This is the official production snippet generated by the dashboard.

```html
<script>
  window.GrindctrlSupport = window.GrindctrlSupport || [];
  window.GrindctrlSupport.push({
    embedKey: 'gc_live_xxxxx',
    user: {
      id: null,
      email: null,
      name: null
    },
    context: {
      custom: {}
    }
  });
</script>
<script async src="https://cdn.grindctrl.com/widget/v1/loader.js"></script>
```

### 4.3 CSP-Friendly Alternative Snippet (No Inline JS)

Some customers cannot use inline scripts. We will support an attribute-based init.

```html
<script
  async
  src="https://cdn.grindctrl.com/widget/v1/loader.js"
  data-gc-embed-key="gc_live_xxxxx">
</script>
```

Optional attributes:

- `data-gc-locale="auto|en|ar"`
- `data-gc-debug="true|false"`

### 4.4 Public Runtime API (Exact)

Global: `window.GrindctrlSupport`

Methods:

- `GrindctrlSupport.init(initOptions)`
- `GrindctrlSupport.open()`
- `GrindctrlSupport.close()`
- `GrindctrlSupport.toggle()`
- `GrindctrlSupport.destroy()`
- `GrindctrlSupport.updateContext(partialContext)`
- `GrindctrlSupport.identify(user)`
- `GrindctrlSupport.track(eventName, payload)`
- `GrindctrlSupport.getVersion()`
- `GrindctrlSupport.push(item)`

Queue item types:

- Config object: `{ embedKey, user?, context?, locale?, debug?, onReady?, onEvent?, onError? }`
- Callback: `(api) => void` where `api` is `GrindctrlSupport`

### 4.5 Initialization Parameters (Exact)

`initOptions`:

- `embedKey` (string, required)
- `locale` (`'auto' | 'en' | 'ar'`, optional, default `'auto'`)
- `debug` (boolean, optional, default `false`)
- `user` (optional)
  - `id` (string, optional)
  - `email` (string, optional)
  - `name` (string, optional)
  - `phone` (string, optional)
  - `company` (string, optional)
- `context` (optional)
  - `custom` (object, optional, default `{}`)
  - `pageUrl` (string, optional, default `location.href`)
  - `referrer` (string, optional, default `document.referrer`)
- Callbacks (optional)
  - `onReady(effectiveConfig)`
  - `onEvent(event)`
  - `onError(error)`

**Precedence rule**: dashboard configuration is authoritative. `initOptions` may only supply visitor identity/context and callbacks. Appearance/branding/intents/leads behavior cannot be overridden by snippet.

### 4.6 Runtime Failure Handling (Exact)

- Invalid embed key
  - `widget/bootstrap` returns `401` with `error: 'embed_key_invalid'`.
  - Widget does not render launcher by default.
  - If `debug=true` or on `localhost`, widget renders a small non-intrusive error pill: "Widget misconfigured" with a details panel.
  - `onError` is called with `{ code: 'embed_key_invalid' }`.

- Domain not allowed
  - `widget/bootstrap` returns `403` with `error: 'domain_not_allowed'`.
  - CORS header is not set for this origin.
  - Widget does not render.
  - `onError` receives `{ code: 'domain_not_allowed', origin }`.

- Network/config/backend failure
  - Loader retries runtime load (2 retries with exponential backoff + jitter).
  - Bootstrap retries (2 retries) then falls back to "offline mode" UI:
    - Launcher remains available.
    - Panel shows "Support temporarily unavailable".
    - If tenant configured fallback contact, show a safe link/button.
  - Errors are reported via `widget/event` (best-effort) when available.

---

## 5. Admin/Dashboard Architecture For Widget Settings

### 5.1 Dashboard Surfaces (This Repo)

We will use the existing dashboard (`src/app.html` + `src/scripts/app.js`) as the single admin surface.

`src/widget-admin.html` is a prototype and will be treated as deprecated. The production dashboard is `src/app.html`.

### 5.2 Tabs (Canonical, No Duplicates)

These tabs are the product source of truth. Each setting exists in exactly one place.

1. Install Widget
1. Branding
1. Intents
1. Domains
1. Leads

The existing "Widget Setup" content is split:

- Install Widget tab owns embed key, snippet, framework examples, and install verification.
- Branding tab owns launcher and appearance behavior (where it is user-facing).
- Intents tab owns routing and escalation behavior.

### 5.3 Coherence Rules (Hard)

- No setting is duplicated across tabs.
- Terminology matches runtime naming.
- Any setting that affects runtime must be present in the runtime config payload.
- Plan gating is shown in the same place where the gated setting lives.

---

## 6. Unified Configuration Model

### 6.1 Source Of Truth

Config lives in Supabase Postgres.

- `widget_sites` is the root entity.
- `widget_domains` and `widget_intents` remain separate tables.
- A new unified JSONB column is introduced:
  - `widget_sites.settings_json` (JSONB, required, default `{}`)
  - `widget_sites.settings_version` (integer, required, default `1`)

Existing JSONB columns are treated as legacy inputs and will be migrated:

- `widget_sites.config_json` (legacy)
- `widget_sites.branding_json` (legacy)
- `widget_sites.lead_capture_json` (legacy)

**Decision**: Once `settings_json` exists, the dashboard writes only `settings_json` and the runtime reads only the effective settings derived from `settings_json`.

### 6.2 Settings Schema (v1)

`widget_sites.settings_json`:

```json
{
  "branding": {
    "brand_name": "",
    "assistant_name": "Support",
    "logo_url": "",
    "avatar_url": "",
    "launcher_label": "Support",
    "launcher_icon": "chat",
    "theme_mode": "auto",
    "radius_style": "soft",
    "attribution": {
      "mode": "auto",
      "show_powered_by": true
    }
  },
  "widget": {
    "position": "bottom-right",
    "default_open": false,
    "show_intents": true,
    "rtl_supported": true,
    "locale": "auto"
  },
  "leads": {
    "enabled": false,
    "capture_timing": "off",
    "fields": ["name", "email"],
    "required_fields": ["email"],
    "prompt_title": "",
    "prompt_subtitle": "",
    "skippable": false,
    "dedupe": {
      "mode": "session"
    },
    "consent": {
      "mode": "none",
      "text": "",
      "privacy_url": ""
    }
  },
  "routing": {
    "default_intent_behavior": "chat",
    "handoff": {
      "enabled": false,
      "channel": "email",
      "target": ""
    },
    "availability": {
      "enabled": false,
      "timezone": "UTC",
      "hours": []
    }
  },
  "security": {
    "allow_localhost": true,
    "allowed_iframe_parents": [],
    "rate_limits": {
      "bootstrap_per_min": 60,
      "messages_per_min": 20,
      "leads_per_hour": 30
    }
  }
}
```

### 6.3 Effective Runtime Config Payload

The runtime receives a normalized config from `widget/bootstrap`. It includes only what the runtime must know and excludes secrets.

Fields included:

- Branding and UI settings
- Intent list (enabled only, ordered)
- Lead capture settings
- Availability/handoff presentation rules
- Attribution rules (already plan-enforced)
- Polling and timeouts

Fields excluded:

- Any secret keys, webhook endpoints, internal workflow IDs that could be abused
- Any dashboard-only fields

---

## 7. Detailed Tab-By-Tab Specification

### 7.1 Branding Tab

**Purpose**: Control tenant branding and appearance consistently across launcher, panel, lead UI, and escalation surfaces.

Capabilities (exact):

- Brand name (displayed in header and empty state)
- Assistant name (displayed as the conversational counterpart)
- Logo URL (header)
- Avatar URL (assistant bubble avatar if shown)
- Launcher label
- Launcher icon (from a safe allowlist of Material Symbols)
- Theme mode rules: `auto` (follows host), `dark`, `light`
- Radius style variants (product-safe only): `soft` (default), `rounded`, `sharp`
- Attribution behavior
  - `mode: auto` uses plan and trial state
  - `show_powered_by` is enforced server-side

Preview behavior:

- Shows launcher + open panel preview
- Shows empty state, intents row, lead form preview, escalation banner preview
- Missing assets fall back gracefully
  - If logo fails to load, show launcher icon fallback
  - If avatar fails, hide avatar and keep typography aligned

Plan gating:

- Hide attribution toggle unless plan allows.
- Custom logo/avatar are plan-gated if required.
- Runtime enforces final attribution regardless of client.

### 7.2 Intents Tab

**Purpose**: Define the buttons and routing behavior that appear in-widget before (and optionally during) conversation.

Intent entity fields (exact):

- `name` (internal, required)
- `label` (user-facing, required)
- `description` (internal note, optional)
- `icon` (Material Symbols name, required)
- `sort_order` (integer)
- `enabled` (boolean)
- `behavior` (enum)
  - `send_message` (sends a predefined first message)
  - `open_url` (opens external URL)
  - `handoff` (initiates escalation/handoff)
- `message_text` (required if `send_message`)
- `external_url` (required if `open_url`)
- `routing` (object, optional)
  - `workflow` (enum or string key)
  - `tags` (string array)
  - `priority` (enum)

Widget rendering rules:

- Show intents in configured order.
- Hide disabled intents.
- Show a maximum of 6 on small phone; allow scroll or "More" if needed (runtime decision, not per-tenant).

AI/system behavior implications:

- `send_message` intents tag the first message with `intent_id` and `intent_label`.
- Backend routing uses intent routing metadata to choose n8n workflow or handoff channel.

Lead routing implications:

- If `leads.capture_timing = after_intent`, selecting any intent triggers lead capture UI.
- If intent `behavior=handoff`, lead capture may be forced before handoff depending on leads settings.

Escalation behavior:

- `handoff` intent creates an escalation event and changes conversation status to `handoff_requested`.
- Backend sends events to configured integration (n8n, email, Slack) using server-side secrets only.

### 7.3 Domains Tab

**Purpose**: Production domain control for embed key usage.

Domain model (exact):

- `pattern` (string)
  - exact hostname: `example.com`, `app.example.com`
  - wildcard subdomain: `*.example.com` (matches `foo.example.com`, does not match `example.com`)
- `environment` (enum): `production | staging | development`
- `verification_status` (enum): `pending | verified | failed | disabled`
- `verification_method` (enum): `dns_txt` (default), `manual` (fallback)
- `verification_token` (string, generated by backend)
- `created_at`, `verified_at`, `last_checked_at`

Localhost/dev handling (exact):

- `localhost` and `127.0.0.1` are permitted only if `settings_json.security.allow_localhost = true`.
- Dev domains are shown distinctly and never require DNS verification.

Preview/staging handling (exact):

- Staging domains can be added and verified like production.
- Dashboard install snippet supports per-environment guidance but uses the same embed key.

Rejected domain behavior (exact):

- Widget bootstrap rejects origin with `403 domain_not_allowed`.
- Dashboard shows reason: not verified, disabled, or not on allowlist.

Verification strategy (exact):

- DNS TXT verification.
- For domain `example.com` or `*.example.com`, user must add:
  - Name: `_grindctrl.example.com`
  - Type: `TXT`
  - Value: `gc_verify=<token>`
- For domain `app.example.com`, user must add:
  - Name: `_grindctrl.app.example.com`
  - Type: `TXT`
  - Value: `gc_verify=<token>`
- Verification checks use DNS-over-HTTPS and run on-demand ("Verify" button) and optionally scheduled.

Audit trail (exact):

- Every domain add/remove/verify/disable action writes an audit record with:
  - `actor_profile_id` (dashboard user)
  - `action` (enum)
  - `old_value` and `new_value` (json)
  - `created_at`

Plan-based domain limits (exact):

- Starter: 1 verified production domain
- Growth: 3 verified production domains
- Premium: 10 verified production domains
- Development and staging domains do not count toward the production limit.

### 7.4 Leads Tab

**Purpose**: Define lead capture behavior and review captured leads.

What counts as a lead (exact):

- A lead is created when the visitor submits the widget lead form.
- Auto-capture is not enabled in v1 (no silent lead creation). Only explicit form submission creates a lead.

Capture rules (exact):

- `capture_timing` values:
  - `off`
  - `before_chat_required`
  - `before_chat_skippable`
  - `after_intent`
  - `after_n_messages` with `n` fixed by backend config (v1 supports `2` and `3`)

Fields collected (exact):

- `name`, `email`, `phone`, `company` (ordered)
- `required_fields` is a subset; by default `email` required if present

Qualification state (exact):

- `status`: `new | qualified | disqualified | contacted`
- `status_reason` (optional)

Attribution captured server-side (exact):

- `source_origin` (origin)
- `page_url` (full URL)
- `referrer` (string)
- `utm_*` (if present)
- `conversation_id` (nullable)
- `intent_id` (nullable)
- `visitor_id` (nullable)

Consent/privacy (exact):

- If `consent.mode = checkbox`, lead form includes a required checkbox.
- If `privacy_url` is provided, link is shown.
- No cookies are required by default.

Export/sync (v1):

- CSV export from dashboard.
- Webhook sync is configured under Integrations, but lead payload is defined here.

### 7.5 Install Widget Tab

**Purpose**: Give customers a reliable installation experience and confidence their widget is live.

Install experience (exact):

- Show embed key with copy.
- Show the canonical snippet (queue pattern) with copy.
- Show CSP-friendly snippet (attribute init) with copy.
- Show framework-specific examples (copy blocks):
  - Plain HTML
  - React
  - Next.js (app router and pages router)
  - Vue
  - WordPress
  - Shopify
  - Webflow

Validation status (exact):

- Domain readiness summary:
  - Verified production domains count vs plan limit
  - "No verified domains" state blocks go-live

Test/install verification flow (exact):

- Runtime sends a `widget_heartbeat` event after successful bootstrap.
- Dashboard shows:
  - last heartbeat timestamp
  - last seen origin
  - last seen page URL
- "Open install test" button opens a hosted test page that loads the widget with the selected embed key.

Environment notes (exact):

- Dev: allow `localhost` only when enabled.
- Staging: add and verify staging domain.
- Prod: only verified prod domains.

---

## 8. Data Model (Production)

This phase introduces production widget entities beyond setup.

### 8.1 Core Entities

- `widget_sites`
  - Existing columns preserved.
  - Add `settings_json jsonb not null default '{}'`.
  - Add `settings_version int not null default 1`.
  - Add `embed_key_status` (`active|disabled|rotated`) (optional if needed).

- `widget_domains`
  - Add columns: `pattern`, `environment`, `verification_method`, `verification_token`, `verified_at`, `last_checked_at`, `disabled_at`.
  - Replace current `domain` column semantics with `pattern` (keep `domain` as legacy alias if needed).

- `widget_intents`
  - Add columns: `name`, `enabled`, `description`, `behavior`, `routing_json`.

- `widget_visitors`
  - `id uuid`
  - `widget_site_id uuid`
  - `anonymous_id text` (client-generated)
  - `first_seen_at`, `last_seen_at`
  - `user_email`, `user_name` (nullable)
  - `metadata jsonb`

- `widget_conversations`
  - `id uuid`
  - `widget_site_id uuid`
  - `visitor_id uuid`
  - `status` (`open|closed|handoff_requested|handoff_active`)
  - `started_at`, `closed_at`, `last_message_at`
  - `last_page_url`, `last_referrer`

- `widget_messages`
  - `id uuid`
  - `conversation_id uuid`
  - `role` (`user|assistant|system`)
  - `content text`
  - `content_type` (`text|intent|event`)
  - `intent_id uuid` (nullable)
  - `created_at`
  - `metadata jsonb`

- `widget_leads`
  - Extend with: `conversation_id`, `intent_id`, `visitor_id`, `page_url`, `referrer`, `utm_*`, `status`, `status_reason`, `consent jsonb`.
  - Remove public insert policy. Insert only via edge function.

- `widget_events`
  - `id uuid`
  - `widget_site_id uuid`
  - `conversation_id uuid` (nullable)
  - `event_name text`
  - `payload jsonb`
  - `created_at`

- `widget_domain_audit`
  - audit trail for domain operations.

### 8.2 Tenant Isolation

- Every table has `widget_site_id` and/or `workspace_id` where required.
- Dashboard access is enforced by existing workspace RLS.
- Widget runtime access is enforced by edge functions using embed session token.

---

## 9. API Contract (Widget Backend)

All widget endpoints are Supabase Edge Functions.

Base URL:

- `https://<project>.supabase.co/functions/v1/`

### 9.1 `widget-bootstrap` (Public)

Request:

```json
{
  "embedKey": "gc_live_xxxxx",
  "page": {
    "url": "https://example.com/pricing",
    "title": "Pricing"
  },
  "locale": "auto",
  "user": { "id": null, "email": null, "name": null },
  "context": { "custom": {} }
}
```

Behavior:

- Reads `Origin` header and validates it against verified `widget_domains`.
- Validates site status (`active`).
- Returns effective runtime config and an `embed_session_token`.

Response (200):

```json
{
  "ok": true,
  "runtime": {
    "version": "1.0.0",
    "config_version": 1
  },
  "site": {
    "id": "uuid",
    "name": "Acme",
    "branding": { "brand_name": "Acme", "assistant_name": "Support", "logo_url": "" },
    "widget": { "position": "bottom-right", "default_open": false, "show_intents": true },
    "leads": { "enabled": false, "capture_timing": "off" },
    "intents": []
  },
  "auth": {
    "embed_session_token": "jwt",
    "expires_in_sec": 3600
  },
  "polling": {
    "min_interval_ms": 1500,
    "max_interval_ms": 6000
  }
}
```

Errors:

- `401 embed_key_invalid`
- `403 domain_not_allowed`
- `403 site_inactive`

### 9.2 `widget-session-start` (Auth: embed token)

Creates or resumes a conversation.

Request:

```json
{
  "visitor": { "anonymous_id": "...", "email": null, "name": null },
  "page": { "url": "...", "title": "..." }
}
```

Response:

```json
{ "ok": true, "conversation_id": "uuid", "visitor_id": "uuid" }
```

### 9.3 `widget-message-send` (Auth: embed token)

Request:

```json
{
  "conversation_id": "uuid",
  "content": "Hello",
  "content_type": "text",
  "intent_id": null
}
```

Response:

```json
{ "ok": true, "message_id": "uuid" }
```

### 9.4 `widget-message-poll` (Auth: embed token)

Request:

```json
{ "conversation_id": "uuid", "after": "2026-04-22T10:00:00.000Z" }
```

Response:

```json
{ "ok": true, "messages": [ { "id": "uuid", "role": "assistant", "content": "...", "created_at": "..." } ] }
```

### 9.5 `widget-lead-submit` (Auth: embed token)

Request:

```json
{
  "conversation_id": "uuid",
  "intent_id": null,
  "lead": { "name": "", "email": "", "phone": "", "company": "" },
  "consent": { "accepted": true, "text": "..." }
}
```

Response:

```json
{ "ok": true, "lead_id": "uuid" }
```

### 9.6 `widget-event` (Auth: embed token)

Best-effort telemetry.

Request:

```json
{ "event": "widget_heartbeat", "payload": { "page_url": "..." } }
```

Response:

```json
{ "ok": true }
```

---

## 10. Security Model

### 10.1 Embed Key Model

- `embedKey` is public and safe to place in customer HTML.
- `embedKey` is not an admin secret and cannot grant dashboard access.
- Embed keys are rotateable from the dashboard.

### 10.2 Embed Session Token

- `widget-bootstrap` returns a short-lived signed token.
- Token claims include:
  - `widget_site_id`
  - `workspace_id` (optional)
  - `origin` (string)
  - `exp`
  - `scopes` (e.g. `message:send`, `lead:submit`, `event:ingest`)

### 10.3 Domain Enforcement

- Bootstrap and all widget endpoints enforce:
  - request `Origin` must match the token `origin`
  - origin must be in verified domain list
- CORS policy is strict per allowed origin.
  - `Access-Control-Allow-Origin` is set only when allowed.
  - `Vary: Origin` is always set.
  - `Access-Control-Allow-Credentials` is false.

### 10.4 Abuse Prevention

- Rate limiting per site, per IP hash, and per visitor fingerprint.
- Request body size limits.
- Lead form honeypot field (in runtime) plus server-side validation.
- Automatic blocklist capability per site.

### 10.5 Tenant Safety

- Widget runtime never receives or stores cross-tenant identifiers it can misuse.
- All writes derive `widget_site_id` server-side from token.
- Leads cannot be written with arbitrary `workspace_id` from the client.

---

## 11. Production Reliability

### 11.1 Performance

- Loader is tiny and async.
- Runtime loads only after init is present.
- No blocking network calls on initial page paint.

### 11.2 Timeouts And Retries

- Loader script load timeout: 8s.
- Bootstrap timeout: 6s.
- Retries: 2 attempts with exponential backoff + jitter.

### 11.3 Graceful Degradation

- If bootstrap fails, show offline UI with tenant-configured fallback contact.
- If message send fails, keep message in UI as "failed" with retry.

### 11.4 Observability

- Widget emits:
  - `widget_heartbeat` on successful bootstrap
  - `widget_error` for runtime errors (best-effort)
- Backend stores events in `widget_events` and forwards to n8n where configured.

### 11.5 Versioning Strategy

- Snippet URL is major-versioned: `/widget/v1/loader.js`.
- `v1` guarantees backward compatibility of public API and init options.
- Breaking changes require `/widget/v2/...`.
- Runtime exposes `GrindctrlSupport.getVersion()`.

---

## 12. File-By-File Implementation Plan (This Repo)

This plan is written for an implementation agent working in this repository.

### 12.1 Widget Loader/Runtime

- Add `src/public/scripts/grindctrl-support-loader.js`
  - queue + factory API
  - attribute-based init
  - runtime script injection

- Rename or split `src/public/scripts/grindctrl-support.js`
  - becomes `runtime` implementation
  - remove direct Supabase REST config fetch
  - implement `widget-bootstrap` call
  - implement embed session token storage (memory-first, sessionStorage optional)
  - implement `widget-session-start`, `widget-message-send`, `widget-message-poll`, `widget-lead-submit`, `widget-event`
  - implement offline/error states as specified
  - keep Shadow DOM isolation

- Update `widget-readme.md`
  - canonical snippet
  - CSP notes
  - API surface
  - error behaviors

- Update `src/integration-examples.html`
  - use new loader snippet
  - include Next.js and CSP examples

### 12.2 Dashboard UI

- Update `src/app.html`
  - add/rename the "Install Widget" tab and screen
  - remove or hide any duplicated "setup" blocks that conflict with the new tab ownership
  - add install status UI: last heartbeat, last seen origin

- Update `src/scripts/app.js`
  - unify writes to `widget_sites.settings_json`
  - migrate existing reads from `config_json`, `branding_json`, `lead_capture_json` into the unified view
  - generate both snippets (queue and CSP-friendly)
  - show domain verification tokens and verify button wiring

- Update `src/lib/clerk-supabase-sync.js`
  - add RPC methods for:
    - read/write `settings_json`
    - domain verification token issuance
    - domain verification check
    - install heartbeat listing

### 12.3 Supabase Migrations (In Repo: `supabase/`)

- Add a new migration SQL file, idempotent, that:
  - adds `settings_json` and `settings_version` to `widget_sites`
  - extends `widget_domains` with required columns
  - extends `widget_intents` with required columns
  - introduces conversations/messages/events/visitors tables
  - removes or tightens public insert policy for `widget_leads`
  - adds indexes and RLS policies required for dashboard access

### 12.4 Tests

- Extend `e2e/widget-sdk.spec.ts`
  - loader queue pattern
  - attribute-based init
  - API surface stability
  - no double-init

---

## 13. Acceptance Criteria

### Embeddable Snippet

- A customer can paste the canonical snippet into:
  - plain HTML
  - React
  - Next.js
  - Vue
  - WordPress
  - Shopify
  - Webflow
- Widget loads without requiring the customer to provide any Supabase keys.

### Domain Control

- Widget does not function on unauthorized domains.
- Verified domain enforcement is server-side (bootstrap + every API call).
- DNS TXT verification works end-to-end.

### Tenant Safety

- Leads cannot be spoofed to another workspace/site.
- Public endpoints have rate limits.
- CORS is strict and origin-based.

### Configuration Coherence

- Each setting exists in exactly one dashboard tab.
- Runtime config payload matches dashboard settings.
- Snippet does not override appearance/routing settings.

### Conversation System

- A conversation can be created/resumed.
- Messages persist and can be polled.
- Escalation intent creates a state transition.

### Reliability

- Loader and bootstrap retries are implemented.
- Offline state is user-friendly and branded.
- Heartbeat is visible in Install Widget tab.

---

## 14. Do Not Assume

Implementation must not assume:

- That customers can add inline scripts (CSP).
- That customers can change DNS instantly or at all.
- That the host site uses any framework.
- That host site CSS will not conflict (Shadow DOM is required).
- That Supabase anon keys are acceptable in customer snippets.
- That RLS alone can enforce domain allowlisting.
- That webhook endpoints or routing secrets can be exposed to the runtime.

---

## 15. Do Not Change (Protected Areas)

- Preserve current color palette and token system (`src/tokens.css`).
- Preserve the Vite multi-page vanilla architecture.
- Do not introduce a framework rewrite.
- Do not remove Clerk authentication from the dashboard.
- Do not weaken Supabase RLS for dashboard data.
- Keep widget UI style isolation via Shadow DOM.
