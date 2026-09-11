-- ============================================================
-- Migration: bootstrap_profile_placeholder_guard
-- Date: 2026-09-11
-- Purpose: make bootstrap_profile's email upgrade one-directional
--   (placeholder -> real, never real -> placeholder/older), matching
--   apps/web-next/lib/messenger/provisioning.ts's former ensureProfile
--   semantics, so provisioning.ts can call this atomic RPC instead of its
--   own multi-round-trip upsert-then-poll dance.
--
--   Root cause fixed: ensureProfile/ensureWorkspace read, then wrote, then
--   re-read across separate HTTP round trips -- two concurrent renders of
--   /dashboard/messenger for a brand-new Clerk user (Next prefetches the
--   route while navigating to it) could interleave across those round
--   trips. Two production incidents (2026-08-29, profiles_clerk_user_id_key;
--   2026-09-09, workspaces_slug_key -- Sentry JAVASCRIPT-NEXTJS-Q/-K) showed
--   a real visibility gap between a winning transaction's commit and a
--   losing connection's very next read of it; widening the retry budget
--   bought headroom once, then the same class of gap recurred at a
--   different size. bootstrap_profile/bootstrap_workspace (originally
--   added in clerk_bootstrap_functions.sql) already do the equivalent
--   find-or-create as ONE statement inside ONE transaction, which is what
--   actually removes the race -- there is no separate read/write pair left
--   for two connections to interleave across.
--
--   p_placeholder_suffix is a new trailing parameter with a default, so
--   bootstrap_user's existing positional call
--   (p_clerk_user_id, p_email, p_first_name, p_last_name, p_image_url)
--   keeps working unchanged. Adding a parameter via CREATE OR REPLACE only
--   replaces a function when the full parameter list matches exactly --
--   otherwise Postgres creates a second, overloaded function alongside the
--   old one. This migration drops the old 5-arg signature explicitly and
--   restores its service_role-only grant on the new 6-arg one, matching
--   clerk_bootstrap_functions.sql's original security posture for every
--   function in this family (these RPCs take the caller's identity as a
--   plain, unverified parameter, so anon/authenticated must never be able
--   to call them directly).
-- ============================================================

begin;

drop function if exists public.bootstrap_profile(text, text, text, text, text);

create or replace function public.bootstrap_profile(
  p_clerk_user_id text,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_image_url text default null,
  p_placeholder_suffix text default '@users.noreply.clerk.dev'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (clerk_user_id, email, first_name, last_name, image_url)
  values (p_clerk_user_id, p_email, p_first_name, p_last_name, p_image_url)
  on conflict (clerk_user_id) do update
  set
    -- Only ever upgrade a placeholder email to a real one, never the
    -- reverse: a call with no real address on hand must not overwrite an
    -- address already on file. Suffix is caller-supplied so the definition
    -- of "placeholder" stays sourced from the one place that owns it
    -- (apps/web-next/lib/messenger/emails.ts's PLACEHOLDER_EMAIL_SUFFIX).
    email = case
      when right(excluded.email, length(p_placeholder_suffix)) <> p_placeholder_suffix
        and right(public.profiles.email, length(p_placeholder_suffix)) = p_placeholder_suffix
      then excluded.email
      else public.profiles.email
    end,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    image_url = coalesce(excluded.image_url, public.profiles.image_url),
    updated_at = now()
  returning *
  into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.bootstrap_profile(text, text, text, text, text, text) to service_role;
revoke execute on function public.bootstrap_profile(text, text, text, text, text, text) from public, anon, authenticated;

commit;
