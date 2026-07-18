# GrindCTRL Try-On Plans and Credits Design

## Decisions and invariants

Every render for a Shopify shop requires an installed `tryon_shops` row, an eligible subscription, and one available credit. The database, not the browser or a process-local cache, is the authority. A validated shop domain is derived from Shopify authentication and is never accepted from a request body. Demo traffic with `shop = null` is not part of merchant entitlement accounting and must remain mock-only or owner-authenticated in live mode.

Plans and top-up packs are catalog data. Prices, included renders, periods, grace days, model keys, and pack sizes are rows, not constants. Catalog rows are versioned and retained. Changing commercial terms means inserting a new version and deactivating the old version, so existing subscriptions and ledger history keep their original meaning.

### Why a ledger, not a counter

`credits_remaining` must not be a mutable column. A counter loses the reason for a change, is difficult to repair after retries, and can drift when plan activation, top-ups, expiry, generation, and failure happen concurrently. `tryon_credit_ledger` is append-only. Grants are positive, generation reservations are negative debits, failed generations receive positive refunds, and expiry writes a negative closing entry. The usable balance is the sum of a shop's unexpired grant lots and their child entries. A cached aggregate may be added later, but it is never authoritative.

One shopper action has a client-generated UUID `request_key`, reused for transport retries. The database uniquely binds `(shop, request_key)` to one job and uniquely permits one debit for that job. The service reserves one credit before calling the image provider. A completed generation keeps the debit. Every terminal failure, including validation discovered inside the provider runner, provider error, timeout, or abandoned processing job, receives one idempotent refund. The merchant therefore pays only for a delivered render. GrindCTRL accepts provider cost on failures because charging for no result would be harder to explain and would encourage support disputes.

## Reviewable migration SQL

This is a design artifact. Do not apply it as-is. Confirm the production definitions of `tryon_shops` and `tryon_jobs`, then convert it into the repository's guarded manual delta-migration style. No seed values are included because the owner will decide the catalog terms.

