# Feature Specification: Widget Setup Flow

**Feature Branch**: `feat/widget-setup-flow`  
**Created**: 2026-04-21  
**Status**: Draft  
**Input**: User description: "Build the real Widget Setup flow for the existing GRINDCTRL dashboard. Turn Widget Setup into a real, data-backed product flow for businesses using the GRINDCTRL widget."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Configure a Widget Site (Priority: P1)

A business owner signs into the GRINDCTRL dashboard and needs to set up their first AI support widget. They create a widget site, give it a name, and immediately receive a public embed key and install snippet. They configure the launcher position, greeting message, and branding so the widget matches their site. They add their production domain, verify it, and activate the widget.

**Why this priority**: This is the core onboarding journey. Without it, no business can use the product. Every other feature depends on having a widget site first.

**Independent Test**: Can be fully tested by signing in, creating a widget site, copying the install snippet, and viewing the generated embed key. The user receives a complete, working configuration they can paste into any HTML page.

**Acceptance Scenarios**:

1. **Given** the user has no widget sites, **When** they navigate to Widget Setup, **Then** they see a clean empty state with a clear "Create Widget Site" call to action.
2. **Given** the user clicks "Create Widget Site", **When** they enter a name and confirm, **Then** a new widget site is created with status "draft", a unique public embed key is generated automatically, and the site appears in the list.
3. **Given** a widget site exists, **When** the user opens it, **Then** they see the real embed key, a copyable install snippet, and configuration panels for launcher, greeting, and branding.
4. **Given** the user is viewing a widget site, **When** they add a domain and request verification, **Then** the domain appears in the list with status "pending" and can later show "verified" or "failed".
5. **Given** the user has configured their widget, **When** they toggle the site status to "active", **Then** the widget is live on their verified domains and the status is persisted.

---

### User Story 2 - Manage Domains and Security (Priority: P1)

A business operates multiple environments (production, staging, local development). They need to control exactly which domains can load their widget, see verification status for each, and remove domains they no longer own. They also need to rotate their embed key if it is ever exposed.

**Why this priority**: Domain control and key security are essential for production use. Businesses will not deploy a widget they cannot secure.

**Independent Test**: Can be fully tested by adding domains, observing verification states, removing a domain, and regenerating the embed key. The install snippet updates immediately to reflect the new key.

**Acceptance Scenarios**:

1. **Given** a widget site is selected, **When** the user adds a domain like `example.com`, **Then** it appears in the domain list with status "pending".
2. **Given** a domain is pending, **When** verification succeeds, **Then** its status changes to "verified" and the widget can load on that domain.
3. **Given** a domain is pending, **When** verification fails, **Then** its status changes to "failed" with a reason, and the user can retry or remove it.
4. **Given** the user clicks "Regenerate Embed Key", **When** they confirm the action, **Then** a new key is generated, the old key is invalidated, and the install snippet updates immediately.
5. **Given** the user is on the Domains screen, **When** they remove a domain, **Then** it disappears from the list and the widget no longer loads on that domain.

---

### User Story 3 - Customize Branding and Intents (Priority: P2)

A business wants the widget to feel like their own product. They set their brand name, primary and accent colors, and upload a logo. They also define quick intent buttons so visitors can instantly route to sales, support, or human escalation.

**Why this priority**: Branding and intents differentiate a generic widget from a polished support experience. This drives conversion and user satisfaction, but it can be added after the core site is working.

**Independent Test**: Can be fully tested by changing brand colors, uploading a logo, and adding/editing/removing intents. A preview or live widget reflects the changes.

**Acceptance Scenarios**:

1. **Given** the user opens the Branding screen, **When** they change the brand name, primary color, and accent color, **Then** the values are saved and a preview reflects the new colors.
2. **Given** the user provides a logo URL, **When** the URL is valid, **Then** the logo appears in the widget header preview.
3. **Given** the user opens the Intents screen, **When** they add a new intent with label, icon, and action type, **Then** it appears in the intent list and can be triggered from the widget.
4. **Given** an intent exists, **When** the user edits its label or changes its action to "Escalate to Human", **Then** the updated intent is saved and the widget reflects the change.
5. **Given** an intent exists, **When** the user removes it, **Then** it disappears from the list and the widget no longer shows that button.

