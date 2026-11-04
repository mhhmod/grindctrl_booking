-- WooCommerce / WordPress privacy requests (WooCommerce parity phase 6).
--
-- Shopify has mandatory privacy webhooks; WordPress has Tools > Export / Erase
-- Personal Data. These functions back the plugin's exporter and eraser, and
-- the post-uninstall redaction of a site's shopper data.
--
-- Scope rules, enforced inside every function:
--   * the site must have a woo_site_connections row, so a Shopify widget site
--     (which never has one) can not be reached through these functions;
--   * every statement is filtered by widget_site_id = p_site, so another site's
--     shoppers are never read or deleted;
--   * Shopify tenants (tryon_shops.shop_domain like '%.myshopify.com') are not
--     touched: try-on rows are matched by the exact site tenant key only.
--
-- Additive and idempotent. Apply manually after review; nothing here runs
-- automatically. Auth, RLS and storage impact:
--   * auth: no change; functions are security definer, service_role only.
--   * RLS: the new queue table has RLS on and no browser policies.
--   * storage: no bucket change; object paths are queued here and removed by
--     the server through the Storage API (the internal retention job retries).

begin;

alter table public.woo_site_connections
  add column if not exists redact_after timestamptz,
  add column if not exists redacted_at timestamptz;

create index if not exists woo_site_connections_redact_due
  on public.woo_site_connections (redact_after)
  where redact_after is not null;

-- Storage objects whose database rows are already gone. A row stays here until
-- the Storage API confirms removal, so a failed removal is retried instead of
-- orphaning the object.
create table if not exists public.woo_privacy_storage_queue (
  bucket text not null,
  path text not null,
  widget_site_id uuid not null,
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);

alter table public.woo_privacy_storage_queue enable row level security;
revoke all on table public.woo_privacy_storage_queue from public, anon, authenticated;
grant select, insert, update, delete on table public.woo_privacy_storage_queue to service_role;

comment on column public.woo_site_connections.redact_after is
  'Set when the plugin reports an uninstall; the retention job redacts the site''s shopper data once this time has passed. Cleared by a re-pair.';
comment on table public.woo_privacy_storage_queue is
  'Server-only list of storage objects awaiting removal after a WooCommerce privacy erase or site redaction.';

-- Conversations on one site that belong to an email: the verified login or
-- typed contact address on the conversation, or the visitor's stored email.
create or replace function public.woo_privacy_matches(p_site uuid, p_email text)
returns setof uuid
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select c.id
  from public.widget_conversations c
  where c.widget_site_id = p_site
    and p_email <> ''
    and (
      lower(c.metadata #>> '{identity,email}') = p_email
      or lower(c.metadata ->> 'contact_email') = p_email
      or exists (
        select 1 from public.widget_visitors v
        where v.id = c.visitor_id and lower(v.user_email) = p_email
      )
    )
$$;

create or replace function public.woo_privacy_export(
  p_site uuid, p_email text, p_page integer default 1, p_page_size integer default 10
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 10), 1), 25);
  v_total integer;
  v_conversations jsonb;
  v_visitors jsonb := '[]';
  v_leads jsonb := '[]';
begin
  if v_email = '' or position('@' in v_email) = 0 or char_length(v_email) > 200 then
    raise exception 'woo_privacy_invalid_email';
  end if;
  if not exists (select 1 from public.woo_site_connections where widget_site_id = p_site) then
    raise exception 'woo_privacy_unknown_site';
  end if;

  select count(*) into v_total from public.woo_privacy_matches(p_site, v_email);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'startedAt', c.started_at,
    'status', c.status,
    'lastPageUrl', c.last_page_url,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'createdAt', m.created_at)
        order by m.created_at, m.id)
      from public.widget_messages m where m.conversation_id = c.id), '[]'),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'mime', a.mime, 'bytes', a.bytes, 'createdAt', a.created_at)
        order by a.created_at, a.id)
      from public.messenger_attachments a where a.conversation_id = c.id), '[]'),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('rating', f.rating, 'comment', f.comment))
      from public.messenger_feedback f where f.conversation_id = c.id), '[]'),
    'questions', coalesce((
      select jsonb_agg(u.question order by u.created_at, u.id)
      from public.messenger_unanswered u where u.conversation_id = c.id), '[]')
  ) order by c.started_at, c.id), '[]')
  into v_conversations
  from (
    select * from public.widget_conversations
    where id in (select public.woo_privacy_matches(p_site, v_email))
    order by started_at, id
    offset (v_page - 1) * v_size limit v_size
  ) c;

  if v_page = 1 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', v.user_name, 'email', v.user_email,
      'firstSeenAt', v.first_seen_at, 'lastSeenAt', v.last_seen_at) order by v.first_seen_at, v.id), '[]')
    into v_visitors
    from public.widget_visitors v
    where v.widget_site_id = p_site and lower(v.user_email) = v_email;

    select coalesce(jsonb_agg(jsonb_build_object(
      'name', l.name, 'email', l.email, 'phone', l.phone, 'company', l.company,
      'createdAt', l.created_at) order by l.created_at, l.id), '[]')
    into v_leads
    from public.widget_leads l
    where l.widget_site_id = p_site and lower(l.email) = v_email;
  end if;

  return jsonb_build_object(
    'conversations', v_conversations,
    'visitors', v_visitors,
    'leads', v_leads,
    'total', v_total,
    'done', v_page * v_size >= v_total
  );
