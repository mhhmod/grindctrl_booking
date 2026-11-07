-- Additive, idempotent server diagnostics. Review and apply manually.
-- Nullable for historical jobs and deployments before this migration.
-- Contains durations and byte counts only; no photos, URLs or prompt text.
begin;

alter table public.tryon_jobs
  add column if not exists phase_timings jsonb;

comment on column public.tryon_jobs.phase_timings is
  'Server phase durations in milliseconds, provider attempts and input byte counts; no image or personal data.';

commit;
