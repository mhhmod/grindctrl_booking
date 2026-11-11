-- G17. OWNER REVIEW: manual additive delta after all migrations through 20261111.
-- No apply-time deletion. Deletes run only when retention/erase/redaction is invoked.
-- Bases: retention_finish/visitors: 20261101_privacy_fulfilment.sql;
-- woo_privacy_matches/export/erase: 20261105_woo_privacy.sql (latest on main).
-- privacy_schedule, disconnect_paste_site, paste_site_redact and
-- paste_sites_due_for_redaction are NEW; redaction follows woo_site_redact
-- from 20261105_woo_privacy.sql, preserving its Storage queue/accounting rules.
-- Rollback: stop the retention schedule and deploy the previous app first;
-- restore the five replaced definitions from the base files named above.
-- Revoke service_role EXECUTE on the four new functions (including the trigger
-- function), detach paste_privacy_schedule, and retain scheduling columns and
-- the Storage queue until pending removals have been reviewed/drained.
-- Never restore deleted shopper rows except through an owner-approved backup
-- recovery: completed retention/erase is irreversible. No grant/refund changes.
-- Paste identity comes from paste_site_connections, never a guessed URL/platform.
-- Existing RLS/queue/storage handling is reused; new functions are service-only.
begin;
create or replace function public.shopify_chat_retention_finish(p_conversation uuid, p_claim uuid, p_paths text[])
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_task public.shopify_chat_retention_tasks%rowtype;
  v_messages integer := 0; v_attachments integer := 0; v_events integer := 0;
  v_feedback integer := 0; v_unanswered integer := 0;
begin
  perform 1 from public.widget_conversations where id = p_conversation for update;
  select * into v_task from public.shopify_chat_retention_tasks where conversation_id = p_conversation for update;
  if not found or v_task.claim is distinct from p_claim or v_task.attachment_paths is distinct from p_paths
    or v_task.claim_until <= clock_timestamp() then raise exception 'chat_retention_claim_lost'; end if;
  delete from public.messenger_attachments where conversation_id = p_conversation and storage_path = any(p_paths);
  get diagnostics v_attachments = row_count;
  if exists (select 1 from public.messenger_attachments where conversation_id = p_conversation) then
    update public.shopify_chat_retention_tasks set claim_until = '-infinity', attachment_paths = '{}'::text[]
      where conversation_id = p_conversation;
    return jsonb_build_object('conversations',0,'messages',0,'attachments',v_attachments,'events',0,'feedback',0,'unanswered',0,'pending',1);
  end if;
  delete from public.messenger_unanswered where conversation_id = p_conversation;
  get diagnostics v_unanswered = row_count;
  delete from public.messenger_feedback where conversation_id = p_conversation;
  get diagnostics v_feedback = row_count;
  delete from public.widget_events where conversation_id = p_conversation;
  get diagnostics v_events = row_count;
  delete from public.widget_messages where conversation_id = p_conversation;
  get diagnostics v_messages = row_count;
  -- Delete leads before the conversation FK can SET NULL and lose the link.
  delete from public.messenger_audit a where
    a.widget_site_id=(select c.widget_site_id from public.widget_conversations c where c.id=p_conversation)
    and (a.detail->>'conversation_id'=p_conversation::text or a.detail->>'conversationId'=p_conversation::text
    or exists(select 1 from public.widget_leads l where l.conversation_id=p_conversation
      and a.widget_site_id=l.widget_site_id and (a.detail->>'lead_id'=l.id::text or a.detail->>'leadId'=l.id::text)));
  delete from public.widget_leads where conversation_id=p_conversation;
  delete from public.widget_conversations where id = p_conversation;
  return jsonb_build_object('conversations',1,'messages',v_messages,'attachments',v_attachments,
    'events',v_events,'feedback',v_feedback,'unanswered',v_unanswered,'pending',0);
end $$;

