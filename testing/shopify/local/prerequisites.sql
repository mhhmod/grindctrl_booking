-- DISPOSABLE LOCAL DATABASE ONLY. Not an export or migration for Production.
-- The two historical base tables have no checked-in creation DDL. These
-- prerequisites implement the columns consumed by settings.ts, persistence.ts
-- and supabase-migration-plans.sql. Hosted schema parity remains UNVERIFIED.
-- All financial functions/constraints are loaded unchanged from tracked SQL.
begin;
create schema extensions;
create extension "uuid-ossp" with schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
create role supabase_storage_admin login superuser;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
$$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage authorization supabase_storage_admin;
create table public.tryon_jobs (
 id text primary key, session_id text, product_id text, shop text,
 status text not null, message text, provider text, cost_usd numeric,
 duration_ms integer, created_at timestamptz not null default now()
);
create table public.tryon_settings (
 shop text primary key, button_label text, accent_bg text, accent_fg text,
 radius_px integer, widget_theme text, icon_bg_from text, icon_bg_to text,
 loading_style text, catalog_label text, catalog_icon_px integer,
 catalog_font_px integer, catalog_pad_px integer, button_icon_px integer,
 show_download boolean, show_whatsapp boolean, show_add_to_cart boolean,
 show_try_again boolean, disclaimer_text text, loading_steps text[],
 updated_at timestamptz not null default now()
);
alter table public.tryon_jobs enable row level security;
alter table public.tryon_settings enable row level security;
revoke all on public.tryon_jobs, public.tryon_settings from public,anon,authenticated;
grant select,insert,update,delete on public.tryon_jobs,public.tryon_settings to service_role;
commit;
