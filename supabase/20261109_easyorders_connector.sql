-- File-only delta. Service-role RPCs are SECURITY INVOKER; no browser policies.
begin;

create table if not exists public.easyorders_connections (
  widget_site_id uuid primary key references public.widget_sites(id) on delete cascade,
  store_id text,
  store_name text,
  api_key jsonb, -- existing lib/shopify/token-crypto AES-GCM envelope
  api_key_hash text,
  webhook_token text not null unique check (webhook_token ~ '^[a-f0-9]{64}$'),
  webhook_secret jsonb,
  callback_origin text not null,
  status text not null default 'pending'
    check (status in ('pending','pending_confirmation','active','disconnected','error')),
  connected_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  order_cache_version bigint not null default 0,
  products_synced_at timestamptz,
  check (status <> 'active' or (api_key is not null and store_id is not null and api_key_hash is not null))
);
-- One API key cannot spend multiple sites' independent budgets.
create unique index if not exists easyorders_key_unique on public.easyorders_connections(api_key_hash)
  where api_key_hash is not null;
-- The provider callback only STAGES a credential here. It becomes the site's
-- connection only when the link's creator confirms on our dashboard, so a
-- forwarded install link cannot bind someone else's store to this site.
create table if not exists public.easyorders_install_states (
  widget_site_id uuid primary key references public.easyorders_connections(widget_site_id) on delete cascade,
  nonce_hash text not null check (nonce_hash ~ '^[a-f0-9]{64}$'),
  created_by text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  staged_key jsonb,
  staged_key_hash text,
  staged_store_id text,
  staged_expires_at timestamptz,
  outcome text check (outcome in ('active','rejected','expired','unverified')),
  check ((staged_key is null) = (staged_key_hash is null)
    and (staged_key is null) = (staged_store_id is null)
    and (staged_key is null) = (staged_expires_at is null))
);
-- Kept across disconnect/reinstall: rotating sites cannot refill a key's
-- provider budget or bypass its Retry-After. Contains no key or shopper data.
create table if not exists public.easyorders_api_budgets (
  api_key_hash text primary key,
  request_times timestamptz[] not null default '{}',
  blocked_until timestamptz
);
alter table public.easyorders_connections enable row level security;
alter table public.easyorders_install_states enable row level security;
alter table public.easyorders_api_budgets enable row level security;
revoke all on public.easyorders_connections, public.easyorders_install_states, public.easyorders_api_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.easyorders_connections, public.easyorders_install_states, public.easyorders_api_budgets to service_role;

-- Marker columns isolate imported products from manual/Shopify/Woo knowledge.
alter table public.messenger_knowledge add column if not exists easyorders_product_id text;
create unique index if not exists messenger_knowledge_easyorders_unique
  on public.messenger_knowledge(widget_site_id, easyorders_product_id);

create or replace function public.begin_easyorders_install(
  p_site uuid, p_user text, p_nonce text, p_expires timestamptz, p_token text, p_origin text
) returns boolean language plpgsql set search_path = public as $$
begin
  insert into easyorders_connections(widget_site_id, webhook_token, callback_origin)
    values(p_site, p_token, p_origin) on conflict do nothing;
  perform 1 from easyorders_connections where widget_site_id=p_site for update;
  if exists(select 1 from easyorders_connections where widget_site_id=p_site and api_key is not null) then
    return false; -- explicitly disconnect first; never orphan old webhook URLs
  end if;
  update easyorders_connections set webhook_token=p_token, callback_origin=p_origin, status='pending',
    last_error=null, last_webhook_at=null, products_synced_at=null where widget_site_id=p_site;
  -- A newer link supersedes the old one, including anything it staged.
  insert into easyorders_install_states(widget_site_id, nonce_hash, created_by, expires_at)
    values(p_site,p_nonce,p_user,p_expires) on conflict(widget_site_id) do update
    set nonce_hash=excluded.nonce_hash, created_by=excluded.created_by, expires_at=excluded.expires_at, consumed_at=null,
      staged_key=null, staged_key_hash=null, staged_store_id=null, staged_expires_at=null, outcome=null;
  return true;
end $$;

