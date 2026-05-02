# Customer Journey Persistence Plan (Prompt 13)

Plan only. No schema migration or Supabase write-path implementation applied in this phase.

## Scope inspected

- `lib/adapters/*`
- `lib/supabase/*`
- `lib/types.ts`

Current implementation keeps preview/request data client-local or static UI state.

## Recommended tables

### 1) `trial_previews`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key` | server-generated |
| `workspace_id` | `uuid` | references workspace |
| `profile_id` | `uuid` | references profile |
| `source` | `text` | expected `landing_sandbox` |
| `mode` | `text` | `workflow` / `voice` / `file` |
| `workflow_slug` | `text` | preview workflow id |
| `summary` | `text` | sanitized summary |
| `confidence` | `int` | 0..100 |
| `extracted_entities` | `jsonb` | sanitized entity map |
| `decision` | `jsonb` | route/priority/handoff |
| `recommended_action` | `text` | reviewer next action |
| `status` | `text` | captured/review/requested |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 2) `implementation_requests`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key` | server-generated |
| `workspace_id` | `uuid` | references workspace |
| `profile_id` | `uuid` | references profile |
| `company_name` | `text` | required |
| `work_email` | `text` | required |
| `business_type` | `text` | required |
| `primary_use_case` | `text` | required |
| `channels` | `jsonb` | selected channels array |
| `tools` | `jsonb` | selected tools array |
| `pain` | `text` | optional |
| `urgency` | `text` | required |
| `notes` | `text` | optional |
| `selected_preview_id` | `uuid nullable` | optional linkage |
| `status` | `text` | prepared/submitted/reviewed |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 3) `agent_configs`

Holds per-workspace/channel configuration state for AI agent rollout.

### 4) `integration_requests`

Tracks provider connection requests and onboarding status.

## RLS strategy outline

1. Enable RLS on all new tables.
2. `SELECT`: workspace members only (`workspace_members.workspace_id` match).
3. `INSERT`: member inserts only for own `profile_id` + workspace membership.
4. `UPDATE`: owner/admin for mutable status transitions; member can update own draft rows when needed.
5. `DELETE`: owner/admin only (optional for v1).

## RPC / API route outline

### Next API routes (recommended boundary)

- `POST /api/trial-previews`
- `GET /api/trial-previews/latest`
- `POST /api/implementation-request`
- `POST /api/integration-request`

### Adapter files to add

- `lib/adapters/trial-previews.ts`
- `lib/adapters/implementation-requests.ts`
- `lib/adapters/agent-configs.ts`
- `lib/adapters/integration-requests.ts`

All adapters should use existing `callRpc()` pattern and never expose privileged keys to browser.

## Migration order

1. Create `trial_previews` + indexes + RLS + policies.
2. Create `implementation_requests` + indexes + RLS + policies.
3. Create `agent_configs`.
4. Create `integration_requests`.
5. Add RPCs and verify read/write contracts via server adapters.
6. Roll UI from local-only -> dual-write -> DB-preferred reads.

## Rollback plan

1. Keep current localStorage read/write path active via feature flag fallback.
2. Disable new API writes first if issues appear.
3. Keep tables intact; avoid destructive rollback migrations.
4. Revert UI to local-only mode while investigating RPC/policy failures.

## UI that can stay local until migration

- Workflow preview history panel
- Implementation request success state
- Agent detail selection state
- Integration filter state

## Do-not-implement-yet list

- No Supabase migration file edits in this phase.
- No direct browser writes to Supabase.
- No n8n workflow JSON edits.
- No Clerk auth flow changes.

## Confirmation

No schema, policy, or migration was changed in this run. This document is planning-only.
