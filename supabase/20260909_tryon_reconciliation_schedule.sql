-- ============================================================
-- Migration: 20260909_tryon_reconciliation_schedule
-- Date: 2026-09-09
-- Purpose: Give reconcile_tryon_entitlements() (the full-shop-table
--   subscription sweep + stuck-job timeout check) an actual scheduled
--   trigger. Until now nothing called it: the dashboard's read path
--   was fixed (2026-09-09) to call the cheap per-shop
--   reconcile_tryon_subscription() instead, which left the global
--   sweep with zero callers.
--
-- Scope: enable pg_cron (not previously installed on this project)
--   and schedule the existing function daily. Does not modify
--   reconcile_tryon_entitlements() or reconcile_tryon_subscription()
--   themselves.
-- ============================================================

begin;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'tryon-daily-reconciliation',
  '17 3 * * *', -- 03:17 UTC daily; off-the-hour to avoid clustering with other jobs
  $$select public.reconcile_tryon_entitlements();$$
);

commit;

-- Rollback:
-- begin;
-- select cron.unschedule('tryon-daily-reconciliation');
-- commit;
-- (Leaves the pg_cron extension installed; it is inert with no jobs scheduled.)