-- Callback: hold the delivered credential for 15 minutes. Never active here.
create or replace function public.stage_easyorders_install(
  p_site uuid, p_user text, p_nonce text, p_store text, p_key jsonb, p_key_hash text
) returns boolean language plpgsql set search_path = public as $$
begin
  perform 1 from easyorders_connections where widget_site_id=p_site for update;
  if not exists(select 1 from easyorders_connections where widget_site_id=p_site and status='pending' and api_key is null) then
    return false;
  end if;
  update easyorders_install_states set staged_key=p_key, staged_key_hash=p_key_hash, staged_store_id=p_store,
      staged_expires_at=clock_timestamp() + interval '15 minutes'
    where widget_site_id=p_site and created_by=p_user and nonce_hash=p_nonce
      and consumed_at is null and outcome is null and staged_key is null and expires_at > clock_timestamp();
  if not found then return false; end if;
  update easyorders_connections set status='pending_confirmation', last_error=null where widget_site_id=p_site;
  return true;
end $$;

-- Erases a staged credential and kills the link. Possession of the signed
-- state (its nonce) suffices: anyone holding the link may refuse it.
create or replace function public.discard_easyorders_install(p_site uuid, p_nonce text, p_outcome text)
returns boolean language plpgsql set search_path = public as $$
begin
  if p_outcome not in ('rejected','expired','unverified') then raise exception 'invalid_outcome'; end if;
  perform 1 from easyorders_connections where widget_site_id=p_site for update;
  update easyorders_install_states set staged_key=null, staged_key_hash=null, staged_store_id=null, staged_expires_at=null,
      consumed_at=coalesce(consumed_at, clock_timestamp()), outcome=p_outcome
    where widget_site_id=p_site and nonce_hash=p_nonce and outcome is null;
  if not found then return false; end if;
  update easyorders_connections set status='pending', last_error='install_'||p_outcome
    where widget_site_id=p_site and status='pending_confirmation';
  return true;
end $$;

-- Dashboard confirmation by the link's creator, after the app verified the
-- staged key with the provider. A replay reports the existing activation
-- (activated=false) and changes nothing.
create or replace function public.activate_easyorders_install(p_site uuid, p_user text, p_nonce text, p_store_name text)
returns jsonb language plpgsql set search_path = public as $$
declare c easyorders_connections; s easyorders_install_states; v_name text := nullif(left(btrim(p_store_name),200),'');
begin
  select * into c from easyorders_connections where widget_site_id=p_site for update;
  if not found then return jsonb_build_object('status','invalid'); end if;
  select * into s from easyorders_install_states where widget_site_id=p_site and nonce_hash=p_nonce and created_by=p_user;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if s.outcome = 'active' then
    if c.status = 'active' then
      return jsonb_build_object('status','active','activated',false,'store_id',c.store_id,'store_name',c.store_name);
    end if;
    return jsonb_build_object('status','invalid');
  end if;
  if s.outcome = 'expired' then return jsonb_build_object('status','expired'); end if;
  if s.outcome is not null or s.consumed_at is not null then return jsonb_build_object('status','invalid'); end if;
  if s.staged_key is null then
    return jsonb_build_object('status', case when s.expires_at <= clock_timestamp() then 'expired' else 'pending' end);
  end if;
  if s.staged_expires_at <= clock_timestamp() then
    perform discard_easyorders_install(p_site, p_nonce, 'expired');
    return jsonb_build_object('status','expired');
  end if;
  if c.status <> 'pending_confirmation' or c.api_key is not null then return jsonb_build_object('status','invalid'); end if;
  begin
    update easyorders_connections set api_key=s.staged_key, api_key_hash=s.staged_key_hash, store_id=s.staged_store_id,
      store_name=v_name, status='active', connected_at=clock_timestamp(), last_error=null,
      order_cache_version=order_cache_version+1 where widget_site_id=p_site;
  exception when unique_violation then
    perform discard_easyorders_install(p_site, p_nonce, 'rejected');
    return jsonb_build_object('status','conflict');
  end;
  update easyorders_install_states set consumed_at=clock_timestamp(), outcome='active',
    staged_key=null, staged_key_hash=null, staged_store_id=null, staged_expires_at=null where widget_site_id=p_site;
  return jsonb_build_object('status','active','activated',true,'store_id',s.staged_store_id,'store_name',v_name);
