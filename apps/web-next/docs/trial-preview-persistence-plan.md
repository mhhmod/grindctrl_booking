# Trial Preview Persistence Plan (Supabase, Plan-Only)

## Scope
Plan only. No schema/RLS/RPC/adapters/UI persistence wiring in this phase.

Current behavior remains local-first via:
- `gc:landing:last-preview:v1` (localStorage)
- sanitized preview payload (no file binary, no raw transcript dump)

---

## 1) Recommended Table / Model

Recommended future model: `public.trial_previews`

Core columns (proposed):
- `id uuid primary key default extensions.uuid_generate_v4()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `profile_id uuid not null references public.profiles(id) on delete cascade`
- `source text not null default 'landing_sandbox'`
- `mode text not null` (`workflow | voice | file`)
- `workflow_slug text not null`
- `summary text not null`
- `confidence int not null` (0..100)
- `extracted_entities jsonb not null default '{}'::jsonb`
- `decision jsonb not null default '{}'::jsonb`
- `recommended_action text not null`
- `status text not null default 'captured'`
  - suggested: `captured | saved_for_review | implementation_requested`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Optional, if needed later:
- `origin_session_id text`
- `meta jsonb`

---

## 2) Why This Model

- Preserves landing-to-dashboard continuity per workspace.
- Aligns with current Clerk-bridged ownership model (`profiles`, `workspace_members`).
- Keeps trial preview data separate from operational tables (`widget_leads`, `widget_events`, `widget_conversations`).
- Supports explicit lifecycle (`captured` -> `saved_for_review` -> `implementation_requested`) without touching billing/workflow execution systems.

---

## 3) Migration Outline (Future Phase)

1. Create table `public.trial_previews` with `if not exists`.
2. Add checks:
   - `mode in ('workflow','voice','file')`
   - `confidence between 0 and 100`
   - `status in ('captured','saved_for_review','implementation_requested')`
3. Add indexes:
   - `(workspace_id, created_at desc)`
   - `(profile_id, created_at desc)`
   - `(status, created_at desc)`
4. Add `updated_at` trigger via existing `public.set_updated_at()`.
5. Add RPC wrappers (security definer, `set search_path = public`) in same style as existing dashboard RPCs:
   - `dashboard_upsert_trial_preview(p_clerk_user_id, p_workspace_id, p_payload jsonb)`
   - `dashboard_get_latest_trial_preview(p_clerk_user_id, p_workspace_id)`
   - `dashboard_set_trial_preview_status(p_clerk_user_id, p_workspace_id, p_preview_id, p_status)`

No migration execution in this phase.

---

## 4) RLS Outline (Future Phase)

Enable RLS on `public.trial_previews`.

Policies (shape):
- `select`: workspace member can read rows where `workspace_id` is in their memberships.
- `insert`: member can insert only into own workspace and own `profile_id`.
- `update`: member can update rows in own workspace; optional stricter rule for status transitions.
- `delete`: owner/admin only (optional; may be omitted initially).

RPC safety requirement:
- Every RPC verifies `p_clerk_user_id` -> `profiles.id` -> `workspace_members.workspace_id` before returning or mutating row.
- Keep anon key path; no service role key introduction.

---

## 5) Adapter Outline (Future Phase)

Add server-only adapter:
- `apps/web-next/lib/adapters/trialPreviews.ts`

Suggested methods:
- `getLatestTrialPreview(clerkUserId: string, workspaceId: string)`
- `upsertTrialPreview(clerkUserId: string, workspaceId: string, input: TrialPreviewInput)`
- `setTrialPreviewStatus(clerkUserId: string, workspaceId: string, previewId: string, status: TrialPreviewStatus)`

Implementation style:
- Reuse `callRpc()` from `lib/adapters/rpc.ts`
- Keep strict typed mapping in `lib/types.ts` (new `TrialPreview` interface)
- Preserve local sanitization rules from `lib/trial/landing-preview-handoff.ts`

---

## 6) UI Integration Outline (Future Phase)

Phased rollout recommendation:

1. **Dual-write phase (safe)**
   - Keep localStorage write.
   - If signed-in workspace context exists, also call `upsertTrialPreview`.
   - UI remains responsive even if persistence fails.

2. **Read preference phase**
   - On dashboard overview: prefer latest persisted preview.
   - Fallback to localStorage handoff if DB unavailable/no row.

3. **Status transition phase**
   - `Save to trial review` -> `saved_for_review`
   - `Request implementation plan` -> `implementation_requested`
   - Keep current UI wording/flow; no workflow execution side effects.

---

## 7) Rollback Plan

- Keep localStorage path as permanent fallback during rollout.
- Gate DB writes/reads behind feature flag (example: `TRIAL_PREVIEW_PERSISTENCE_MODE=local|dual|db`).
- If regression:
  - switch to `local`
  - leave table untouched (non-destructive rollback)
- Avoid destructive down migration; old rows can remain inert.

---

## 8) What Not To Touch Now

Do **not** change in this phase:
- Supabase migrations
- Supabase tables/RLS
- dashboard adapters
- service role keys
- n8n workflows
- billing/payment
- auth provider configuration

---

## Tables Involved (Future)

Primary:
- `trial_previews` (new)

Reference/authorization:
- `profiles`
- `workspaces`
- `workspace_members`

Not required for this feature’s persistence:
- `widget_sites`
- `widget_leads`
- `widget_events`
- `widget_conversations`
- `widget_messages`
