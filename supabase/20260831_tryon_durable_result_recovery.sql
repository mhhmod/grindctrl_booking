-- ============================================================
-- Migration: 20260831_tryon_durable_result_recovery
-- Date: 2026-08-31
-- Purpose: Add durable, short-lived generated-result recovery to
--   public.tryon_jobs without changing entitlement finalization.
--
-- Runtime contract for the follow-up application change:
--   1. Decode and validate the provider result (maximum 16 MiB).
--   2. Upload it to the private tryon-results bucket.
--   3. Persist result_storage_path/result_persisted_at/
--      result_expires_at while the entitlement job is processing.
--   4. Finalize entitlement only after step 3 succeeds.
--   5. Delete the Storage object after the 30-minute recovery
--      window, then clear result_storage_path and set
--      result_deleted_at. Retain the timestamps as reconciliation
--      evidence without retaining the generated image.
--
-- Security/privacy:
--   * No source customer photo is stored by this migration.
--   * Generated results are customer-photo-derived personal data.
--   * The bucket is private and has no public/anon/authenticated
--     storage.objects policies. Runtime access is service-role only;
--     callers receive short-lived signed URLs only after the existing
--     job/session/product/shop authorization checks.
--   * Storage objects must be removed through the Storage API. A SQL
--     row delete does not delete the underlying object.
--
-- This is a manual additive delta. Review against the confirmed live
-- project before applying. It intentionally does not replace
-- finalize_tryon_job() or reconcile_tryon_entitlements() because their
-- exact deployed definitions must be captured first.
-- ============================================================

begin;

alter table public.tryon_jobs
  add column if not exists result_storage_path text,
  add column if not exists result_persisted_at timestamptz,
  add column if not exists result_expires_at timestamptz,
  add column if not exists result_deleted_at timestamptz;

comment on column public.tryon_jobs.result_storage_path is
  'Private tryon-results object path. Present only while the generated result is recoverable.';

comment on column public.tryon_jobs.result_persisted_at is
  'When the generated result became durable, before entitlement finalization.';

comment on column public.tryon_jobs.result_expires_at is
  'Generated-result deletion deadline. Runtime retention is 30 minutes from persistence.';

comment on column public.tryon_jobs.result_deleted_at is
  'When the generated result object was deleted; retained as non-image reconciliation evidence.';

-- NOT VALID avoids a table-wide validation scan during this additive
-- rollout while still enforcing the lifecycle shape for new/updated rows.
-- Validate explicitly after live preflight and the runtime dual-write deploy.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tryon_jobs'::regclass
      and conname = 'tryon_jobs_result_lifecycle_check'
  ) then
    alter table public.tryon_jobs
      add constraint tryon_jobs_result_lifecycle_check
      check (
        -- No durable result has ever been persisted.
        (
          result_storage_path is null
          and result_persisted_at is null
          and result_expires_at is null
          and result_deleted_at is null
        )
        or
        -- Active result inside its recovery/retention lifecycle.
        (
          result_storage_path is not null
          and result_persisted_at is not null
          and result_expires_at > result_persisted_at
          and result_deleted_at is null
          and char_length(result_storage_path) between 1 and 512
          and result_storage_path ~ '^jobs/[A-Za-z0-9_-]{1,160}/result\.(jpg|png|webp)$'
        )
        or
        -- Object deleted after expiry, privacy redaction, or explicit purge.
        -- The non-image timestamps remain for billing reconciliation.
        (
          result_storage_path is null
          and result_persisted_at is not null
          and result_expires_at > result_persisted_at
          and result_deleted_at is not null
          and result_deleted_at >= result_persisted_at
        )
      ) not valid;
  end if;
end $$;

-- Supports bounded cleanup scans without enlarging the index for jobs that
-- never persisted a result or whose object was already removed.
create index if not exists idx_tryon_jobs_result_expiry
  on public.tryon_jobs (result_expires_at)
  where result_storage_path is not null
    and result_deleted_at is null;

-- Private bucket. No storage.objects policy is created: trusted server code
-- uses the service role for upload/delete/signing after application-level
-- authorization. The 16 MiB bucket cap is a backstop; runtime must reject an
-- oversized decoded provider result before attempting the upload.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tryon-results',
  'tryon-results',
  false,
  16777216,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

-- ============================================================
-- Manual live preflight (read-only; run before applying)
-- ============================================================
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'tryon_jobs'
-- order by ordinal_position;
--
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.tryon_jobs'::regclass
-- order by conname;
--
-- select c.relrowsecurity, c.relforcerowsecurity, c.relacl
-- from pg_class c
-- where c.oid = 'public.tryon_jobs'::regclass;
--
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'tryon-results';
--
-- select pg_get_functiondef(
--   'public.finalize_tryon_job(text,text,text,numeric,integer,text)'::regprocedure
-- );
-- select pg_get_functiondef(
--   'public.reconcile_tryon_entitlements()'::regprocedure
-- );

-- ============================================================
-- Gated post-deploy validation
-- Run only after runtime dual-write is live and result lifecycle rows have
-- been inspected. This is intentionally not part of the transaction above.
-- ============================================================
-- alter table public.tryon_jobs
--   validate constraint tryon_jobs_result_lifecycle_check;

-- ============================================================
-- Rollback (manual)
-- Before running: stop result writes, use the Storage API to delete every
-- object in tryon-results, verify the bucket is empty, and remove the bucket
-- through the Storage API. Do not delete storage.objects/storage.buckets rows
-- directly in SQL because that can orphan underlying files.
-- ============================================================
-- begin;
-- drop index if exists public.idx_tryon_jobs_result_expiry;
-- alter table public.tryon_jobs
--   drop constraint if exists tryon_jobs_result_lifecycle_check;
-- alter table public.tryon_jobs
--   drop column if exists result_storage_path,
--   drop column if exists result_persisted_at,
--   drop column if exists result_expires_at,
--   drop column if exists result_deleted_at;
-- commit;
