-- Test for supabase/messenger_questions.sql. Run it against a THROWAWAY
-- PostgreSQL 16 database, never a real project:
--
--   createdb questions_test
--   psql -d questions_test -v ON_ERROR_STOP=1 -f supabase/tests/messenger_questions.sql
--
-- It builds the few things Supabase and the earlier messenger files provide
-- (the extensions schema, the three roles, minimal widget tables and
-- messenger_knowledge with its old source check), applies the file twice,
-- then checks each constraint, the cascades and the grants. The \ir path
-- is relative to this file.

\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create table public.widget_sites (id uuid primary key default extensions.uuid_generate_v4(), name text not null);
create table public.widget_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade
);
create table public.widget_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.widget_conversations(id) on delete cascade
);
create table public.messenger_knowledge (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  title text not null,
  content text not null,
  source text not null default 'manual',
  constraint messenger_knowledge_source_check check (source in ('manual', 'url'))
);

\ir ../messenger_questions.sql
-- Applying it twice must be harmless.
\ir ../messenger_questions.sql

insert into public.widget_sites (id, name) values ('11111111-1111-4111-8111-111111111111', 'Maison');
insert into public.widget_conversations (id, widget_site_id)
  values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
insert into public.widget_messages (id, conversation_id)
  values ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222');

-- A question in each language is fine.
insert into public.messenger_unanswered (widget_site_id, conversation_id, message_id, question, language, product)
values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Do you ship to Jeddah?', 'en', null),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', null, 'بتشحنوا لجدة؟', 'ar', null),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', null, 'betesh7no l gedda?', 'franco', 'Layla abaya');

-- An approved answer can now be knowledge; a made-up source still cannot.
insert into public.messenger_knowledge (widget_site_id, title, content, source)
  values ('11111111-1111-4111-8111-111111111111', 'Exchanges', 'Free within 30 days.', 'approved');

do $$
declare
  rejected int := 0;
begin
  begin
    insert into public.messenger_unanswered (widget_site_id, conversation_id, question, language)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Hi', 'fr');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.messenger_unanswered (widget_site_id, conversation_id, question, language)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', repeat('x', 501), 'en');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.messenger_unanswered (widget_site_id, conversation_id, question, language)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '', 'en');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.messenger_unanswered (widget_site_id, conversation_id, question, language, product)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Size?', 'en', repeat('p', 121));
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.messenger_question_groups (widget_site_id, label, status)
      values ('11111111-1111-4111-8111-111111111111', 'Shipping to Jeddah', 'maybe');
  exception when check_violation then rejected := rejected + 1;
  end;
  begin
    insert into public.messenger_knowledge (widget_site_id, title, content, source)
      values ('11111111-1111-4111-8111-111111111111', 'X', 'Y', 'bogus');
  exception when check_violation then rejected := rejected + 1;
  end;
  if rejected <> 6 then
    raise exception 'expected 6 rejected rows, got %', rejected;
  end if;
end $$;

-- A group links its questions; deleting the message keeps the question.
insert into public.messenger_question_groups (id, widget_site_id, label)
  values ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Shipping to Jeddah');
update public.messenger_unanswered set group_id = '44444444-4444-4444-8444-444444444444';
delete from public.widget_messages where id = '33333333-3333-4333-8333-333333333333';
do $$
begin
  if (select count(*) from public.messenger_unanswered where message_id is null) <> 3 then
    raise exception 'deleting a message must keep its question';
  end if;
end $$;

-- Deleting the group unlinks; deleting the conversation erases its questions.
delete from public.messenger_question_groups where id = '44444444-4444-4444-8444-444444444444';
delete from public.widget_conversations where id = '22222222-2222-4222-8222-222222222222';
do $$
begin
  if (select count(*) from public.messenger_unanswered) <> 0 then
    raise exception 'questions must be erased with their conversation';
  end if;
end $$;

-- Only the service role may touch either table.
do $$
begin
  if has_table_privilege('anon', 'public.messenger_unanswered', 'select')
     or has_table_privilege('authenticated', 'public.messenger_unanswered', 'select')
     or has_table_privilege('anon', 'public.messenger_question_groups', 'select')
     or has_table_privilege('authenticated', 'public.messenger_question_groups', 'insert') then
    raise exception 'browser roles must not reach the question tables';
  end if;
  if not has_table_privilege('service_role', 'public.messenger_unanswered', 'insert')
     or not has_table_privilege('service_role', 'public.messenger_question_groups', 'update') then
    raise exception 'the service role must write the question tables';
  end if;
end $$;

select 'messenger_questions.sql: all checks passed' as result;