---

### User Story 4 - Capture and Review Leads (Priority: P2)

A business wants to collect visitor information before or during a chat session. They enable lead capture, choose which fields to show (name, email, phone, company), and customize the prompt text. Captured leads are stored and viewable in the dashboard, tied to the widget site and workspace.

**Why this priority**: Lead capture is a core business value proposition. It turns the widget from a cost center into a revenue tool, but it requires the widget to already be installed and configured.

**Independent Test**: Can be fully tested by enabling lead capture, configuring fields, submitting a test lead from the widget, and viewing the captured lead data in the dashboard.

**Acceptance Scenarios**:

1. **Given** the user opens Lead Capture settings, **When** they enable lead capture, select a timing mode (before required, before skippable, during, disabled, or after conversation), and choose which fields to display, **Then** the widget shows the lead form at the chosen moment in the visitor journey.
2. **Given** a visitor fills out the lead form in the widget, **When** they submit it, **Then** the data is stored, associated with the widget site and workspace, appears in a leads list, and the widget remembers the submission for the remainder of the browser session.
3. **Given** leads exist for a site, **When** the user views the leads panel, **Then** they see a list with name, email, timestamp, and source domain.
4. **Given** the user configures lead capture, **When** they disable a field like "Phone", **Then** the widget form no longer requests that field.
5. **Given** a visitor already submitted their lead info in the current session, **When** they return to the widget later in the same session, **Then** the lead form is skipped and the conversation continues normally.

---

### Edge Cases

- What happens on small-phone widths and other constrained breakpoints?
  - The dashboard sidebar collapses into a hamburger menu or bottom nav. All forms stack vertically. Embed key and snippet copy buttons remain tappable at minimum 44×44px.
- How does the experience behave in Arabic RTL as well as English LTR?
  - All labels, inputs, buttons, and lists mirror correctly. The install snippet remains LTR (code is always LTR) but surrounding UI text translates. Form labels align right in RTL. The domain list and intent list order correctly.
- What happens if the change touches the embeddable widget inside a narrow host container?
  - The widget configuration is loaded at runtime by the public embed script. If branding or intents fail to load, the widget falls back to safe defaults (default colors, generic greeting, no custom intents).
- How does the system avoid visual mismatch across landing, auth, and dashboard surfaces?
  - The dashboard continues to use the existing `app.css` and design token system (`--gc-*` variables). No new color palettes or typography scales are introduced. Changes are scoped to `app.html` and `app.css`.
- How does the system fail safely if a runtime dependency, auth boot, or page initialization step breaks?
  - If Supabase data fails to load, the dashboard shows the existing inline error banner (`#app-inline-error`) and falls back to read-only or empty states. The widget script itself is independent and continues to work with cached config.
- What happens when a user has multiple widget sites?
  - A site selector (dropdown or sidebar list) appears. Selecting a site loads its config. The URL may reflect the selected site. Deleting a site requires confirmation and switches to another site or the empty state.
- What happens if an embed key is regenerated while the widget is live on a customer site?
  - The old key stops working immediately. The user is warned before regeneration. A grace period is not offered in the MVP to keep security strict.
- What happens if a domain verification hangs or the DNS check service is down?
  - Not applicable in MVP — verification is manual. The domain remains in "pending" until an admin approves or rejects it.
- What happens if a non-admin member adds a domain?
  - The domain is added with "pending" status, but only workspace owners or admins can change it to "verified" or "failed".
- What happens when a workspace accumulates a large number of widget sites, domains, or leads?
  - No hard limits in MVP. If lists grow large, the UI should remain usable. Pagination or virtual scrolling may be introduced in a future iteration when pricing-tier limits are defined.
