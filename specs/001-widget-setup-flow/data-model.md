# Data Model: Widget Setup Flow

**Feature**: Widget Setup Flow  
**Date**: 2026-04-21  
**Source**: [spec.md](spec.md), existing `supabase/clerk_profiles_workspaces_widget_sites.sql`

## Entity Overview

```
workspace (1) ──< (N) widget_site
widget_site (1) ──< (N) widget_domain
widget_site (1) ──< (N) widget_intent
widget_site (1) ──< (N) widget_lead
workspace (1) ──< (N) widget_lead   (via widget_site.workspace_id)
```

## Existing Tables (Unchanged Structure)

### profiles
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| clerk_user_id | text | unique, not null |
| email | text | not null |
| first_name | text | |
| last_name | text | |
| image_url | text | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### workspaces
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| name | text | not null |
| slug | text | unique, not null |
| owner_profile_id | uuid | FK → profiles(id), on delete cascade |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### workspace_members
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces(id), on delete cascade |
| profile_id | uuid | FK → profiles(id), on delete cascade |
| role | text | check in ('owner', 'admin', 'member'), default 'member' |
| created_at | timestamptz | default now() |
| unique | (workspace_id, profile_id) | |

## Extended Tables

### widget_sites

**New columns added**:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| config_json | jsonb | `{}` | Launcher position, label, greeting, support_mode, active_state |
| branding_json | jsonb | `{}` | brand_name, primary_color, accent_color, logo_url |
| lead_capture_json | jsonb | `{}` | enabled, timing_mode, fields_enabled, prompt_text, deduplicate_session |

**Existing columns preserved**:

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default uuid_generate_v4() |
| workspace_id | uuid | FK → workspaces(id), on delete cascade |
| name | text | not null |
| domain | text | *(deprecated: use widget_domains table)* |
| embed_key | text | unique, not null, auto-generated |
| status | text | check in ('draft', 'active', 'disabled'), default 'draft' |
| created_by_profile_id | uuid | FK → profiles(id), on delete set null |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

**JSONB Schemas**:

```json
// config_json
{
  "launcher_position": "bottom-right",  // enum: bottom-right, bottom-left, top-right, top-left
  "launcher_label": "Support",
  "greeting_message": "How can we help you today?",
  "support_mode": "mixed",  // enum: mixed, support_only, sales_only, operations
  "active_state": true
}

// branding_json
{
  "brand_name": "",
  "primary_color": "#4F46E5",
  "accent_color": "#6366F1",
  "logo_url": ""
}

// lead_capture_json
{
  "enabled": false,
  "timing_mode": "disabled",  // enum: before_required, before_skippable, during, disabled, after
  "fields_enabled": ["name", "email"],  // subset of [name, email, phone, company]
  "prompt_text": "Please share your details so we can assist you better.",
  "deduplicate_session": true
}
```

## New Tables

### widget_domains

*(Already exists in schema; no structural changes)*

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| widget_site_id | uuid | FK → widget_sites(id), on delete cascade |
| domain | text | not null |
| verification_status | text | check in ('pending', 'verified', 'failed'), default 'pending' |
| created_at | timestamptz | default now() |

### widget_intents (NEW)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default uuid_generate_v4() | |
| widget_site_id | uuid | FK → widget_sites(id), on delete cascade | |
| label | text | not null | Display text (EN; AR via i18n key if needed) |
| icon | text | not null | Material Symbols icon name |
| action_type | text | check in ('send_message', 'escalate', 'external_link'), default 'send_message' | |
| message_text | text | | Message to send (for send_message action) |
| external_url | text | | URL to open (for external_link action) |
| sort_order | integer | default 0 | Display order in widget |
| created_at | timestamptz | default now() | |

### widget_leads (NEW)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default uuid_generate_v4() | |
| widget_site_id | uuid | FK → widget_sites(id), on delete cascade | |
| workspace_id | uuid | FK → workspaces(id), on delete cascade | Denormalized for reporting |
| name | text | | |
| email | text | | |
| phone | text | | |
| company | text | | |
| source_domain | text | | Domain where lead was captured |
| created_at | timestamptz | default now() | |

## Validation Rules

- **widget_sites.name**: Required, max 100 characters
- **widget_sites.embed_key**: Auto-generated, format `gc_{hash}_{hash}_{hash}`, immutable after creation
- **widget_domains.domain**: Valid hostname format; localhost and 127.0.0.1 allowed
- **widget_intents.label**: Required, max 50 characters
- **widget_intents.sort_order**: Non-negative integer
- **widget_leads.email**: Valid email format if provided

## State Transitions

### widget_sites.status
```
draft → active  (user action: "Activate")
draft → disabled (user action: "Disable")
active → disabled (user action: "Disable")
active → draft (user action: "Deactivate")
disabled → active (user action: "Activate")
disabled → draft (user action: "Reactivate as draft")
```

### widget_domains.verification_status
```
pending → verified  (admin action: "Verify")
pending → failed    (admin action: "Reject")
failed → pending    (admin action: "Retry")
verified → pending  (admin action: "Revoke")
```

## Indexes

```sql
-- For widget config lookups by embed key (public widget API)
create index if not exists idx_widget_sites_embed_key on public.widget_sites(embed_key);

-- For listing sites in a workspace
create index if not exists idx_widget_sites_workspace on public.widget_sites(workspace_id);

-- For domain lookups
create index if not exists idx_widget_domains_site on public.widget_domains(widget_site_id);

-- For intent ordering
create index if not exists idx_widget_intents_site_order on public.widget_intents(widget_site_id, sort_order);

-- For lead reporting by workspace
create index if not exists idx_widget_leads_workspace on public.widget_leads(workspace_id, created_at desc);

-- For lead filtering by site
create index if not exists idx_widget_leads_site on public.widget_leads(widget_site_id, created_at desc);
```

## RLS Policy Additions

```sql
-- widget_intents: same pattern as widget_sites
-- widget_leads: same read pattern; insert only via widget (public) or dashboard (authenticated)
```