create or replace function public.shopify_chat_retention_visitors(p_limit integer)
returns integer language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_count integer := 0; v_visitor record; v_lead record;
begin
  -- Lead lifetime is twelve months even when its chat is still active.
  -- This also sweeps detached leads left by earlier retention.
  for v_lead in
    select l.id,l.widget_site_id from public.widget_leads l
    where l.created_at < clock_timestamp()-interval '12 months'
    order by l.created_at,l.id limit greatest(1,least(coalesce(p_limit,25),25))
    for update of l skip locked
  loop
    delete from public.messenger_audit a where a.widget_site_id=v_lead.widget_site_id
      and (a.detail->>'lead_id'=v_lead.id::text or a.detail->>'leadId'=v_lead.id::text);
    delete from public.widget_leads where id=v_lead.id;
  end loop;
  -- Old conversation audit references can also outlive their parent.
  delete from public.messenger_audit where id in (
    select a.id from public.messenger_audit a
    where a.created_at < clock_timestamp()-interval '12 months'
      and coalesce(a.detail->>'conversation_id',a.detail->>'conversationId') is not null
      and not exists(select 1 from public.widget_conversations c
        where c.id::text=coalesce(a.detail->>'conversation_id',a.detail->>'conversationId'))
    order by a.created_at,a.id limit greatest(1,least(coalesce(p_limit,25),25))
    for update of a skip locked);
  for v_visitor in
    select v.id from public.widget_visitors v
    where greatest(v.first_seen_at,v.last_seen_at) < clock_timestamp() - interval '12 months'
      and not exists (select 1 from public.widget_conversations c where c.visitor_id = v.id)
    order by v.last_seen_at,v.id limit greatest(1,least(coalesce(p_limit,25),25))
    for update of v skip locked
  loop
    -- Recheck after the row lock: a concurrent conversation insertion may
    -- have committed while the selector waited for its foreign-key lock.
    if not exists (select 1 from public.widget_conversations c where c.visitor_id = v_visitor.id) then
      delete from public.widget_visitors where id = v_visitor.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- Base: 20261105_woo_privacy.sql. Contact capture may have stored the
-- address only on a lead; include that link without crossing site boundaries.
create or replace function public.woo_privacy_matches(p_site uuid, p_email text)
returns setof uuid
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select c.id
  from public.widget_conversations c
  where c.widget_site_id = p_site and p_email <> '' and (
    lower(c.metadata #>> '{identity,email}') = p_email
    or lower(c.metadata ->> 'contact_email') = p_email
    or exists (select 1 from public.widget_visitors v
      where v.id=c.visitor_id and v.widget_site_id=p_site and lower(v.user_email)=p_email)
    or exists (select 1 from public.widget_leads l where l.widget_site_id=p_site
      and lower(l.email)=p_email and (l.conversation_id=c.id or l.visitor_id=c.visitor_id))
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
  if not exists (select 1 from public.woo_site_connections where widget_site_id = p_site)
    and not exists (select 1 from public.paste_site_connections where widget_site_id = p_site) then
    raise exception 'woo_privacy_unknown_site';
  end if;

  select count(*) into v_total from public.woo_privacy_matches(p_site, v_email);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'startedAt', c.started_at,
    'status', c.status,
    'lastPageUrl', c.last_page_url,
    'lastReferrer', c.last_referrer,
    'metadata', c.metadata,
    'inboxUpdatedAt', c.inbox_updated_at,
    'inboxHandoffAt', c.inbox_handoff_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'name', e.event_name, 'payload', e.payload, 'createdAt', e.created_at) order by e.created_at,e.id)
      from public.widget_events e where e.conversation_id=c.id and e.widget_site_id=p_site), '[]'),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
      'action', a.action, 'detail', a.detail, 'createdAt', a.created_at) order by a.created_at,a.id)
      from public.messenger_audit a where a.widget_site_id=p_site and
        (a.detail->>'conversation_id'=c.id::text or a.detail->>'conversationId'=c.id::text)), '[]'),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'metadata', m.metadata, 'createdAt', m.created_at)
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
      'name', v.user_name, 'email', v.user_email, 'metadata', v.metadata,
      'firstSeenAt', v.first_seen_at, 'lastSeenAt', v.last_seen_at) order by v.first_seen_at, v.id), '[]')
    into v_visitors
    from public.widget_visitors v
    where v.widget_site_id = p_site and (lower(v.user_email) = v_email
      or exists(select 1 from public.widget_conversations c
        where c.visitor_id=v.id and c.widget_site_id=p_site
          and c.id in(select public.woo_privacy_matches(p_site,v_email))));

    select coalesce(jsonb_agg(jsonb_build_object(
      'name', l.name, 'email', l.email, 'phone', l.phone, 'company', l.company,
      'sourceDomain', l.source_domain, 'createdAt', l.created_at,
      'audit', coalesce((select jsonb_agg(jsonb_build_object(
        'action', a.action, 'detail', a.detail, 'createdAt', a.created_at) order by a.created_at,a.id)
        from public.messenger_audit a where a.widget_site_id=p_site and
          (a.detail->>'lead_id'=l.id::text or a.detail->>'leadId'=l.id::text)), '[]')) order by l.created_at, l.id), '[]')
    into v_leads
    from public.widget_leads l
    where l.widget_site_id = p_site and (lower(l.email) = v_email
      or l.conversation_id in(select public.woo_privacy_matches(p_site,v_email))
      or exists(select 1 from public.widget_conversations c
        where c.visitor_id=l.visitor_id and c.widget_site_id=p_site
          and c.id in(select public.woo_privacy_matches(p_site,v_email))));
  end if;

  return jsonb_build_object(
    'conversations', v_conversations,
    'visitors', v_visitors,
    'leads', v_leads,
    'total', v_total,
    'done', v_page * v_size >= v_total
  );