- What happens if a returning visitor already submitted their lead info in a previous session?
  - The widget remembers the submission for the current browser session only (via sessionStorage). On a new session, the lead form may reappear based on the configured timing mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow authenticated users to create a widget site within their current workspace. Each site requires a name and receives a unique, auto-generated public embed key.
- **FR-002**: The system MUST list all widget sites for the current workspace, showing name, status (draft, active, disabled), and creation date.
- **FR-003**: The system MUST allow users to select/open a widget site to view and edit its configuration.
- **FR-004**: The system MUST allow users to edit the widget site name.
- **FR-005**: The system MUST display a clean, actionable empty state when no widget sites exist, with a primary call to action to create the first site.
- **FR-006**: The system MUST generate and display the real public embed key for each widget site. The key MUST be copyable with a single click.
- **FR-007**: The system MUST allow users to regenerate the embed key, with a confirmation step that explains the old key will stop working immediately.
- **FR-008**: The system MUST clearly distinguish the public embed key (safe for client-side code) from admin/private dashboard access.
- **FR-009**: The system MUST generate a real install snippet for the selected widget site, including the correct embed key and domain placeholder, and make it copyable with a single click.
- **FR-010**: The system MUST list all domains associated with the selected widget site, showing domain name and verification status (pending, verified, failed).
- **FR-011**: The system MUST allow users to add allowed domains. Localhost and standard dev domains MUST be supported without blocking the workflow.
- **FR-012**: The system MUST allow users to remove domains. Removing a verified domain immediately prevents the widget from loading on that domain.
- **FR-013**: The system MUST support widget configuration per site: launcher position (bottom-right, bottom-left, top-right, top-left), launcher label, greeting message, support mode / usage mode, and active/inactive state.
- **FR-014**: The system MUST support branding configuration per site: brand name, primary color, accent color, and logo or avatar URL.
- **FR-015**: The system MUST support quick intents per site: list, add, edit, and remove intents. Intents MUST support human-escalation-oriented actions.
- **FR-016**: The system MUST include lead capture foundations: enable/disable lead capture per site, configure which fields are shown (name, email, phone, company), customize the prompt text, and store captured leads tied to workspace + widget site.
- **FR-017**: The system MUST preserve premium dark-mode visual quality and strong readability on all dashboard surfaces.
- **FR-018**: The system MUST remain usable across supported mobile, tablet, and desktop breakpoints (390px through 1536px).
- **FR-019**: The system MUST maintain EN/AR content and RTL/LTR behavior parity where the feature is user-facing.
- **FR-020**: The system MUST avoid breaking widget layout, auth/dashboard visual consistency, or affected runtime flows.
- **FR-021**: The system MUST show loading states while fetching data, empty states when no data exists, and clear success/error feedback after user actions.
- **FR-022**: Only workspace owners and admins can verify or reject domains; members can add domains but cannot change verification status.

### Key Entities *(include if feature involves data)*

