# GRINDCTRL Support Widget — n8n Webhook Contracts

This document defines the event payloads sent to n8n workflows for AI routing, escalation, and analytics.

---

## Webhook Environment Variables

Set these in your Supabase Edge Function environment or n8n:

```
N8N_WEBHOOK_CONVERSATIONS=https://your-n8n.com/webhook/grindctrl-conversations
N8N_WEBHOOK_MESSAGES=https://your-n8n.com/webhook/grindctrl-messages
N8N_WEBHOOK_EVENTS=https://your-n8n.com/webhook/grindctrl-events
N8N_WEBHOOK_ESCALATION=https://your-n8n.com/webhook/grindctrl-escalation
```

---

## Event: `conversation_start`

Fired when a visitor opens the widget and a conversation session begins.

```json
{
  "event": "conversation_start",
  "tenant_id": "uuid",
  "site_id": "uuid",
  "conversation_id": "uuid",
  "visitor_id": "uuid",
  "anonymous_id": "string",
  "page_url": "https://example.com/pricing",
  "page_title": "Pricing — Acme Corp",
  "referring_url": "https://google.com",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "q1-2026",
  "support_mode": "support",
  "email": "user@example.com",
  "name": "Jane Smith",
  "ip_hash": "sha256 hash",
  "user_agent": "Mozilla/5.0 ...",
  "session_id": "string",
  "timestamp": "2026-04-18T14:30:00.000Z"
}
```

**Use cases in n8n:**
- Log to CRM
- Send Slack notification to sales team
- Enrich visitor data with Clearbit/Apollo
- Start onboarding sequence

---

## Event: `message_sent`

Fired when a visitor sends any message (text, voice transcript, or intent click).

```json
{
  "event": "message_sent",
  "tenant_id": "uuid",
  "site_id": "uuid",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "visitor_id": "uuid",
  "content": "How do I integrate with Slack?",
  "intent_label": null,
  "content_type": "text",
  "email": "user@example.com",
  "name": "Jane Smith",
  "page_url": "https://example.com/integrations",
  "support_mode": "mixed",
  "ip_hash": "sha256 hash",
  "user_agent": "Mozilla/5.0 ...",
  "timestamp": "2026-04-18T14:31:00.000Z"
}
```

**Intent click variant:**
```json
{
  "event": "message_sent",
  "intent_label": "Talk to a human",
  "content": "Talk to a human",
  "content_type": "intent"
}
```

**Use cases in n8n:**
- Classify intent (support vs sales vs technical)
- Route to correct AI agent or team
- Enrich with knowledge base data
- Generate AI response via LLM
- Check for escalation trigger

---

## Event: `escalation_trigger`

Fired when a visitor clicks an escalation intent or when AI determines human handoff is needed.

```json
{
  "event": "escalation_trigger",
  "tenant_id": "uuid",
  "site_id": "uuid",
  "conversation_id": "uuid",
  "visitor_id": "uuid",
  "escalation_type": "support",
  "escalation_reason": "User clicked 'Talk to human'",
  "intent_label": "Talk to a human",
  "conversation_history": [
    { "role": "user", "content": "I need help with my order" },
    { "role": "assistant", "content": "I can help you with that!" }
  ],
  "page_url": "https://example.com/orders",
  "email": "user@example.com",
  "name": "Jane Smith",
  "assigned_team": "support",
  "priority": "normal",
  "timestamp": "2026-04-18T14:32:00.000Z"
}
```

**Use cases in n8n:**
- Create ticket in Zendesk/Intercom/Linear
- Send Slack DM to on-call agent
- Route to correct department by conversation topic
- Send confirmation email to visitor

---

## Event: `widget_open`

Fired when the launcher is clicked.

```json
{
  "event": "widget_open",
  "tenant_id": "uuid",
  "site_id": "uuid",
  "visitor_id": "uuid",
  "anonymous_id": "string",
  "page_url": "https://example.com",
  "support_mode": "mixed",
  "trial_days_remaining": 11,
  "timestamp": "2026-04-18T14:30:00.000Z"
}
```

---

## Event: `widget_close`

Fired when the panel is closed.

```json
{
  "event": "widget_close",
  "tenant_id": "uuid",
  "site_id": "uuid",
  "visitor_id": "uuid",
  "session_duration_sec": 127,
  "messages_sent": 3,
  "escalation_triggered": false,
  "page_url": "https://example.com/pricing",
  "timestamp": "2026-04-18T14:32:00.000Z"
}
```

---

## Event: `trial_expire_warning`

Fired when a tenant's trial is nearing expiration (scheduled n8n cron job).

```json
{
  "event": "trial_expire_warning",
  "tenant_id": "uuid",
  "email": "owner@yourcompany.com",
  "plan_tier": "trial",
  "trial_ends_at": "2026-05-03T00:00:00.000Z",
  "days_remaining": 3,
  "usage_summary": {
    "conversations_total": 127,
    "messages_total": 842,
    "escalations_total": 3
  },
  "timestamp": "2026-04-30T09:00:00.000Z"
}
```