```sql
begin;

create table public.tryon_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null,
  version integer not null default 1,
  name text not null,
  description text,
  price_minor bigint not null,
  currency text not null,
  renders_included integer not null,
  model_key text not null,
  period_unit text not null,
  period_count smallint not null,
  grace_days smallint not null default 3,
  is_free boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  external_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_plans_code_version_key unique (code, version),
  constraint tryon_plans_code_check check (
    code = lower(btrim(code)) and code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'
  ),
  constraint tryon_plans_version_check check (version > 0),
  constraint tryon_plans_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint tryon_plans_description_check check (
    description is null or char_length(description) <= 500
  ),
  constraint tryon_plans_price_check check (price_minor >= 0),
  constraint tryon_plans_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint tryon_plans_renders_check check (renders_included > 0),
  constraint tryon_plans_model_check check (char_length(btrim(model_key)) between 1 and 200),
  constraint tryon_plans_period_unit_check check (period_unit in ('day', 'month', 'year')),
  constraint tryon_plans_period_count_check check (period_count > 0),
  constraint tryon_plans_grace_check check (grace_days between 0 and 30),
  constraint tryon_plans_free_price_check check (not is_free or price_minor = 0),
  constraint tryon_plans_external_refs_check check (jsonb_typeof(external_refs) = 'object')
);

create unique index tryon_plans_one_active_version
  on public.tryon_plans (code) where active;

create unique index tryon_plans_one_active_free
  on public.tryon_plans (is_free) where active and is_free;

create table public.tryon_credit_packs (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null,
  version integer not null default 1,
  name text not null,
  price_minor bigint not null,
  currency text not null,
  renders integer not null,
  validity_days integer not null default 365,
  active boolean not null default true,
  sort_order integer not null default 0,
  external_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_credit_packs_code_version_key unique (code, version),
  constraint tryon_credit_packs_code_check check (
    code = lower(btrim(code)) and code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'
  ),
  constraint tryon_credit_packs_version_check check (version > 0),
  constraint tryon_credit_packs_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint tryon_credit_packs_price_check check (price_minor >= 0),
  constraint tryon_credit_packs_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint tryon_credit_packs_renders_check check (renders > 0),
  constraint tryon_credit_packs_validity_check check (validity_days between 1 and 1825),
  constraint tryon_credit_packs_external_refs_check check (jsonb_typeof(external_refs) = 'object')
);

create unique index tryon_credit_packs_one_active_version
  on public.tryon_credit_packs (code) where active;

create table public.tryon_shop_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_domain text not null unique
    references public.tryon_shops(shop_domain) on update cascade on delete restrict,
  plan_id uuid not null references public.tryon_plans(id) on delete restrict,
  status text not null,
  billing_anchor_at timestamptz not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  grace_ends_at timestamptz not null,
  pending_plan_id uuid references public.tryon_plans(id) on delete restrict,
  pending_plan_effective_at timestamptz,
  cancel_at_period_end boolean not null default false,
  activation_source text not null,
  external_provider text,
  external_customer_id text,
  external_subscription_id text,
  last_activation_event_id text,
  last_activation_event_at timestamptz,
  notes text,
  created_by text,
  activated_at timestamptz not null default now(),
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tryon_shop_subscriptions_id_shop_key unique (id, shop_domain),
  constraint tryon_shop_subscriptions_status_check check (
    status in ('active', 'grace', 'expired', 'cancelled')
  ),
  constraint tryon_shop_subscriptions_period_check check (
    billing_anchor_at <= current_period_start
    and current_period_start < current_period_end
    and current_period_end <= grace_ends_at
  ),
  constraint tryon_shop_subscriptions_pending_check check (
    (pending_plan_id is null and pending_plan_effective_at is null)
    or (pending_plan_id is not null and pending_plan_effective_at is not null)
  ),
  constraint tryon_shop_subscriptions_source_check check (
    activation_source in ('manual', 'webhook', 'system')
  ),
  constraint tryon_shop_subscriptions_terminal_check check (
    (status in ('active', 'grace') and expired_at is null)
    or (status in ('expired', 'cancelled') and expired_at is not null)
  ),
  constraint tryon_shop_subscriptions_notes_check check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint tryon_shop_subscriptions_external_event_check check (
    (last_activation_event_id is null and last_activation_event_at is null)
    or (last_activation_event_id is not null and last_activation_event_at is not null)
  )
);

create unique index tryon_shop_subscriptions_provider_subscription_key
  on public.tryon_shop_subscriptions (external_provider, external_subscription_id)
  where external_provider is not null and external_subscription_id is not null;

create unique index tryon_shop_subscriptions_provider_event_key
  on public.tryon_shop_subscriptions (external_provider, last_activation_event_id)
  where external_provider is not null and last_activation_event_id is not null;

create index tryon_shop_subscriptions_status_period_end
  on public.tryon_shop_subscriptions (status, current_period_end);

alter table public.tryon_jobs
  add column if not exists request_key uuid,
  add column if not exists subscription_id uuid
    references public.tryon_shop_subscriptions(id) on delete restrict,
  add column if not exists model_key text,
  add column if not exists billable boolean not null default false;

create unique index tryon_jobs_shop_request_key
  on public.tryon_jobs (shop, request_key)
  where shop is not null and request_key is not null;

create index tryon_jobs_subscription_created_at
  on public.tryon_jobs (subscription_id, created_at desc)
  where subscription_id is not null;

create table public.tryon_credit_ledger (
  id uuid primary key default extensions.uuid_generate_v4(),
  shop_domain text not null,
  subscription_id uuid not null,
  plan_id uuid references public.tryon_plans(id) on delete restrict,
  credit_pack_id uuid references public.tryon_credit_packs(id) on delete restrict,
  job_id text references public.tryon_jobs(id) on delete restrict,
  entry_type text not null,
  amount integer not null,
  reason text not null,
  source_grant_id uuid,
  reverses_entry_id uuid references public.tryon_credit_ledger(id) on delete restrict,
  idempotency_key text not null unique,
  expires_at timestamptz,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tryon_credit_ledger_id_shop_key unique (id, shop_domain),
  constraint tryon_credit_ledger_subscription_shop_fkey
    foreign key (subscription_id, shop_domain)
    references public.tryon_shop_subscriptions(id, shop_domain) on delete restrict,
  constraint tryon_credit_ledger_source_shop_fkey
    foreign key (source_grant_id, shop_domain)
    references public.tryon_credit_ledger(id, shop_domain) on delete restrict,
  constraint tryon_credit_ledger_catalog_source_check check (
    not (plan_id is not null and credit_pack_id is not null)
  ),
  constraint tryon_credit_ledger_type_shape_check check (
    (entry_type = 'grant' and amount > 0 and source_grant_id is null
      and reverses_entry_id is null and job_id is null and expires_at is not null)
    or
    (entry_type = 'debit' and amount = -1 and source_grant_id is not null
      and reverses_entry_id is null and job_id is not null and expires_at is null)
    or
    (entry_type = 'refund' and amount = 1 and source_grant_id is not null
      and reverses_entry_id is not null and job_id is not null and expires_at is null)
    or
    (entry_type = 'expire' and amount < 0 and source_grant_id is not null
      and reverses_entry_id is null and job_id is null and expires_at is null)
  ),
  constraint tryon_credit_ledger_reason_check check (
    reason = lower(btrim(reason)) and reason ~ '^[a-z0-9][a-z0-9_-]{1,63}$'
  ),
  constraint tryon_credit_ledger_idempotency_check check (
    char_length(idempotency_key) between 1 and 200
  ),
  constraint tryon_credit_ledger_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create unique index tryon_credit_ledger_one_debit_per_job
  on public.tryon_credit_ledger (job_id) where entry_type = 'debit';

create unique index tryon_credit_ledger_one_refund_per_job
  on public.tryon_credit_ledger (job_id) where entry_type = 'refund';

create unique index tryon_credit_ledger_one_reversal
  on public.tryon_credit_ledger (reverses_entry_id)
  where reverses_entry_id is not null;

create unique index tryon_credit_ledger_one_expiry_per_grant
  on public.tryon_credit_ledger (source_grant_id) where entry_type = 'expire';

create index tryon_credit_ledger_shop_created_at
  on public.tryon_credit_ledger (shop_domain, created_at desc);

create index tryon_credit_ledger_grant_children
  on public.tryon_credit_ledger (source_grant_id) where source_grant_id is not null;

create function public.reject_tryon_credit_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  raise exception 'tryon_credit_ledger is append-only';
end;
$$;

create trigger tryon_credit_ledger_no_update_or_delete
before update or delete on public.tryon_credit_ledger
for each row execute function public.reject_tryon_credit_ledger_mutation();

alter table public.tryon_plans enable row level security;
alter table public.tryon_credit_packs enable row level security;
alter table public.tryon_shop_subscriptions enable row level security;
alter table public.tryon_credit_ledger enable row level security;

revoke all on table public.tryon_plans from public, anon, authenticated;
revoke all on table public.tryon_credit_packs from public, anon, authenticated;
revoke all on table public.tryon_shop_subscriptions from public, anon, authenticated;
revoke all on table public.tryon_credit_ledger from public, anon, authenticated;
revoke execute on function public.reject_tryon_credit_ledger_mutation() from public;

grant select, insert, update on table public.tryon_plans to service_role;
grant select, insert, update on table public.tryon_credit_packs to service_role;
grant select, insert, update on table public.tryon_shop_subscriptions to service_role;
grant select, insert on table public.tryon_credit_ledger to service_role;

commit;
```