- **Widget Site**: Represents a single widget installation. Key attributes: workspace_id, name, embed_key (unique, public), status (draft/active/disabled), launcher configuration, greeting, support_mode, created_by. This is the central entity; most other features hang off it.
- **Widget Domain**: Represents an allowed domain for a widget site. Key attributes: widget_site_id, domain, verification_status (pending/verified/failed). Controls where the widget can legally load.
- **Widget Configuration**: Runtime behavior settings for a widget site. Key attributes: launcher_position, launcher_label, greeting_message, support_mode, active_state. Stored as JSONB in `widget_sites.config_json`.
- **Branding**: Visual identity for a widget site. Key attributes: brand_name, primary_color, accent_color, logo_url. Stored as JSONB in `widget_sites.branding_json`.
- **Widget Intent**: A quick action button shown in the widget panel. Key attributes: widget_site_id, label, icon, action_type (send_message/escalate/external_link), message_text, sort_order. Stored in the `widget_intents` table.
- **Lead Capture Config**: Settings for collecting visitor info. Key attributes: widget_site_id, enabled, timing_mode (before_required/before_skippable/during/disabled/after), fields_enabled (name/email/phone/company), prompt_text, deduplicate_session (boolean). Stored as JSONB in `widget_sites.lead_capture_json`.
- **Captured Lead**: A submitted lead form. Key attributes: widget_site_id, workspace_id, name, email, phone, company, source_domain, created_at. Tied to workspace and site for reporting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create their first widget site, copy the install snippet, and have a working embed configuration in under 3 minutes.
- **SC-002**: A returning user can switch between widget sites, edit configuration, and see changes reflected in the live widget within 10 seconds of saving.
- **SC-003**: 100% of dashboard screens in the Widget Setup flow display real data from Supabase; no mock or placeholder values remain for fields that have a data source.
- **SC-004**: The embed key copy action and install snippet copy action both succeed on the first attempt for 95% of users (measured by successful clipboard writes).
- **SC-005**: Domain verification status is accurate and updates within 5 minutes of a DNS or manual verification change.
- **SC-006**: The widget configuration (launcher, greeting, branding, intents) loads correctly on the embeddable widget with zero console errors for all active widget sites.
- **SC-007**: Lead capture forms submit successfully and store data that can be filtered by widget site and workspace in the dashboard.
- **SC-008**: No release-blocking responsive, RTL, contrast, widget, auth/dashboard consistency, or runtime regression defects remain in affected flows.

## Clarifications

### Session 2026-04-21

- **Q**: Who triggers domain verification state changes (pending → verified/failed)? → **A**: Workspace admin manually approves or rejects domains in the dashboard (Option A). No automated DNS polling in MVP.
- **Q**: How should widget configuration, branding, and lead capture settings be stored? → **A**: JSONB columns on `widget_sites` (e.g., `config_json`, `branding_json`, `lead_capture_json`). Separate tables are used only for intents (`widget_intents`) and captured leads (`widget_leads`).
- **Q**: What are the MVP limits for widget sites, domains, intents, and leads per workspace? → **A**: No hard limits in MVP. Limits will be defined later based on pricing tiers and operational needs.
- **Q**: Which lead capture timing modes should the business owner be able to choose from per widget site? → **A**: All five modes: (A) Before first message required, (B) Before first message skippable, (C) During conversation, (D) Disabled, (E) After conversation ends.
- **Q**: Should the widget remember that a visitor already submitted lead info and skip the form on return visits? → **A**: Remember per browser session only. The form is skipped for the remainder of the session but may reappear on a new session.

## Assumptions

- Users have stable internet connectivity and a modern browser that supports ES modules, Clipboard API, and CSS custom properties.
- The existing Clerk + Supabase auth bridge continues to work. Dashboard pages require an authenticated session; the embeddable widget remains public.
- Workspace-based ownership is preserved: users can only see and manage widget sites within workspaces they are members of.
- RLS policies remain enabled. All data access goes through authenticated Supabase requests with the Clerk user context.
- The existing `widget_sites` table is extended with three JSONB columns (`config_json`, `branding_json`, `lead_capture_json`) to store grouped configuration, branding, and lead capture settings. The `widget_domains` table is unchanged. New tables (`widget_intents`, `widget_leads`) are created for intents and captured leads.
- Domain verification in the MVP is a manual administrative action: a workspace owner or admin clicks "Verify" or "Reject" in the dashboard to change a domain's status from pending to verified or failed. Automated DNS verification may be added later.
- Localhost and `127.0.0.1` are always permitted for development convenience, regardless of the domain list.
- The embed key is a single public token. There is no separate secret key for the widget client. Admin/dashboard access is protected entirely by Clerk authentication, not by the embed key.
- Any user-facing change remains in scope for mobile, EN/AR parity, and runtime-safe release validation.
- Lead capture does not include CRM integrations, email notifications, or automated follow-ups in this phase. The data model is designed to support those in future work.