end $$;

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
  v_leads uuid[];
  v_counts jsonb := '{}';
  v_n integer;
  v_remaining integer;
begin
  if v_email = '' or position('@' in v_email) = 0 or char_length(v_email) > 200 then
    raise exception 'woo_privacy_invalid_email';
  end if;
  if not exists (select 1 from public.woo_site_connections where widget_site_id = p_site)
    and not exists (select 1 from public.paste_site_connections where widget_site_id = p_site) then
    raise exception 'woo_privacy_unknown_site';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from public.widget_conversations
    where id in (select public.woo_privacy_matches(p_site, v_email))
    order by started_at, id limit v_batch
  ) b;
  select coalesce(array_agg(distinct visitor_id), '{}') into v_visitors
  from public.widget_conversations where id = any(v_ids);

  -- A lead can be the only email-to-visitor link. Keep it until the last
  -- linked chat's batch, or subsequent calls would falsely report no matches.
  select coalesce(array_agg(l.id), '{}') into v_leads
  from public.widget_leads l
  where l.widget_site_id=p_site
    and (lower(l.email)=v_email or l.conversation_id=any(v_ids) or l.visitor_id=any(v_visitors))
    and not exists(select 1 from public.widget_conversations c
      where c.widget_site_id=p_site and not (c.id=any(v_ids))
        and (c.id=l.conversation_id or c.visitor_id=l.visitor_id));

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
    and ((detail ->> 'conversation_id') = any(v_ids::text[])
      or (detail ->> 'conversationId') = any(v_ids::text[])
      or (detail->>'lead_id') = any(v_leads::text[])
      or (detail->>'leadId') = any(v_leads::text[]));
  delete from public.widget_leads
  where widget_site_id = p_site and id = any(v_leads);
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

alter table public.paste_site_connections
  add column if not exists redact_after timestamptz,
  add column if not exists redacted_at timestamptz;
create index if not exists paste_site_connections_redact_due on public.paste_site_connections(redact_after)
  where redact_after is not null;
create or replace function grindctrl_paste_private.privacy_schedule() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.status='disconnected' and old.status<>'disconnected'
    and new.disconnected_reason is null then
    new.redact_after:=clock_timestamp()+interval '30 days';
    update public.widget_sites set status='disabled',updated_at=clock_timestamp() where id=new.widget_site_id;
  elsif new.status<>'disconnected' then
    new.redact_after:=null;
    new.redacted_at:=null;
    if old.status='disconnected' then
      update public.widget_sites set status='active',updated_at=clock_timestamp() where id=new.widget_site_id;
    end if;
  end if;
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.paste_site_connections'::regclass and tgname='paste_privacy_schedule') then
    create trigger paste_privacy_schedule before update on public.paste_site_connections
      for each row execute function grindctrl_paste_private.privacy_schedule();
  end if;
end $$;

