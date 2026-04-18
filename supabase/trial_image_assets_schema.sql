-- GRINDCTRL AI Playground – Image generation delta migration
-- Applied to production via Supabase MCP on 2026-04-10.

begin;

-- 1. Image generation metadata table
create table if not exists public.trial_image_assets (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.trial_sessions (session_id) on delete cascade,
  user_id text null,
  identity_key text not null,
  prompt text not null,
  provider text not null default 'cloudflare',
  model text not null default '@cf/black-forest-labs/flux-1-schnell',
  status text not null default 'completed'
    check (status = any (array['pending','processing','completed','failed','rejected'])),
  created_at timestamptz not null default now()
);

create index if not exists trial_image_assets_session_idx
  on public.trial_image_assets (session_id, created_at desc);

create index if not exists trial_image_assets_identity_idx
  on public.trial_image_assets (identity_key, created_at desc);

alter table public.trial_image_assets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trial_image_assets' and policyname = 'anon_insert_trial_image_assets'
  ) then
    create policy anon_insert_trial_image_assets
      on public.trial_image_assets
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trial_image_assets' and policyname = 'anon_select_trial_image_assets'
  ) then
    create policy anon_select_trial_image_assets
      on public.trial_image_assets
      for select
      to anon
      using (true);
  end if;
end $$;

-- 2. Add image_gen_used counter to trial_usage_counters
alter table public.trial_usage_counters
  add column if not exists image_gen_used integer not null default 0;

commit;