`system` is an intentional third activation source. It identifies the one automatic free-plan assignment for a shop's first verified installation. `manual` remains the phase 1 paid path and `webhook` is reserved for a future Merchant-of-Record event.

All writes that affect entitlement must be database transactions exposed only to the server role. Implement `activate_or_renew_subscription`, `grant_top_up`, `reserve_tryon_credit`, and `finalize_tryon_job` as SQL functions with `security invoker`; revoke function execution from `public`, `anon`, and `authenticated`, then grant it only to `service_role`. `reserve_tryon_credit` locks the shop's subscription row, checks installation and subscription timestamps, finds the first eligible grant with positive remaining balance, inserts the queued job and its debit, and records the effective model key supplied by the trusted service. In phase 1 that value is the global `TRYON_MODEL`; in phase 2 the service uses the plan row's `model_key`. If `(shop, request_key)` already exists, the function returns that job and does not call the provider. `finalize_tryon_job` updates the job and inserts `refund:<job_id>` on failure with `ON CONFLICT DO NOTHING`. A reconciliation task marks `processing` jobs older than 10 minutes failed and calls the same finalizer.

Grant idempotency keys are deterministic: `period:<subscription_id>:<period_start>`, `upgrade:<owner-or-webhook-event-id>`, and `topup:<owner-or-webhook-event-id>`. A free reinstall therefore cannot create a second period grant. Catalog and subscription rows are never deleted. Corrections use compensating ledger entries and notes.

