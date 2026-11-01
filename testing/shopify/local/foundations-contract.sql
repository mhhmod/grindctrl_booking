-- DISPOSABLE LOCAL CONTRACT ONLY. Not a captured Production definition.
-- shops.ts defines ShopRow.owner_clerk_user_id as string | null and authorizes
-- by that column. Its historical creation DDL is not checked in. No merchant
-- ownership is inferred or backfilled, and no deployed migration is changed.
begin;
alter table public.tryon_shops
  add column if not exists owner_clerk_user_id text;
commit;
