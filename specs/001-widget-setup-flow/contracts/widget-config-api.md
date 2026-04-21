# Widget Config API Contract

**Version**: 1.0.0  
**Date**: 2026-04-21  
**Consumer**: Embeddable widget (`grindctrl-support.js`)  
**Provider**: Supabase (public read via embed key)

## Overview

The embeddable widget fetches its configuration using the public embed key. This is a **read-only, public API** — no authentication required. The embed key is the sole identifier.

## Endpoint

```
POST /rest/v1/rpc/get_widget_config
```

Or direct table query:
```
GET /rest/v1/widget_sites?embed_key=eq.{embed_key}&select=*,widget_domains(*),widget_intents(*)
```

## Request

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| embed_key | string | yes | The public embed key from the dashboard |

### Example

```javascript
const { data, error } = await supabase
  .from('widget_sites')
  .select(`
    id,
    name,
    status,
    config_json,
    branding_json,
    lead_capture_json,
    widget_domains(domain, verification_status),
    widget_intents(label, icon, action_type, message_text, external_url, sort_order)
  `)
  .eq('embed_key', 'gc_a1b2c3d4_e5f6g7h8_i9j0k1l2')
  .eq('status', 'active')
  .single();
```

## Response

### Success (200)

```json
{
  "id": "uuid",
  "name": "Acme Support",
  "status": "active",
  "config_json": {
    "launcher_position": "bottom-right",
    "launcher_label": "Support",
    "greeting_message": "How can we help you today?",
    "support_mode": "mixed",
    "active_state": true
  },
  "branding_json": {
    "brand_name": "Acme",
    "primary_color": "#4F46E5",
    "accent_color": "#6366F1",
    "logo_url": "https://acme.com/logo.png"
  },
  "lead_capture_json": {
    "enabled": true,
    "timing_mode": "before_skippable",
    "fields_enabled": ["name", "email"],
    "prompt_text": "Please share your details so we can assist you better.",
    "deduplicate_session": true
  },
  "widget_domains": [
    { "domain": "acme.com", "verification_status": "verified" },
    { "domain": "staging.acme.com", "verification_status": "verified" }
  ],
  "widget_intents": [
    { "label": "Talk to Sales", "icon": "headset", "action_type": "send_message", "message_text": "I'd like to talk to sales", "sort_order": 0 },
    { "label": "Talk to a human", "icon": "support_agent", "action_type": "escalate", "sort_order": 1 }
  ]
}
```

### Error Cases

| Status | Code | Meaning |
|--------|------|---------|
| 404 | PGRST116 | Embed key not found or site not active |
| 400 | 23514 | Invalid embed key format |

## Domain Validation

The widget MUST check `window.location.hostname` against `widget_domains` before initializing:

1. If hostname is `localhost` or `127.0.0.1`: always allow (development mode)
2. If hostname matches a domain with `verification_status === 'verified'`: allow
3. Otherwise: show a console warning and do not render the widget

## Lead Capture Submission

```
POST /rest/v1/widget_leads
```

### Request Body

```json
{
  "widget_site_id": "uuid",
  "workspace_id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "",
  "company": "",
  "source_domain": "acme.com"
}
```

### Security Note

`widget_site_id` and `workspace_id` are visible in the client. This is acceptable because:
- The lead table has no sensitive data
- RLS policies ensure leads can only be inserted (not read back) by the public role
- Dashboard reads are protected by Clerk-authenticated RLS