---

## Event: `branding_change`

Fired when a tenant's branding mode changes (e.g., trial ends, white-label removed).

```json
{
  "event": "branding_change",
  "tenant_id": "uuid",
  "previous_mode": "white_label",
  "new_mode": "forced_grindctrl",
  "reason": "trial_expired",
  "enforced_by": "server",
  "timestamp": "2026-05-03T00:00:00.000Z"
}
```

---

## Event: `usage_threshold_warning`

Fired when a tenant reaches 80% of a usage limit.

```json
{
  "event": "usage_threshold_warning",
  "tenant_id": "uuid",
  "metric": "conversations",
  "current_count": 400,
  "limit": 500,
  "percentage_used": 80,
  "period": "monthly",
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "timestamp": "2026-04-28T00:00:00.000Z"
}
```

---

## Event: `landing_sandbox.requested`

Fired when an anonymous landing-page sandbox run is submitted. This event is contract-only in Phase 1.1; anonymous backend execution itself remains side-effect-free.

```json
{
  "event": "landing_sandbox.requested",
  "source": "landing_sandbox",
  "mode": "workflow",
  "session_id": "anon_session_id",
  "ip_hash": "sha256 hash",
  "locale": "en",
  "has_file": false,
  "prompt_preview": "Route support requests and capture leads",
  "timestamp": "2026-04-30T14:32:00.000Z"
}
```

---

## Event: `landing_sandbox.completed`

Represents the normalized response envelope returned by the landing sandbox backend.

```json
{
  "event": "landing_sandbox.completed",
  "source": "landing_sandbox",
  "ok": true,
  "fallback": true,
  "message": "Provider unavailable. Returned deterministic fallback blueprint.",
  "retry_after_seconds": null,
  "result": {
    "status": "completed",
    "workflow_slug": "workflow_planner",
    "summary": "Workflow Planner Blueprint: Turn business workflow requests into deployable AI plans.",
    "confidence": 78,
    "extracted_entities": {
      "agent_name": "Workflow Planner Blueprint",
      "workflow_steps": "Capture business trigger and desired outcome. | Map required inputs, constraints, and escalation rules."
    },
    "decision": {
      "route": "workflow_design",
      "priority": "medium",
      "handoff_required": false
    },
    "recommended_action": "Sign in to save and deploy this workflow blueprint.",
    "executed_actions": [],
    "external_refs": [],
    "audit_trail": ["anonymous_request_received", "normalized_output_returned"],
    "observability": {
      "provider_refs": [],
      "latency_ms": 42,
      "cost_estimate": 0
    }
  },
  "meta": {
    "mode": "workflow",
    "locale": "en",
    "limit_state": "ok",
    "timestamp": "2026-04-30T14:32:00.000Z"
  }
}
```

---

## n8n Workflow Example: AI Response Router

A minimal n8n workflow structure to process `message_sent`:

```
[Webhook: message_sent]
       ↓
[Switch: content_type]
       ├─ "intent" → [Log + Send to Slack]
       └─ "text" → [LLM: Classify Intent]
                       ↓
                 [Switch: intent_class]
                   ├─ "support" → [Query Knowledge Base]
                   │                  ↓
                   │            [LLM: Generate Response]
                   │                  ↓
                   │            [HTTP: POST back to widget]
                   │
                   ├─ "sales" → [CRM: Lookup/Create Lead]
                   │                ↓
                   │          [LLM: Generate Response]
                   │                ↓
                   │            [HTTP: POST back to widget]
                   │
                   └─ "escalation" → [Create Ticket]
                                        ↓
                                  [Send Slack to #sales]
                                        ↓
                                  [HTTP: POST back to widget]
```

---

## API: POST Response to Widget

After generating an AI response, n8n can reply directly to the conversation:

```
POST https://[project].supabase.co/functions/v1/widget-message
Authorization: Bearer [SERVICE_ROLE_KEY]
Content-Type: application/json

{
  "embed_key": "abc-1234",
  "domain": "example.com",
  "conversation_id": "[conversation_id]",
  "role": "assistant",
  "content": "Based on your question about Slack integration..."
}
```

---

## Event Subscription Setup in n8n

For Supabase, use a cron-triggered workflow to check for trial expirations daily:

```
[Cron: Every 24 hours]
       ↓
[Supabase: Query tenants WHERE trial_status = 'active' AND trial_ends_at < NOW()]
       ↓
[Loop Items]
       ↓
[HTTP Request: N8N_WEBHOOK_EVENTS]
       ↓
[Switch: days_remaining]
       ├─ <= 0 → [Update tenant trial_status = 'expired']
       │           ↓
       │        [Trigger branding_change event]
       │
       ├─ <= 3 → [HTTP: N8N_WEBHOOK_TRIAL_WARNING]
       │
       └─ > 3 → [No action]
```
