-- Questions the assistant could not answer (v16 N8, phase zero item 11).
--
-- When the model's reply verdict says the store's data did not answer the
-- shopper, the send route stores the question here with its language and
-- the product asked about, so Knowledge can group questions across
-- languages ("Asked 9 times in the last 7 days, 7 of them in Arabic").
-- Emails, phone numbers and order numbers are stripped before a question
-- is stored, rows older than 90 days are deleted as new ones arrive, and
-- every row is erased with its conversation.
--
-- messenger_question_groups holds the grouped questions and their drafted
-- answers. The hourly grouping and drafting job comes with the Knowledge
-- rebuild; the table is created now so the shape is settled.
--
-- Also widens messenger_knowledge's source check, so an approved answer
-- (and, with the catalogue sync, a policy, product or size chart) can be
-- stored as knowledge.
--
-- Read and written only through the app's service role, and only for a
-- store whose n8_unanswered_questions flag is on.
--
-- Idempotent: safe to run more than once. Apply by hand in the Supabase SQL
-- editor; nothing here runs automatically. Needs messenger_foundation.sql.

create table if not exists public.messenger_question_groups (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  label text not null,
  status text not null default 'to_review',
  draft_en text,
  draft_ar text,
  draft_source jsonb,
  knowledge_id uuid references public.messenger_knowledge(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messenger_unanswered (
  id uuid primary key default extensions.uuid_generate_v4(),
  widget_site_id uuid not null references public.widget_sites(id) on delete cascade,
  conversation_id uuid not null references public.widget_conversations(id) on delete cascade,
  message_id uuid references public.widget_messages(id) on delete set null,
  question text not null,
  language text not null,
  -- The product asked about, in the shopper's words (from the verdict).
  product text,
  -- The product page the shopper was on, when there was one.
  product_handle text,
  group_id uuid references public.messenger_question_groups(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messenger_question_groups'::regclass and conname = 'messenger_question_groups_status_check'
  ) then
    alter table public.messenger_question_groups
      add constraint messenger_question_groups_status_check
      check (status in ('to_review', 'approved', 'to_team', 'dismissed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messenger_question_groups'::regclass and conname = 'messenger_question_groups_text_len_check'
  ) then
    alter table public.messenger_question_groups
      add constraint messenger_question_groups_text_len_check
      check (
        char_length(label) between 1 and 500
        and (draft_en is null or char_length(draft_en) <= 4000)
        and (draft_ar is null or char_length(draft_ar) <= 4000)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messenger_unanswered'::regclass and conname = 'messenger_unanswered_question_len_check'
  ) then
    alter table public.messenger_unanswered
      add constraint messenger_unanswered_question_len_check
      check (char_length(question) between 1 and 500);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messenger_unanswered'::regclass and conname = 'messenger_unanswered_language_check'
  ) then
    alter table public.messenger_unanswered
      add constraint messenger_unanswered_language_check
      check (language in ('en', 'ar', 'franco'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messenger_unanswered'::regclass and conname = 'messenger_unanswered_product_len_check'
  ) then
    alter table public.messenger_unanswered
      add constraint messenger_unanswered_product_len_check
      check (
        (product is null or char_length(product) between 1 and 120)
        and (product_handle is null or char_length(product_handle) between 1 and 255)
      );
  end if;
end $$;

create index if not exists messenger_unanswered_site_created
  on public.messenger_unanswered (widget_site_id, created_at desc);
create index if not exists messenger_unanswered_conversation
  on public.messenger_unanswered (conversation_id);
create index if not exists messenger_unanswered_group
  on public.messenger_unanswered (group_id) where group_id is not null;
create index if not exists messenger_question_groups_site_status
  on public.messenger_question_groups (widget_site_id, status, updated_at desc);

drop trigger if exists messenger_question_groups_set_updated_at on public.messenger_question_groups;
create trigger messenger_question_groups_set_updated_at
  before update on public.messenger_question_groups
  for each row execute function public.set_updated_at();

-- Approved answers, and later the catalogue sync, are knowledge too.
alter table public.messenger_knowledge drop constraint if exists messenger_knowledge_source_check;
alter table public.messenger_knowledge
  add constraint messenger_knowledge_source_check
  check (source in ('manual', 'url', 'approved', 'policy', 'product', 'size_chart'));

alter table public.messenger_unanswered enable row level security;
alter table public.messenger_question_groups enable row level security;
revoke all on table public.messenger_unanswered from public, anon, authenticated;
revoke all on table public.messenger_question_groups from public, anon, authenticated;
grant select, insert, update, delete on table public.messenger_unanswered to service_role;
grant select, insert, update, delete on table public.messenger_question_groups to service_role;

comment on table public.messenger_unanswered is
  'Shopper questions the Store Chat assistant could not answer (N8). Stripped of emails, phone numbers and order numbers; kept 90 days.';
comment on table public.messenger_question_groups is
  'Unanswered questions grouped across languages, with drafted answers for the merchant to approve (N8).';
