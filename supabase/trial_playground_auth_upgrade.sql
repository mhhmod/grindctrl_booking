-- GRINDCTRL AI Playground auth-upgrade delta migration
-- Adds minimal session upgrade metadata without rewriting existing trial history rows.

begin;

alter table public.trial_sessions
  add column if not exists guest_identity_key text,
  add column if not exists auth_email text,
  add column if not exists auth_provider text,
  add column if not exists upgraded_at timestamptz;

create index if not exists trial_sessions_user_id_idx
  on public.trial_sessions (user_id);

create index if not exists trial_sessions_guest_identity_idx
  on public.trial_sessions (guest_identity_key);

commit;