end $$;

-- Exact rolling 40/minute ceiling, serialized by the connection row lock.
-- Shared by orders, product imports, webhook deletion and the one staged-key
-- verification read (p_verify). Missing rows deny.
create or replace function public.reserve_easyorders_request(
  p_site uuid, p_token text, p_cleanup boolean default false, p_verify boolean default false
) returns jsonb language plpgsql set search_path = public as $$
declare c easyorders_connections; b easyorders_api_budgets; t timestamptz := clock_timestamp(); recent timestamptz[]; v_hash text;
begin
  select * into c from easyorders_connections where widget_site_id=p_site and webhook_token=p_token for update;
  if found and p_verify then
    if c.status = 'pending_confirmation' and c.api_key is null then
      select staged_key_hash into v_hash from easyorders_install_states
        where widget_site_id=p_site and outcome is null and staged_expires_at > t;
    end if;
  elsif found and c.api_key is not null and (c.status = 'active' or (p_cleanup and c.status = 'error')) then
    v_hash := c.api_key_hash;
  end if;
  if v_hash is null then
    return jsonb_build_object('success',false,'reset',extract(epoch from t + interval '30 seconds')*1000);
  end if;
  insert into easyorders_api_budgets(api_key_hash) values(v_hash) on conflict do nothing;
  select * into b from easyorders_api_budgets where api_key_hash=v_hash for update;
  t := clock_timestamp();
  if b.blocked_until > t then
    return jsonb_build_object('success',false,'reset',extract(epoch from b.blocked_until)*1000);
  end if;
  select coalesce(array_agg(x order by x),'{}') into recent from unnest(b.request_times) x
    where x > t - interval '60 seconds';
  if cardinality(recent) >= 40 then
    return jsonb_build_object('success',false,'reset',extract(epoch from recent[1] + interval '60 seconds')*1000);
  end if;
  update easyorders_api_budgets set request_times=array_append(recent,t) where api_key_hash=v_hash;
  return jsonb_build_object('success',true,'reset',extract(epoch from t + interval '60 seconds')*1000);
end $$;

create or replace function public.cooldown_easyorders(p_site uuid, p_token text, p_seconds integer)
returns void language plpgsql set search_path = public as $$
declare v_hash text;
begin
  -- Same lock order as reserve: connection before key budget.
  perform 1 from easyorders_connections where widget_site_id=p_site and webhook_token=p_token for update;
  if not found then return; end if;
  select coalesce(c.api_key_hash, s.staged_key_hash) into v_hash from easyorders_connections c
    left join easyorders_install_states s on s.widget_site_id=c.widget_site_id
    where c.widget_site_id=p_site and c.webhook_token=p_token;
  update easyorders_api_budgets set blocked_until=greatest(blocked_until,clock_timestamp() + make_interval(secs => greatest(60,p_seconds)))
    where api_key_hash=v_hash;
  update easyorders_connections set last_error='rate_limited' where widget_site_id=p_site and webhook_token=p_token;
end
$$;

-- Writes the row only when there is something to record: delivery time at
-- most once a minute, and the cache epoch only for a real status change.
create or replace function public.record_easyorders_webhook(p_site uuid, p_token text, p_changed boolean default false)
returns boolean language plpgsql set search_path = public as $$
begin
  update easyorders_connections set
      last_webhook_at=case when last_webhook_at is null or last_webhook_at <= clock_timestamp() - interval '60 seconds'
        then clock_timestamp() else last_webhook_at end,
      order_cache_version=order_cache_version + case when p_changed then 1 else 0 end
    where widget_site_id=p_site and webhook_token=p_token and status='active'
      and (p_changed or last_webhook_at is null or last_webhook_at <= clock_timestamp() - interval '60 seconds');
  if found then return true; end if;
  return exists(select 1 from easyorders_connections where widget_site_id=p_site and webhook_token=p_token and status='active');
end $$;