The migration is additive: new job columns are nullable for historical rows, and enforcement is enabled only after catalog seeding and reconciliation tests pass. Before applying it, export `tryon_shops` and `tryon_jobs`, verify RLS and grants in a staging project, and test concurrent reservations, duplicate request keys, refunds, expiry, and reinstall. Before live ledger writes, rollback may drop the new indexes, columns, functions, and tables in reverse dependency order. After live ledger writes, do not drop accounting data; disable the new route enforcement if necessary, preserve the tables, and deploy a forward fix.

## Lifecycle policies

### Period boundaries and timezone

All timestamps are UTC and periods are half-open intervals: `current_period_start <= now < current_period_end`. A month or year uses calendar arithmetic from the original `billing_anchor_at`; if the anchor day does not exist in a month, the boundary is that month's last day, and later cycles return to the original anchor day when it exists. This avoids Cairo daylight-saving changes and prevents a cycle from gaining or losing hours. UI may display the merchant's locale, but calculations and idempotency keys use UTC. Free periods renew automatically only while `tryon_shops.status = 'installed'`.

### Expiry

Paid plans enter a three-day grace period by default, using the selected plan's `grace_days`. No new period credits are issued during grace. Unexpired top-up credits remain usable, and reminders become urgent. A payment recorded during grace renews from the prior `current_period_end`, preserving the billing anchor and issuing the new cycle grant. At `grace_ends_at` the subscription becomes `expired` and all generation stops, even if top-ups remain. Reactivation after grace starts at the activation timestamp and establishes a new billing anchor; existing top-ups become usable again if they have not expired. There is no automatic drop from paid to free because that creates a repeatable free-credit path and weakens manual collection. The alternative is auto-drop to free, but it is rejected for phase 1.

### Unused credits

Plan credits expire at `current_period_end` and never roll over. The expiry task appends one `expire` entry for the unused amount of each grant. This gives predictable unit economics and prevents low-use shops from accumulating a large future liability. The alternative is capped rollover, but it adds liability and allocation rules without improving the managed-service offer.

### Top-up packs

Top-ups are selected from `tryon_credit_packs`, granted only to a shop with an active or grace subscription, and expire after the pack's configured `validity_days`, initially expected to be 365. Plan credits are consumed first, then top-ups; within each class, the earliest expiry is consumed first. A top-up does not extend the base plan and cannot be used while the subscription is expired. This keeps a pack from becoming a substitute for a base plan while giving manual payments a useful long-lived add-on.

### Upgrades

An upgrade takes effect immediately and preserves the current period end. The owner handles the cash difference manually. The system grants only `max(0, new_plan.renders_included - plan_credits_already_granted_this_period)`, so the shop's total plan entitlement for the cycle reaches the new tier but cannot be multiplied through repeated upgrades. The new plan's model becomes eligible immediately. The alternative is monetary proration, but it is unnecessary until automated billing exists.

### Downgrades

A downgrade is stored in `pending_plan_id` and becomes effective at the next period boundary. Existing credits and model access remain unchanged until then. At the boundary, the renewal transaction changes the plan, clears the pending fields, and grants the new plan's configured credits. Immediate downgrades are rejected because clawing back consumed credits or changing model quality mid-cycle is unfair and hard to audit.

### Free-tier abuse

The first verified installation creates at most one subscription for the normalized `myshopify.com` domain. Uninstall changes `tryon_shops.status` but never deletes the subscription, period anchor, jobs, or ledger. Reinstall during the same period resumes its remaining balance. Reinstall after missed free periods advances directly to the current anchored period and issues only that period's grant, never backfills missed grants. The unique subscription row, deterministic period grant key, and retained `tryon_shops` history enforce this. A merchant can still create a genuinely new Shopify store domain, so the owner dashboard must flag matching merchant identity or contact data when Shopify makes it available; domain-level controls cannot prove two stores have the same owner.

