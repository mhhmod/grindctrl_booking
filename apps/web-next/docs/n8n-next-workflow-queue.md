# n8n Next Workflow Queue (Prompt 14)

Planning-only document. No workflow JSON build in this phase.

## Priority order

1. Implementation Request Intake
2. Trial Preview Persist
3. Website Widget Conversation Preview
4. Lead Capture to CRM/Sheets
5. Social Media Agent Intake

---

## 1) Implementation Request Intake

- Purpose: receive implementation request and prepare team-facing envelope.
- Trigger: webhook `grindctrl-implementation-request`.
- Input contract:
  - request id / workspace id / profile id
  - company, email, use case, channels, tools, urgency, notes
  - optional selected preview id
- Output contract:
  - `status: prepared`
  - urgency score
  - normalized payload
  - acknowledgment message
- Credentials:
  - webhook signing secret
  - optional notification provider secret
- Limits:
  - rate-limit per workspace/profile
  - payload size guard
- Safe preview behavior:
  - validate and echo prepared response only
  - no external notifications required
- Production behavior:
  - store row (via Next API) + notify implementation team
- Dependencies:
  - `implementation_requests` persistence
  - Next API route and adapter
- Priority: P1

## 2) Trial Preview Persist

- Purpose: persist latest trial preview from dashboard save action.
- Trigger: dashboard "save-to-workspace" action.
- Input contract:
  - Clerk user context token (validated server-side)
  - workspace id
  - sanitized preview payload
- Output contract:
  - persisted preview id
  - status transition
- Credentials:
  - n8n webhook auth + app API auth
- Limits:
  - dedupe by latest preview hash/time window
- Safe preview behavior:
  - dry-run mode returns payload validation result only
- Production behavior:
  - call Next API -> Supabase insert/update
- Dependencies:
  - `trial_previews` table + RPC/API
- Priority: P2

## 3) Website Widget Conversation Preview

- Purpose: classify incoming widget messages and return preview response.
- Trigger: widget message webhook.
- Input contract:
  - site key / message text / optional context
- Output contract:
  - detected category (`support|sales|ops`)
  - response draft
  - handoff recommendation
- Credentials:
  - AI provider key
- Limits:
  - message length and per-session rate limits
- Safe preview behavior:
  - no CRM/ticket/email writes
- Production behavior:
  - enable downstream actions only when feature flags allow
- Dependencies:
  - widget runtime + routing catalog
- Priority: P3

## 4) Lead Capture to CRM/Sheets

- Purpose: turn qualified leads into CRM/Sheets payload.
- Trigger: signed-in trial flow or implementation mode handoff.
- Input contract:
  - lead fields + source channel + summary + owner
- Output contract:
  - normalized CRM payload
  - readiness status
- Credentials:
  - CRM/Sheets connector credentials
- Limits:
  - dedupe by email/phone/window
- Safe preview behavior:
  - payload preview only, no external write
- Production behavior:
  - execute write when integration enabled for workspace
- Dependencies:
  - `widget_leads`, connector settings, feature flags
- Priority: P4

## 5) Social Media Agent Intake

- Purpose: unify social channel payload into standard conversation envelope.
- Trigger: Instagram/Messenger/WhatsApp/Telegram events.
- Input contract:
  - channel payload + sender id + message content
- Output contract:
  - normalized conversation message
  - detected intent + response draft
  - optional handoff flag
- Credentials:
  - per-channel API credentials
- Limits:
  - provider rate limits and payload schema guards
- Safe preview behavior:
  - generate drafts only, no publish
- Production behavior:
  - publish approved response path + log conversation
- Dependencies:
  - channel connectors + conversation persistence
- Priority: P5

## Build-first recommendation

Start with **Implementation Request Intake** first, because it directly closes reviewer journey endpoint and is lowest-risk to ship with preview-safe behavior.
