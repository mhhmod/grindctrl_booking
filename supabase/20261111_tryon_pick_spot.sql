-- Pick a spot (Pack B): where each store's Try-On button goes, and the
-- one-time links that open edit mode on the store.
-- Additive and idempotent: runs twice without error.
-- Tokens are short lived; a later retention job may prune rows whose
-- expires_at is older than 30 days. Nothing here removes data.
-- Rollback (behaviour, keeps data):
--   revoke execute on function public.claim_tryon_pick_token(uuid, text, text),
--     public.save_tryon_picked_spot(uuid, text, text, text, jsonb) from service_role;
--   update public.tryon_button_placements set placement = 'auto';
-- The app reads a missing table as automatic placement, so the app can ship
-- before or after this file.
begin;
create schema if not exists private;

create table if not exists public.tryon_button_placements (
  shop text primary key check (shop <> 'default' and length(shop) between 1 and 300),
  placement text not null default 'auto' check (placement in ('auto','spot','floating')),
  spot jsonb,
  updated_at timestamptz not null default now(),
  check (spot is null or (jsonb_typeof(spot) = 'object'
    and length(spot->>'selector') between 1 and 300
    and spot->>'position' in ('before','after')
    and length(coalesce(spot->>'label', '')) <= 60
    and length(coalesce(spot->>'pathHint', '/')) between 1 and 1024)),
  check (placement <> 'spot' or spot is not null)
);

create table if not exists public.tryon_pick_tokens (
  id uuid primary key,
  shop text not null check (shop <> 'default' and length(shop) between 1 and 300),
  origin text not null check (origin ~ '^https://[^/?#]+$'),
  created_by text not null check (length(created_by) between 1 and 200),
  -- The advanced field's selector to preselect, validated by the app.
  preset jsonb check (preset is null or jsonb_typeof(preset) = 'object'),
  -- sha256 of the random value the first store tab holds; later calls must match.
  claim_hash text check (claim_hash is null or claim_hash ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tryon_pick_tokens_shop_created_idx on public.tryon_pick_tokens (shop, created_at desc);

alter table public.tryon_button_placements enable row level security;
alter table public.tryon_pick_tokens enable row level security;
-- No anon/authenticated policies: only the service role reads or writes.
revoke all on public.tryon_button_placements, public.tryon_pick_tokens from public, anon, authenticated;
grant select, insert, update on public.tryon_button_placements to service_role;
grant select, insert on public.tryon_pick_tokens to service_role;

-- The first verified store tab claims the link; the same tab may verify again
-- (reload, another product page). Returns { shop, preset }, or null.
create or replace function private.claim_tryon_pick_token(p_id uuid, p_origin text, p_claim text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_claim is null or p_claim !~ '^[0-9a-f]{64}$' then raise exception 'invalid claim'; end if;
  update public.tryon_pick_tokens
    set claim_hash = coalesce(claim_hash, p_claim), claimed_at = coalesce(claimed_at, now())
    where id = p_id and origin = p_origin and consumed_at is null and expires_at > now()
      and (claim_hash is null or claim_hash = p_claim)
    returning pg_catalog.jsonb_build_object('shop', shop, 'preset', preset) into v_result;
  return v_result;
end;
$$;

-- Consume the link and store the spot in one transaction: a failure keeps
-- the link usable, so the store tab can retry with its selection.
create or replace function private.save_tryon_picked_spot(p_id uuid, p_shop text, p_origin text, p_claim text, p_spot jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_shop is null or p_shop = 'default' or p_spot is null or jsonb_typeof(p_spot) <> 'object'
    or coalesce(length(p_spot->>'selector'), 0) not between 1 and 300
    or coalesce(p_spot->>'position', '') not in ('before','after') then
    raise exception 'invalid spot';
  end if;
  update public.tryon_pick_tokens set consumed_at = now()
    where id = p_id and shop = p_shop and origin = p_origin and claim_hash = p_claim
      and consumed_at is null and expires_at > now();
  if not found then return false; end if;
  insert into public.tryon_button_placements(shop, placement, spot, updated_at)
    values (p_shop, 'spot', p_spot, now())
    on conflict (shop) do update
      set placement = excluded.placement, spot = excluded.spot, updated_at = excluded.updated_at;
  return true;
end;
$$;

-- PostgREST entry points are invoker-only; the definers stay unexposed.
create or replace function public.claim_tryon_pick_token(p_id uuid, p_origin text, p_claim text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.claim_tryon_pick_token(p_id, p_origin, p_claim);
$$;
create or replace function public.save_tryon_picked_spot(p_id uuid, p_shop text, p_origin text, p_claim text, p_spot jsonb)
returns boolean language sql security invoker set search_path = '' as $$
  select private.save_tryon_picked_spot(p_id, p_shop, p_origin, p_claim, p_spot);
$$;

revoke all on function private.claim_tryon_pick_token(uuid, text, text),
  private.save_tryon_picked_spot(uuid, text, text, text, jsonb),
  public.claim_tryon_pick_token(uuid, text, text),
  public.save_tryon_picked_spot(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_tryon_pick_token(uuid, text, text),
  private.save_tryon_picked_spot(uuid, text, text, text, jsonb),
  public.claim_tryon_pick_token(uuid, text, text),
  public.save_tryon_picked_spot(uuid, text, text, text, jsonb) to service_role;
commit;