### Rate limits and quotas

Rate limiting is defense against bursts; credits are the durable cost ceiling. The request order is authenticated shop and payload validation, idempotent existing-job lookup, rate limit, atomic credit reservation, then provider call. A retry with the same `request_key`, a rejected request, and a rate-limited request do not consume credit. Keep the current 10 requests per IP per 10 minutes and add 30 new jobs per shop per 10 minutes in shared storage before horizontal scaling. Rate limits return `429` with `Retry-After`. Entitlement failures return the stable application code `TRYON_UNAVAILABLE` and never call the provider. The ledger remains safe even if the current process-local IP limiter resets.

## Reminder surfaces

No email scheduler is required. The authenticated merchant-admin plan endpoint returns `planName`, `status`, `rendersIncluded`, `planCreditsRemaining`, `topUpCreditsRemaining`, `totalCreditsRemaining`, `currentPeriodEnd`, `graceEndsAt`, and derived `daysRemaining`. It reads the Shopify session-token shop, the current subscription and plan, and the ledger balance. It never accepts a shop from the client.

The Shopify admin shows a renewal banner for paid active plans when `daysRemaining <= 7`, an urgent banner when `daysRemaining <= 3`, a grace banner throughout grace, and an expired banner after grace. It shows a low-credit banner when total usable credits are at or below `max(5, ceil(rendersIncluded * 0.20))`, a critical banner at or below `max(2, ceil(rendersIncluded * 0.05))`, and an exhausted banner at zero. If expiry and credit thresholds both match, expiry or grace takes priority, then exhausted, then critical, then low. Free plans label the period end as a reset date, not a renewal date.

The Clerk-protected GrindCTRL dashboard uses the same calculation for every shop. Its action list includes all paid shops within seven days of period end, every shop in grace or expired status, and every shop at low, critical, or zero credits. Each row reads shop domain and install status, plan name, status, current period end, grace end, plan and top-up balances, usage percentage, last job time, and notes. These flags tell the owner whom to invoice or contact manually; they do not pretend an email was sent.

## Enforcement points

`apps/web-next/app/api/try-on/session/route.ts`, `POST`, must verify the Shopify App Proxy signature for storefront traffic, derive the normalized shop from that signed request, check that the shop is installed, and call `createSession` with that server-derived shop. It returns a short-lived HMAC-signed try-on token binding `sessionId`, `shop`, `productId`, and expiry. The body `shop` field is removed from the trust boundary. First-party demo sessions are allowed only in mock mode or with owner authentication.

`apps/web-next/app/api/try-on/generate/route.ts`, `POST`, validates that signed token, requires a UUID `requestKey`, confirms the token's session, shop, and product match the payload, performs the existing file and garment validation, checks an existing idempotent job, and applies IP and shop rate limits. It then calls `generateTryOn`. The route maps `TRYON_UNAVAILABLE` to a graceful widget response and does not expose plan details.

`apps/web-next/lib/try-on/service.ts`, `generateTryOn`, becomes the entitlement orchestrator. Before `runImageGeneration`, it calls the required persistence operation `beginTryOnJob`, which invokes `reserve_tryon_credit` with the effective model key. Only a newly created, successfully reserved job reaches the provider. It passes the recorded model key into the runner, then calls `finalizeTryOnJob` for both success and every caught failure. Returning a result before finalization succeeds is forbidden because job and credit persistence are no longer best-effort.

`apps/web-next/lib/try-on/persistence.ts` owns `beginTryOnJob`, `finalizeTryOnJob`, `getShopEntitlementState`, and balance queries. The current `persistTryOnJob` after-the-fact insert is replaced for billable jobs. Dashboard history reads remain in this file or a dedicated server-only repository module. `apps/web-next/lib/try-on/image-runner.ts`, `runImageGeneration`, receives a model argument; phase 1 supplies the actual global `TRYON_MODEL`, while phase 2 supplies the plan model returned by the reservation transaction. The chosen value is captured in `tryon_jobs.model_key` before provider work.

`apps/web-next/lib/shopify/shops.ts`, `recordTryOnShopSeen`, may call a separate idempotent `ensureFreeSubscription` only when the verified shop has never had a subscription. `markTryOnShopUninstalled` never deletes or resets entitlement. Owner actions remain behind `requireDashboardOwner`; merchant plan reads remain behind `verifySessionToken`.

