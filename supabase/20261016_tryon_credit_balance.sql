-- Looks left, summed in the database. Phase zero item 4 of the v16 handoff.
--
-- getShopEntitlement used to read every ledger row of a subscription and sum
-- them in JavaScript. Every look writes a debit row and every failed look a
-- debit and a refund, so the rows grow with use, and a PostgREST row cap
-- (1,000 by default) silently cut the read short: looks left, the low-looks
-- alerts and the flag that hides the Try it on button all went wrong for a
-- busy store. This function returns the same two numbers from one aggregate.
--
-- The rules match the JavaScript it replaces (entitlement.ts):
--   * only grants that have not expired count;
--   * a grant's remaining looks are its amount plus every child row that
--     points at it (debits -1, refunds +1, expiries), never below zero;
--   * grants from a credit pack are top-up looks, grants from a plan are
--     plan looks.
--
-- Idempotent: safe to run more than once. Apply manually, like every file in
-- this folder.

begin;

create or replace function public.tryon_credit_balance(p_subscription_id uuid)
returns table (plan_remaining bigint, top_up_remaining bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with live_grants as (
    select g.id, g.amount, g.plan_id, g.credit_pack_id
    from public.tryon_credit_ledger g
    where g.subscription_id = p_subscription_id
      and g.entry_type = 'grant'
      and g.expires_at > now()
  ),
  remaining as (
    select
      lg.plan_id,
      lg.credit_pack_id,
      greatest(0, lg.amount + coalesce(sum(c.amount), 0)) as left_over
    from live_grants lg
    left join public.tryon_credit_ledger c on c.source_grant_id = lg.id
    group by lg.id, lg.amount, lg.plan_id, lg.credit_pack_id
  )
  select
    coalesce(sum(left_over) filter (where credit_pack_id is null and plan_id is not null), 0)::bigint,
    coalesce(sum(left_over) filter (where credit_pack_id is not null), 0)::bigint
  from remaining;
$$;

revoke execute on function public.tryon_credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.tryon_credit_balance(uuid) to service_role;

commit;
