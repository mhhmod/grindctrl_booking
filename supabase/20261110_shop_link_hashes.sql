-- G18. Apply before deploying hash-only shop-link reads/writes.
-- Existing emailed/displayed codes keep working via the backfilled SHA-256.
begin;
alter table public.tryon_shop_links add column if not exists code_hash text;
update public.tryon_shop_links
set code_hash=encode(sha256(convert_to(upper(regexp_replace(code,'[[:space:]-]','','g')),'UTF8')),'hex')
where code_hash is null and code is not null;
-- Move only the key constraint, keeping the plaintext column for owner cleanup.
do $$ begin
  if exists(select 1 from pg_constraint where conrelid='public.tryon_shop_links'::regclass
    and conname='tryon_shop_links_pkey' and pg_get_constraintdef(oid)='PRIMARY KEY (code)') then
    alter table public.tryon_shop_links drop constraint tryon_shop_links_pkey;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.tryon_shop_links'::regclass and contype='p') then
    alter table public.tryon_shop_links add constraint tryon_shop_links_pkey primary key(code_hash);
  end if;
end $$;
alter table public.tryon_shop_links alter column code drop not null;
commit;
-- OWNER FOLLOW-UP, NOT EXECUTED: after verifying hash-only deployment:
-- update public.tryon_shop_links set code = null;