Keep `apps/web-next/app/api/shopify/proxy/config/route.ts` limited to styling. Add a signature-verified storefront availability response, either in that route or a dedicated app-proxy route, containing only `{ available, code, messageKey }`. `code` is `AVAILABLE` or `TRYON_UNAVAILABLE`. Do not expose plan name, status, prices, balances, usage, renewal dates, or model. Use `Cache-Control: private, no-store` for availability. Styling may keep its existing public cache. A stale client is still protected by the generate endpoint.

When unavailable at initial load, the storefront block does not render an actionable try-on button or catalog badge. If availability changes after the widget opens, the widget stops loading and shows the localized message “Try-on is temporarily unavailable. Please check back soon.” with a close action. It does not show payment language, retry automatically, or leave a button that always fails.

## UX states inventory for implementation

1. Merchant admin loading: needs authenticated shop identity and request status.
2. Merchant admin active plan: needs plan name, status, included renders, plan and top-up balances, usage percentage, and period end or free reset date.
3. Merchant admin renewal due: needs paid plan name, `daysRemaining`, period end, total credits, and owner contact links.
4. Merchant admin low, critical, or exhausted: needs the matching threshold state, plan and top-up balances, included renders, and owner contact links. The top-up request CTA opens a prefilled WhatsApp link, with `mailto:` fallback, naming the shop and requested pack; it does not mutate billing state.
5. Merchant admin grace: needs period end, grace end, days until hard stop, top-up balance, and owner contact links.
6. Merchant admin expired or cancelled: needs status, expiry date, zero availability, and renewal contact links. Settings remain readable but generation is disabled.
7. Merchant admin data error: needs a retry action and no guessed balance or active claim.
8. Owner near-limit and renewal queue: needs shop, install status, plan, subscription status, usage percentage, credit balances, period and grace dates, last job time, notes, and threshold reasons.
9. Owner shop with no subscription: needs shop history and an activate-free or activate-paid action.
10. Owner active shop control: needs the current catalog version, period dates, balances by source and expiry, pending downgrade, activation source, notes, and available active plans and packs.
11. Owner activate or upgrade confirmation: needs target plan, effective timestamp, preserved period end when upgrading, calculated grant delta, activation source `manual`, note, and a client-generated action idempotency key.
12. Owner renew or extend confirmation: needs current plan, proposed new start and end, configured grant, grace end, note, and action idempotency key.
13. Owner top-up confirmation: needs selected pack, render count, price and currency, computed expiry, note, and action idempotency key.
14. Owner action pending, success, conflict, or error: needs action key, resulting subscription state, created ledger entry IDs, and a fresh balance. Retrying the same action key must return the same result.
15. Widget available: needs styling settings and `available: true`; no entitlement details.
16. Widget unavailable before open: needs `available: false` and localized `messageKey`; the launch controls are non-actionable or omitted.
17. Widget becomes unavailable during generation: needs API code `TRYON_UNAVAILABLE`, localized generic copy, a close action, and no automatic retry.

## Phasing

Phase 1 is the smallest correct manual system. Add the catalog, subscription, pack, ledger, and job-idempotency schema; seed owner-approved catalog rows; add transactional activate, renew, upgrade, downgrade, top-up, reserve, finalize, expiry, and stale-job reconciliation operations; derive shop identity from verified Shopify requests; enforce before provider work; retain the global `TRYON_MODEL`; expose authenticated merchant and owner summaries; and implement the reminder and graceful widget states. A scheduled daily reconciliation handles period transitions and expiry, while generation performs the same timestamp checks so scheduler delay cannot create access.

Phase 2 adds Merchant-of-Record webhooks and model-per-plan execution. A webhook maps its price identifier through `external_refs`, calls the same idempotent activation, renewal, downgrade, and top-up transactions with `activation_source = 'webhook'`, stores provider identifiers, and rejects events older than `last_activation_event_at`. Runtime generation passes the reserved plan `model_key` to `runImageGeneration` instead of the global environment value. No schema change is needed because phase 1 already contains versioned catalog terms, external references, webhook identity fields, event idempotency, per-job model capture, and source-aware ledger grants.
