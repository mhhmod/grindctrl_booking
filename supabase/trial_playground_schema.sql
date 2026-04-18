-- GRINDCTRL AI Playground trial delta migration
-- Applied to production via Supabase MCP on 2026-04-09.
-- This is intentionally a non-destructive delta against the existing trial schema.

begin;

alter table public.trial_messages
  add column if not exists reply_language text;

alter table public.trial_usage_counters
  add column if not exists tts_previews_used integer not null default 0;

create table if not exists public.trial_tts_assets (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.trial_sessions (session_id) on delete cascade,
  user_id text null,
  identity_key text not null,
  source_text text not null,
  preview_text text not null,
  reply_language text not null,
  provider text not null,
  model text not null,
  voice text null,
  storage_path text not null,
  status text not null default 'completed'
    check (status = any (array['pending','processing','completed','failed','rejected'])),
  created_at timestamptz not null default now()
);

create index if not exists trial_tts_assets_session_idx
  on public.trial_tts_assets (session_id, created_at desc);

create index if not exists trial_tts_assets_identity_idx
  on public.trial_tts_assets (identity_key, created_at desc);

alter table public.trial_tts_assets enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trial-tts', 'trial-tts', false, 5242880, array['audio/wav'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trial_tts_assets' and policyname = 'anon_insert_trial_tts_assets'
  ) then
    create policy anon_insert_trial_tts_assets
      on public.trial_tts_assets
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trial_tts_assets' and policyname = 'anon_select_trial_tts_assets'
  ) then
    create policy anon_select_trial_tts_assets
      on public.trial_tts_assets
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'anon_read_trial_tts'
  ) then
    create policy anon_read_trial_tts
      on storage.objects
      for select
      to anon
      using (bucket_id = 'trial-tts');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'anon_upload_trial_tts'
  ) then
    create policy anon_upload_trial_tts
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'trial-tts');
  end if;
end $$;

commit;