create or replace function public.disconnect_paste_site(p_site uuid,p_actor_user_id text)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle',0));
  perform 1 from public.widget_sites where id=p_site for update;
  update public.paste_site_connections set status='disconnected',
    disconnected_at=coalesce(disconnected_at,clock_timestamp()),disconnected_reason=null,
    redact_after=coalesce(redact_after,clock_timestamp()+interval '30 days')
  where widget_site_id=p_site;
  if not found then return false; end if;
  update public.widget_sites set status='disabled',updated_at=clock_timestamp() where id=p_site;
  update public.tryon_shops set status='uninstalled',uninstalled_at=clock_timestamp(),updated_at=clock_timestamp()
    where shop_domain='site:'||p_site::text;
  -- Follow main's best-effort audit convention; never roll back a disconnect
  -- because audit logging is unavailable. Actor comes only from the server.
  begin
    insert into public.messenger_audit(widget_site_id,actor_clerk_user_id,action,detail)
    values(p_site,p_actor_user_id,'store_disconnected',jsonb_build_object('install_kind','paste'));
  exception when others then
    raise warning 'paste disconnect audit insert failed';
  end;
  return true;
end $$;

create or replace function public.paste_site_redact(p_site uuid, p_batch integer default 100)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_batch integer := least(greatest(coalesce(p_batch, 100), 1), 500);
  v_conn public.paste_site_connections;
  v_tenant text := 'site:' || p_site::text;
  v_ids uuid[];
  v_counts jsonb := '{}';
  v_n integer;
  v_left integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('paste-domain-lifecycle',0));
  perform 1 from public.widget_sites where id=p_site for update;
  select * into v_conn from public.paste_site_connections
  where widget_site_id = p_site for update;
  if not found then raise exception 'paste_privacy_unknown_site'; end if;
  if v_conn.status <> 'disconnected' or v_conn.redacted_at is not null
    or v_conn.redact_after is null
    or v_conn.redact_after > now() then
    return jsonb_build_object('redacted', false, 'done', false, 'reason', 'not_due');
  end if;
  update public.widget_sites set status='disabled',updated_at=clock_timestamp() where id=p_site;

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
  delete from public.messenger_audit where widget_site_id=p_site
    and (detail->>'conversation_id'=any(v_ids::text[]) or detail->>'conversationId'=any(v_ids::text[]));
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
  delete from public.messenger_audit where widget_site_id=p_site and (
    action in ('contact_captured','attachment_uploaded','internal_note_added')
    or detail ?| array['conversation_id','conversationId','lead_id','leadId']);
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

  update public.paste_site_connections
  set redact_after = null, redacted_at = now()
  where widget_site_id = p_site;

  return jsonb_build_object('redacted', true, 'done', true, 'counts', v_counts);
end $$;
create or replace function public.paste_sites_due_for_redaction(p_limit integer default 5)
returns setof uuid
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select widget_site_id from public.paste_site_connections
  where status = 'disconnected' and redacted_at is null
    and redact_after <= now()
  order by redact_after, widget_site_id
  limit least(greatest(coalesce(p_limit, 5), 1), 25)
$$;
revoke all on function public.disconnect_paste_site(uuid,text) from public,anon,authenticated;
grant execute on function public.disconnect_paste_site(uuid,text) to service_role;

revoke all on function public.paste_site_redact(uuid,integer) from public,anon,authenticated;
grant execute on function public.paste_site_redact(uuid,integer) to service_role;

revoke all on function public.paste_sites_due_for_redaction(integer) from public,anon,authenticated;
grant execute on function public.paste_sites_due_for_redaction(integer) to service_role;

revoke all on function public.shopify_chat_retention_finish(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.shopify_chat_retention_finish(uuid,uuid,text[]) to service_role;
revoke all on function public.shopify_chat_retention_visitors(integer) from public,anon,authenticated;
grant execute on function public.shopify_chat_retention_visitors(integer) to service_role;
revoke all on function public.woo_privacy_export(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.woo_privacy_export(uuid,text,integer,integer) to service_role;
revoke all on function public.woo_privacy_erase(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.woo_privacy_erase(uuid,text,integer) to service_role;
revoke all on function public.woo_privacy_matches(uuid,text) from public,anon,authenticated;
grant execute on function public.woo_privacy_matches(uuid,text) to service_role;
revoke all on function grindctrl_paste_private.privacy_schedule() from public,anon,authenticated;
grant execute on function grindctrl_paste_private.privacy_schedule() to service_role;

commit;