end $$;

-- Deletes up to p_batch matching conversations with everything attached to
-- them, then the visitor and lead rows that no longer have a reason to exist.
-- Callers repeat until "remaining" is 0. Attachment objects are queued for the
-- server to remove from Storage.
create or replace function public.woo_privacy_erase(
  p_site uuid, p_email text, p_batch integer default 10
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_batch integer := least(greatest(coalesce(p_batch, 10), 1), 25);
  v_ids uuid[];
  v_visitors uuid[];
  v_counts jsonb := '{}';
  v_n integer;
  v_remaining integer;
begin
  if v_email = '' or position('@' in v_email) = 0 or char_length(v_email) > 200 then
    raise exception 'woo_privacy_invalid_email';
  end if;
  if not exists (select 1 from public.woo_site_connections where widget_site_id = p_site) then
    raise exception 'woo_privacy_unknown_site';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from public.widget_conversations
    where id in (select public.woo_privacy_matches(p_site, v_email))
    order by started_at, id limit v_batch
  ) b;
  select coalesce(array_agg(distinct visitor_id), '{}') into v_visitors
  from public.widget_conversations where id = any(v_ids);

  insert into public.woo_privacy_storage_queue (bucket, path, widget_site_id)
  select 'messenger-attachments', a.storage_path, p_site
  from public.messenger_attachments a
  where a.conversation_id = any(v_ids) and a.widget_site_id = p_site
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('storage_objects_queued', v_n);

  delete from public.messenger_attachments where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('attachments', v_n);
  delete from public.messenger_unanswered where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('unanswered', v_n);
  delete from public.messenger_feedback where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('feedback', v_n);
  delete from public.widget_events where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('events', v_n);
  delete from public.widget_messages where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('messages', v_n);
  delete from public.messenger_audit
  where widget_site_id = p_site
    and (detail ->> 'conversation_id') = any(v_ids::text[]);
  delete from public.widget_leads
  where widget_site_id = p_site
    and (lower(email) = v_email or conversation_id = any(v_ids) or visitor_id = any(v_visitors));
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('leads', v_n);
  delete from public.widget_conversations where id = any(v_ids) and widget_site_id = p_site;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('conversations', v_n);

  delete from public.widget_visitors v
  where v.widget_site_id = p_site
    and (v.id = any(v_visitors) or lower(v.user_email) = v_email)
    and not exists (select 1 from public.widget_conversations c where c.visitor_id = v.id);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('visitors', v_n);

  select count(*) into v_remaining from public.woo_privacy_matches(p_site, v_email);
  return jsonb_build_object('counts', v_counts, 'remaining', v_remaining);
end $$;

-- Redacts every shopper record of a site whose plugin was uninstalled, once the
-- grace period in redact_after has passed. Works in bounded batches: call until
-- "done" is true. Merchant configuration, the connection row and billing
-- evidence stay. A site that was re-paired (redact_after cleared) or is not
-- disconnected is skipped, so a late run can never redact a live site.
create or replace function public.woo_site_redact(p_site uuid, p_batch integer default 100)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_batch integer := least(greatest(coalesce(p_batch, 100), 1), 500);
  v_conn public.woo_site_connections;
  v_tenant text := 'site:' || p_site::text;
  v_ids uuid[];
  v_counts jsonb := '{}';
  v_n integer;
  v_left integer;
