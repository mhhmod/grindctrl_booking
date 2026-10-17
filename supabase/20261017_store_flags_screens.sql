-- Screen flags for v16 (v16 foundations, part two c).
--
-- The redesigned screens ship behind one per-store flag per surface, so the
-- owner can turn v16 on for the demo store first and check it in
-- production, where there is no staging. Their names start with v16_, such
-- as v16_dashboard, beside the feature flags named after their contract
-- code (n23_after_hours). This widens the name check on store_flags to
-- admit both; every other rule on the table is unchanged.
--
-- Idempotent: safe to run more than once, and before or after
-- 20261016_store_flags.sql has been applied a second time. Apply by hand in
-- the Supabase SQL editor; nothing here runs automatically.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_flags'::regclass
      and conname = 'store_flags_flag_name'
      and pg_get_constraintdef(oid) not like '%v16%'
  ) then
    alter table public.store_flags drop constraint store_flags_flag_name;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_flags'::regclass and conname = 'store_flags_flag_name'
  ) then
    alter table public.store_flags
      add constraint store_flags_flag_name
      check (flag ~ '^(n[0-9]+[a-z]?|v16)_[a-z0-9_]{1,60}$');
  end if;
end $$;