-- Store coarse health codes only, never a provider body or exception text.
create or replace function public.record_easyorders_api_result(p_site uuid, p_token text, p_error text)
returns void language plpgsql set search_path = public as $$
begin
  if p_error is not null and p_error not in ('api_unavailable','unauthorized') then raise exception 'invalid_error'; end if;
  update easyorders_connections set last_error=p_error,
    status=case when p_error='unauthorized' then 'error' else status end
    where widget_site_id=p_site and webhook_token=p_token and status='active';
end $$;

create or replace function public.begin_easyorders_disconnect(p_site uuid, p_token text)
returns boolean language plpgsql set search_path = public as $$
begin
  update easyorders_connections set status='error', last_error='disconnecting', order_cache_version=order_cache_version+1
    where widget_site_id=p_site and webhook_token=p_token and status <> 'disconnected';
  if not found then return false; end if;
  update easyorders_install_states set consumed_at=coalesce(consumed_at, clock_timestamp()), outcome=coalesce(outcome,'rejected'),
    staged_key=null, staged_key_hash=null, staged_store_id=null, staged_expires_at=null where widget_site_id=p_site;
  update messenger_knowledge set status='disabled' where widget_site_id=p_site and easyorders_product_id is not null;
  return true;
end $$;

create or replace function public.finish_easyorders_disconnect(p_site uuid, p_token text)
returns boolean language plpgsql set search_path = public as $$
begin
  update easyorders_connections set status='disconnected', api_key=null, api_key_hash=null, webhook_secret=null,
    store_name=null, last_error=null, products_synced_at=null, order_cache_version=order_cache_version+1
    where widget_site_id=p_site and webhook_token=p_token and status='error' and last_error in ('disconnecting','rate_limited');
  return found;
end $$;

create or replace function public.sync_easyorders_knowledge(p_site uuid, p_token text, p_entries jsonb)
returns integer language plpgsql set search_path = public as $$
declare n integer;
begin
  perform 1 from easyorders_connections where widget_site_id=p_site and webhook_token=p_token and status='active' for update;
  if not found then raise exception 'connection_unavailable'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 50 then raise exception 'invalid_products'; end if;
  update messenger_knowledge set status='disabled' where widget_site_id=p_site and easyorders_product_id is not null;
  insert into messenger_knowledge(widget_site_id,easyorders_product_id,title,content,source,status,last_synced_at)
    select p_site,e->>'id',left(e->>'title',200),left(e->>'content',15000),'product','active',clock_timestamp()
      from jsonb_array_elements(p_entries) e
    on conflict(widget_site_id,easyorders_product_id) do update set title=excluded.title,content=excluded.content,
      status='active',last_synced_at=excluded.last_synced_at,updated_at=clock_timestamp();
  get diagnostics n = row_count;
  update easyorders_connections set products_synced_at=clock_timestamp(), last_error=null where widget_site_id=p_site;
  return n;
end $$;

revoke all on function public.begin_easyorders_install(uuid,text,text,timestamptz,text,text),
  public.stage_easyorders_install(uuid,text,text,text,jsonb,text), public.discard_easyorders_install(uuid,text,text),
  public.activate_easyorders_install(uuid,text,text,text), public.reserve_easyorders_request(uuid,text,boolean,boolean),
  public.cooldown_easyorders(uuid,text,integer), public.record_easyorders_webhook(uuid,text,boolean),
  public.record_easyorders_api_result(uuid,text,text),
  public.begin_easyorders_disconnect(uuid,text), public.finish_easyorders_disconnect(uuid,text),
  public.sync_easyorders_knowledge(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.begin_easyorders_install(uuid,text,text,timestamptz,text,text),
  public.stage_easyorders_install(uuid,text,text,text,jsonb,text), public.discard_easyorders_install(uuid,text,text),
  public.activate_easyorders_install(uuid,text,text,text), public.reserve_easyorders_request(uuid,text,boolean,boolean),
  public.cooldown_easyorders(uuid,text,integer), public.record_easyorders_webhook(uuid,text,boolean),
  public.record_easyorders_api_result(uuid,text,text),
  public.begin_easyorders_disconnect(uuid,text), public.finish_easyorders_disconnect(uuid,text),
  public.sync_easyorders_knowledge(uuid,text,jsonb) to service_role;
commit;