begin
  select * into v_conn from public.woo_site_connections
  where widget_site_id = p_site for update;
  if not found then raise exception 'woo_privacy_unknown_site'; end if;
  if v_conn.status <> 'disconnected' or v_conn.redact_after is null or v_conn.redact_after > now() then
    return jsonb_build_object('redacted', false, 'done', false, 'reason', 'not_due');
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from public.widget_conversations
    where widget_site_id = p_site order by started_at, id limit v_batch
  ) b;

  insert into public.woo_privacy_storage_queue (bucket, path, widget_site_id)
  select 'messenger-attachments', a.storage_path, p_site
  from public.messenger_attachments a
  where a.conversation_id = any(v_ids) and a.widget_site_id = p_site
  on conflict do nothing;

  delete from public.messenger_attachments where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('attachments', v_n);
  delete from public.messenger_unanswered where conversation_id = any(v_ids);
  delete from public.messenger_feedback where conversation_id = any(v_ids);
  delete from public.widget_events where conversation_id = any(v_ids);
  delete from public.widget_messages where conversation_id = any(v_ids);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('messages', v_n);
  delete from public.widget_conversations where id = any(v_ids) and widget_site_id = p_site;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('conversations', v_n);

  select count(*) into v_left from public.widget_conversations where widget_site_id = p_site;
  if v_left > 0 then
    return jsonb_build_object('redacted', true, 'done', false, 'counts', v_counts);
  end if;

  -- No conversation remains: clear everything else shopper-shaped on the site.
  delete from public.messenger_unanswered where widget_site_id = p_site;
  delete from public.messenger_feedback where widget_site_id = p_site;
  delete from public.widget_events where widget_site_id = p_site;
  delete from public.widget_leads where widget_site_id = p_site;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('leads', v_n);
  delete from public.widget_visitors where widget_site_id = p_site;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('visitors', v_n);

  -- Try-on results of this site tenant only. Jobs referenced by the credit
  -- ledger stay as accounting evidence, as in the Shopify shop/redact flow.
  insert into public.woo_privacy_storage_queue (bucket, path, widget_site_id)
  select 'tryon-results', j.result_storage_path, p_site
  from public.tryon_jobs j
  where j.shop = v_tenant and j.result_storage_path is not null
  on conflict do nothing;
  delete from public.tryon_jobs j
  where j.shop = v_tenant
    and not exists (select 1 from public.tryon_credit_ledger l where l.job_id = j.id);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tryon_jobs', v_n);

  update public.woo_site_connections
  set redact_after = null, redacted_at = now()
  where widget_site_id = p_site;

  return jsonb_build_object('redacted', true, 'done', true, 'counts', v_counts);
end $$;

-- Sites whose grace period has passed, oldest first.
create or replace function public.woo_sites_due_for_redaction(p_limit integer default 5)
returns setof uuid
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select widget_site_id from public.woo_site_connections
  where status = 'disconnected' and redact_after is not null and redact_after <= now()
  order by redact_after, widget_site_id
  limit least(greatest(coalesce(p_limit, 5), 1), 25)
$$;

revoke all on function public.woo_privacy_matches(uuid, text) from public, anon, authenticated;
revoke all on function public.woo_privacy_export(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.woo_privacy_erase(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.woo_site_redact(uuid, integer) from public, anon, authenticated;
revoke all on function public.woo_sites_due_for_redaction(integer) from public, anon, authenticated;
grant execute on function public.woo_privacy_export(uuid, text, integer, integer) to service_role;
grant execute on function public.woo_privacy_erase(uuid, text, integer) to service_role;
grant execute on function public.woo_site_redact(uuid, integer) to service_role;
grant execute on function public.woo_sites_due_for_redaction(integer) to service_role;

commit;

-- Rollback notes (the functions and queue are safe to drop; the columns hold
-- only scheduling state):
-- begin;
-- drop function if exists public.woo_sites_due_for_redaction(integer);
-- drop function if exists public.woo_site_redact(uuid, integer);
-- drop function if exists public.woo_privacy_erase(uuid, text, integer);
-- drop function if exists public.woo_privacy_export(uuid, text, integer, integer);
-- drop function if exists public.woo_privacy_matches(uuid, text);
-- drop table if exists public.woo_privacy_storage_queue;
-- drop index if exists public.woo_site_connections_redact_due;
-- alter table public.woo_site_connections drop column if exists redacted_at;
-- alter table public.woo_site_connections drop column if exists redact_after;
-- commit;
