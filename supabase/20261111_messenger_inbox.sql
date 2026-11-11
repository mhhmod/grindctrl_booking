-- Additive; RLS unchanged. Service-only, SECURITY INVOKER reads; callers
-- must check Clerk and the site's chats capability before invoking.
-- Rollback: drop function public.messenger_inbox_page(uuid,text,text,uuid,timestamptz,uuid,boolean,timestamptz);
-- drop trigger messenger_inbox_changed on public.widget_conversations;
-- drop trigger messenger_inbox_message_changed on public.widget_messages;
-- drop trigger messenger_inbox_visitor_changed on public.widget_visitors;
-- drop function public.messenger_inbox_touch(), public.messenger_inbox_message_touch(), public.messenger_inbox_visitor_touch(), public.messenger_search_normalize(text);
-- drop index public.messenger_inbox_recency, public.messenger_inbox_changes, public.messenger_inbox_messages, public.messenger_inbox_handoffs;
-- alter table public.widget_conversations drop column inbox_updated_at, drop column inbox_handoff_at;
begin;
alter table public.widget_conversations add column if not exists inbox_updated_at timestamptz not null default now();
alter table public.widget_conversations add column if not exists inbox_handoff_at timestamptz;
create index if not exists messenger_inbox_recency on public.widget_conversations(widget_site_id, (coalesce(last_message_at, '-infinity'::timestamptz)) desc, id desc);
create index if not exists messenger_inbox_changes on public.widget_conversations(widget_site_id, inbox_updated_at, id);
create index if not exists messenger_inbox_handoffs on public.widget_conversations(widget_site_id, inbox_handoff_at, id) where status = 'handoff_requested';
create index if not exists messenger_inbox_messages on public.widget_messages(conversation_id, created_at desc, id desc);
create or replace function public.messenger_inbox_touch() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.inbox_updated_at = clock_timestamp();
  if new.status = 'handoff_requested' then
    if tg_op = 'INSERT' then new.inbox_handoff_at = new.inbox_updated_at;
    elsif old.status is distinct from new.status then new.inbox_handoff_at = new.inbox_updated_at;
    end if;
  end if;
  return new;
end $$;
create or replace function public.messenger_inbox_message_touch() returns trigger language plpgsql security invoker set search_path = public as $$
begin update public.widget_conversations set inbox_updated_at = clock_timestamp() where id = new.conversation_id; return new; end $$;
create or replace function public.messenger_inbox_visitor_touch() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.user_name is distinct from old.user_name or new.user_email is distinct from old.user_email then
    update public.widget_conversations set inbox_updated_at = clock_timestamp() where visitor_id = new.id;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='messenger_inbox_changed' and tgrelid='public.widget_conversations'::regclass) then
    create trigger messenger_inbox_changed before insert or update on public.widget_conversations for each row execute function public.messenger_inbox_touch();
  end if;
  if not exists (select 1 from pg_trigger where tgname='messenger_inbox_message_changed' and tgrelid='public.widget_messages'::regclass) then
    create trigger messenger_inbox_message_changed after insert or update on public.widget_messages for each row execute function public.messenger_inbox_message_touch();
  end if;
  if not exists (select 1 from pg_trigger where tgname='messenger_inbox_visitor_changed' and tgrelid='public.widget_visitors'::regclass) then
    create trigger messenger_inbox_visitor_changed after update on public.widget_visitors for each row execute function public.messenger_inbox_visitor_touch();
  end if;
end $$;
create or replace function public.messenger_search_normalize(value text) returns text language sql immutable strict parallel safe as $$
  select trim(regexp_replace(translate(regexp_replace(lower(normalize(value, NFKD)), '[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g'), 'أإآٱىئة', 'ااااييه'), '\s+', ' ', 'g'));
$$;
create or replace function public.messenger_inbox_page(
  p_site uuid, p_query text default '', p_filter text default 'all', p_assignee uuid default null,
  p_cursor_at timestamptz default null, p_cursor_id uuid default null, p_changes boolean default false,
  p_until timestamptz default now()
) returns setof jsonb language sql stable security invoker set search_path = public as $$
  with chosen as (
    select c.*, v.user_name as visitor_name, v.user_email as visitor_email, preview.content as preview
    from public.widget_conversations c
    left join public.widget_visitors v on v.id = c.visitor_id and v.widget_site_id = c.widget_site_id
    left join lateral (
      select left(trim(split_part(m.content, E'\n', 1)),140) as content from public.widget_messages m
      where m.conversation_id = c.id and m.role <> 'system' and not coalesce((m.metadata->>'internal')::boolean,false)
        and trim(split_part(m.content, E'\n', 1)) <> ''
      order by m.created_at desc, m.id desc limit 1
    ) preview on true
    where c.widget_site_id = p_site
      and (p_assignee is null or c.assigned_profile_id = p_assignee)
      and case p_filter when 'all' then true when 'needs_reply' then c.status='handoff_requested'
        when 'in_progress' then c.status in ('open','handoff_active') when 'needs_you' then c.status in ('handoff_requested','handoff_active')
        when 'assistant' then c.status='open' when 'resolved' then c.status='closed' else false end
      and (coalesce(p_query,'') = '' or position(public.messenger_search_normalize(left(p_query,200)) in public.messenger_search_normalize(
        coalesce(v.user_name,'') || ' ' || coalesce(v.user_email,'') || ' ' || coalesce(preview.content,''))) > 0)
      and case when p_changes then c.inbox_updated_at <= p_until and
        (c.inbox_updated_at > p_cursor_at or (c.inbox_updated_at = p_cursor_at and (p_cursor_id is null or c.id > p_cursor_id)))
        else p_cursor_id is null or (coalesce(c.last_message_at,'-infinity'::timestamptz), c.id) < (coalesce(p_cursor_at,'-infinity'::timestamptz),p_cursor_id) end
    order by case when p_changes then c.inbox_updated_at end asc,
      case when p_changes then c.id end asc,
      case when not p_changes then coalesce(c.last_message_at,'-infinity'::timestamptz) end desc, c.id desc
    limit case when p_changes then 50 else 31 end
  )
  select to_jsonb(chosen) || jsonb_build_object('unread', (
    select count(*) from public.widget_messages m where m.conversation_id = chosen.id and m.role='user'
      and m.created_at > coalesce((chosen.metadata->>'agent_last_read_at')::timestamptz,'-infinity'::timestamptz)
  )) from chosen;
$$;
revoke all on function public.messenger_inbox_page(uuid,text,text,uuid,timestamptz,uuid,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.messenger_inbox_page(uuid,text,text,uuid,timestamptz,uuid,boolean,timestamptz) to service_role;
commit;
