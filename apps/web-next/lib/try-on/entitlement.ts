import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';
import { invalidateProxyConfig } from '@/lib/shopify/proxy-config-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SubscriptionStatus = 'active' | 'grace' | 'expired' | 'cancelled' | 'none';
export type BannerState =
  | 'none'
  | 'renewal_due'
  | 'urgent'
  | 'grace'
  | 'expired'
  | 'cancelled'
  | 'exhausted'
  | 'critical'
  | 'low';

export type PlanCatalogItem = {
  id: string;
  planKey: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  rendersIncluded: number;
  modelKey: string;
  periodUnit: 'day' | 'month' | 'year';
  periodCount: number;
  graceDays: number;
  isFree: boolean;
  active: boolean;
  sortOrder: number;
};

export type CreditPackCatalogItem = {
  id: string;
  packKey: string;
  name: string;
  priceMinor: number;
  currency: string;
  renders: number;
  modelKey: string;
  validityDays: number;
  active: boolean;
  sortOrder: number;
};

export type ShopEntitlement = {
  shop: string;
  subscriptionId: string | null;
  planId: string | null;
  planKey: string | null;
  planName: string | null;
  /** The active plan's own image model, for the generation call to use
   *  instead of a single global default. Null only when there is no
   *  resolvable plan (the no-subscription branch below). */
  modelKey: string | null;
  status: SubscriptionStatus;
  isFree: boolean;
  rendersIncluded: number;
  planCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsRemaining: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  daysRemaining: number;
  bannerState: BannerState;
  available: boolean;
  pendingPlanKey: string | null;
  pendingPlanEffectiveAt: string | null;
  notes: string | null;
};

export type CreditLot = {
  id: string;
  source: 'plan' | 'top_up';
  expiresAt: string;
  remaining: number;
};

export type CreditReservation = {
  jobId: string;
  created: boolean;
  status: string;
  modelKey: string;
  message: string | null;
  provider: string | null;
  costUsd: number | null;
  durationMs: number | null;
  createdAt: string;
};

export type OwnerMutationResult = {
  actionKey: string;
  replayed: boolean;
  ledgerEntryIds: string[];
};

type PlanRow = {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  renders_included: number;
  model_key: string;
  period_unit: 'day' | 'month' | 'year';
  period_count: number;
  grace_days: number;
  is_free: boolean;
  active: boolean;
  sort_order: number;
};

type SubscriptionRow = {
  id: string;
  plan_id: string;
  status: Exclude<SubscriptionStatus, 'none'>;
  current_period_start: string;
  current_period_end: string;
  grace_ends_at: string;
  pending_plan_id: string | null;
  pending_plan_effective_at: string | null;
  notes: string | null;
};

type LedgerRow = {
  id: string;
  entry_type: 'grant' | 'debit' | 'refund' | 'expire' | 'action';
  amount: number;
  source_grant_id: string | null;
  plan_id: string | null;
  credit_pack_id: string | null;
  expires_at: string | null;
};

type ReservationRow = {
  job_id: string;
  created: boolean;
  job_status: string;
  recorded_model_key: string;
  job_message: string | null;
  job_provider: string | null;
  job_cost_usd: number | null;
  job_duration_ms: number | null;
  job_created_at: string;
};

export class TryOnUnavailableError extends Error {
  readonly code = 'TRYON_UNAVAILABLE';

  constructor(message = 'Try-on is temporarily unavailable. Please check back soon.') {
    super(message);
    this.name = 'TryOnUnavailableError';
  }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function requireShop(shop: unknown): string {
  const domain = normalizeShopDomain(shop);
  if (!domain) throw new Error('Unknown Shopify shop');
  return domain;
}

function requireActionKey(actionKey: string): string {
  if (!UUID_RE.test(actionKey)) throw new Error('Action key must be a UUID');
  return actionKey;
}

type ServiceClient = ReturnType<typeof getServiceClient>;

export type CreditBalance = { planCreditsRemaining: number; topUpCreditsRemaining: number };

const LEDGER_PAGE_ROWS = 1_000;

/* Looks left for a subscription (phase zero item 4). Reading every ledger
   row and summing in JavaScript broke once a store passed the PostgREST row
   cap: each look writes a debit and each failed look a refund, so the rows
   grow with use, and the capped read silently undercounted the spending.
   `tryon_credit_balance` (supabase/20261016_tryon_credit_balance.sql) sums
   it in one aggregate. Until the owner applies that file, a paged read of
   the same rows gives the same answer. */
export async function readCreditBalance(
  supabase: ServiceClient,
  subscriptionId: string,
): Promise<CreditBalance> {
  const { data, error } = await supabase.rpc('tryon_credit_balance', {
    p_subscription_id: subscriptionId,
  });
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as
      | { plan_remaining: number | string | null; top_up_remaining: number | string | null }
      | undefined;
    return {
      planCreditsRemaining: Number(row?.plan_remaining ?? 0),
      topUpCreditsRemaining: Number(row?.top_up_remaining ?? 0),
    };
  }
  if (!isMissingFunctionError(error)) throwRpcError(error);
  return pagedLedgerBalance(supabase, subscriptionId);
}

function isMissingFunctionError(error: { code?: string; message: string }): boolean {
  // PostgREST: function not in its schema cache; Postgres: undefined function.
  return error.code === 'PGRST202' || error.code === '42883';
}

/** The pre-SQL rule, read in pages so no row cap can cut it short. */
export function sumLedgerBalance(ledger: readonly LedgerRow[], now = Date.now()): CreditBalance {
  const childTotals = new Map<string, number>();
  for (const entry of ledger) {
    if (!entry.source_grant_id) continue;
    childTotals.set(
      entry.source_grant_id,
      (childTotals.get(entry.source_grant_id) ?? 0) + entry.amount,
    );
  }
  let planCreditsRemaining = 0;
  let topUpCreditsRemaining = 0;
  for (const grant of ledger) {
    if (grant.entry_type !== 'grant' || !grant.expires_at) continue;
    if (new Date(grant.expires_at).getTime() <= now) continue;
    const remaining = Math.max(0, grant.amount + (childTotals.get(grant.id) ?? 0));
    if (grant.credit_pack_id) topUpCreditsRemaining += remaining;
    else if (grant.plan_id) planCreditsRemaining += remaining;
  }
  return { planCreditsRemaining, topUpCreditsRemaining };
}

async function pagedLedgerBalance(
  supabase: ServiceClient,
  subscriptionId: string,
): Promise<CreditBalance> {
  const ledger: LedgerRow[] = [];
  for (let from = 0; ; from += LEDGER_PAGE_ROWS) {
    const { data, error } = await supabase
      .from('tryon_credit_ledger')
      .select('id, entry_type, amount, source_grant_id, plan_id, credit_pack_id, expires_at')
      .eq('subscription_id', subscriptionId)
      .order('id')
      .range(from, from + LEDGER_PAGE_ROWS - 1);
    throwRpcError(error);
    const page = (data ?? []) as LedgerRow[];
    ledger.push(...page);
    if (page.length < LEDGER_PAGE_ROWS) break;
  }
  return sumLedgerBalance(ledger);
}

function throwRpcError(error: { message: string } | null): void {
  if (!error) return;
  if (error.message.includes('TRYON_UNAVAILABLE')) {
    throw new TryOnUnavailableError();
  }
  throw new Error(error.message);
}

export function addCalendarPeriod(
  anchor: Date,
  periodUnit: 'day' | 'month' | 'year',
  periodCount = 1,
  periodIndex = 1,
): Date {
  if (periodCount < 1 || periodIndex < 0) throw new Error('Invalid period');
  if (periodUnit === 'day') {
    return new Date(anchor.getTime() + periodCount * periodIndex * DAY_MS);
  }

  const monthOffset = periodCount * periodIndex * (periodUnit === 'year' ? 12 : 1);
  const targetMonth = anchor.getUTCMonth() + monthOffset;
  const targetYear = anchor.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

export function calculateUpgradeGrant(
  newPlanRendersIncluded: number,
  planCreditsGrantedThisPeriod: number,
): number {
  return Math.max(0, newPlanRendersIncluded - planCreditsGrantedThisPeriod);
}

export function sortCreditLotsForConsumption(lots: readonly CreditLot[]): CreditLot[] {
  return [...lots]
    .filter((lot) => lot.remaining > 0)
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'plan' ? -1 : 1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });
}

export function getBannerState(input: {
  status: SubscriptionStatus;
  isFree: boolean;
  rendersIncluded: number;
  totalCreditsRemaining: number;
  daysRemaining: number;
}): BannerState {
  if (input.status === 'grace') return 'grace';
  if (input.status === 'expired' || input.status === 'none') return 'expired';
  if (input.status === 'cancelled') return 'cancelled';
  if (!input.isFree && input.daysRemaining <= 3) return 'urgent';
  if (!input.isFree && input.daysRemaining <= 7) return 'renewal_due';
  if (input.totalCreditsRemaining === 0) return 'exhausted';

  const criticalAt = Math.max(2, Math.ceil(input.rendersIncluded * 0.05));
  const lowAt = Math.max(5, Math.ceil(input.rendersIncluded * 0.2));
  if (input.totalCreditsRemaining <= criticalAt) return 'critical';
  if (input.totalCreditsRemaining <= lowAt) return 'low';
  return 'none';
}

function mapPlan(row: PlanRow): PlanCatalogItem {
  return {
    id: row.id,
    planKey: row.plan_key,
    name: row.name,
    description: row.description,
    priceMinor: Number(row.price_minor),
    currency: row.currency,
    rendersIncluded: row.renders_included,
    modelKey: row.model_key,
    periodUnit: row.period_unit,
    periodCount: row.period_count,
    graceDays: row.grace_days,
    isFree: row.is_free,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export async function listEntitlementCatalog(): Promise<{
  plans: PlanCatalogItem[];
  packs: CreditPackCatalogItem[];
}> {
  const supabase = getServiceClient();
  const [plansResult, packsResult] = await Promise.all([
    supabase
      .from('tryon_plans')
      .select(
        'id, plan_key, name, description, price_minor, currency, renders_included, model_key, period_unit, period_count, grace_days, is_free, active, sort_order',
      )
      .order('sort_order'),
    supabase
      .from('tryon_credit_packs')
      .select(
        'id, pack_key, name, price_minor, currency, renders, model_key, validity_days, active, sort_order',
      )
      .order('sort_order'),
  ]);
  throwRpcError(plansResult.error);
  throwRpcError(packsResult.error);

  return {
    plans: ((plansResult.data ?? []) as PlanRow[]).map(mapPlan),
    packs: ((packsResult.data ?? []) as Array<{
      id: string;
      pack_key: string;
      name: string;
      price_minor: number;
      currency: string;
      renders: number;
      model_key: string;
      validity_days: number;
      active: boolean;
      sort_order: number;
    }>).map((row) => ({
      id: row.id,
      packKey: row.pack_key,
      name: row.name,
      priceMinor: Number(row.price_minor),
      currency: row.currency,
      renders: row.renders,
      modelKey: row.model_key,
      validityDays: row.validity_days,
      active: row.active,
      sortOrder: row.sort_order,
    })),
  };
}

export async function ensureFreeSubscription(shop: unknown): Promise<string> {
  const domain = requireShop(shop);
  const { data, error } = await getServiceClient().rpc('ensure_free_tryon_subscription', {
    p_shop_domain: domain,
  });
  throwRpcError(error);
  if (typeof data !== 'string') throw new Error('Free subscription setup returned no subscription');
  return data;
}

export async function getShopEntitlement(shop: unknown): Promise<ShopEntitlement> {
  const domain = requireShop(shop);
  const supabase = getServiceClient();
  const reconciliation = await supabase.rpc('reconcile_tryon_subscription', {
    p_shop_domain: domain,
  });
  throwRpcError(reconciliation.error);

  const [subscriptionResult, shopResult] = await Promise.all([
    supabase
      .from('tryon_subscriptions')
      .select(
        'id, plan_id, status, current_period_start, current_period_end, grace_ends_at, pending_plan_id, pending_plan_effective_at, notes',
      )
      .eq('shop_domain', domain)
      .maybeSingle(),
    supabase.from('tryon_shops').select('status').eq('shop_domain', domain).maybeSingle(),
  ]);
  throwRpcError(subscriptionResult.error);
  throwRpcError(shopResult.error);

  const subscription = subscriptionResult.data as SubscriptionRow | null;
  const shopInstalled = (shopResult.data as { status?: string } | null)?.status === 'installed';
  if (!subscription) {
    return {
      shop: domain,
      subscriptionId: null,
      planId: null,
      planKey: null,
      planName: null,
      modelKey: null,
      status: 'none',
      isFree: false,
      rendersIncluded: 0,
      planCreditsRemaining: 0,
      topUpCreditsRemaining: 0,
      totalCreditsRemaining: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      graceEndsAt: null,
      daysRemaining: 0,
      bannerState: 'expired',
      available: false,
      pendingPlanKey: null,
      pendingPlanEffectiveAt: null,
      notes: null,
    };
  }

  const [planResult, balance, pendingPlanResult] = await Promise.all([
    supabase.from('tryon_plans').select('*').eq('id', subscription.plan_id).single(),
    readCreditBalance(supabase, subscription.id),
    subscription.pending_plan_id
      ? supabase
          .from('tryon_plans')
          .select('plan_key')
          .eq('id', subscription.pending_plan_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  throwRpcError(planResult.error);
  throwRpcError(pendingPlanResult.error);

  const plan = planResult.data as PlanRow;
  const { planCreditsRemaining, topUpCreditsRemaining } = balance;
  const now = Date.now();

  const totalCreditsRemaining = planCreditsRemaining + topUpCreditsRemaining;
  const remainingTarget = subscription.status === 'grace'
    ? subscription.grace_ends_at
    : subscription.current_period_end;
  const daysRemaining = subscription.status === 'expired' || subscription.status === 'cancelled'
    ? 0
    : Math.max(0, Math.ceil((new Date(remainingTarget).getTime() - now) / DAY_MS));
  const bannerState = getBannerState({
    status: subscription.status,
    isFree: plan.is_free,
    rendersIncluded: plan.renders_included,
    totalCreditsRemaining,
    daysRemaining,
  });

  return {
    shop: domain,
    subscriptionId: subscription.id,
    planId: plan.id,
    planKey: plan.plan_key,
    planName: plan.name,
    modelKey: plan.model_key,
    status: subscription.status,
    isFree: plan.is_free,
    rendersIncluded: plan.renders_included,
    planCreditsRemaining,
    topUpCreditsRemaining,
    totalCreditsRemaining,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    graceEndsAt: subscription.grace_ends_at,
    daysRemaining,
    bannerState,
    available:
      shopInstalled &&
      (subscription.status === 'active' || subscription.status === 'grace') &&
      totalCreditsRemaining > 0,
    pendingPlanKey:
      (pendingPlanResult.data as { plan_key?: string } | null)?.plan_key ?? null,
    pendingPlanEffectiveAt: subscription.pending_plan_effective_at,
    notes: subscription.notes,
  };
}

/* The plan's tier label for the generation path, which records it on the
   reservation and needs nothing else. It used to load the whole
   entitlement, a reconcile and the full ledger, on every generation;
   reserve_tryon_credit reconciles and checks the looks itself. */
export async function getShopModelKey(shop: unknown): Promise<string | null> {
  const domain = requireShop(shop);
  const supabase = getServiceClient();
  const subscription = await supabase
    .from('tryon_subscriptions')
    .select('plan_id')
    .eq('shop_domain', domain)
    .maybeSingle();
  throwRpcError(subscription.error);
  const planId = (subscription.data as { plan_id?: string } | null)?.plan_id;
  if (!planId) return null;
  const plan = await supabase.from('tryon_plans').select('model_key').eq('id', planId).maybeSingle();
  throwRpcError(plan.error);
  return (plan.data as { model_key?: string | null } | null)?.model_key ?? null;
}

export async function reserveCredit(input: {
  shop: unknown;
  jobId: string;
  requestKey: string;
  modelKey: string;
  sessionId?: string;
  productId?: string;
}): Promise<CreditReservation> {
  const domain = requireShop(input.shop);
  if (!UUID_RE.test(input.requestKey)) throw new Error('Request key must be a UUID');

  const { data, error } = await getServiceClient().rpc('reserve_tryon_credit', {
    p_shop_domain: domain,
    p_job_id: input.jobId,
    p_request_key: input.requestKey,
    p_session_id: input.sessionId ?? '',
    p_product_id: input.productId ?? '',
    p_model_key: input.modelKey,
  });
  throwRpcError(error);
  // This may have used the shop's last look: the storefront button must
  // hide on the next config read, not a minute later.
  invalidateProxyConfig(domain);

  const row = (Array.isArray(data) ? data[0] : data) as ReservationRow | undefined;
  if (!row) throw new Error('Credit reservation returned no job');
  return {
    jobId: row.job_id,
    created: row.created,
    status: row.job_status,
    modelKey: row.recorded_model_key,
    message: row.job_message,
    provider: row.job_provider,
    costUsd: row.job_cost_usd === null ? null : Number(row.job_cost_usd),
    durationMs: row.job_duration_ms,
    createdAt: row.job_created_at,
  };
}

export async function finalizeCreditJob(input: {
  jobId: string;
  /** The job's shop, so a failed look credited back can bring the button back. */
  shop?: string | null;
  status: 'completed' | 'failed';
  provider?: string;
  costUsd?: number | null;
  durationMs?: number;
  message?: string;
}): Promise<void> {
  const { data, error } = await getServiceClient().rpc('finalize_tryon_job', {
    p_job_id: input.jobId,
    p_status: input.status,
    p_provider: input.provider ?? null,
    p_cost_usd: input.costUsd ?? null,
    p_duration_ms: input.durationMs ?? null,
    p_message: input.message ?? null,
  });
  throwRpcError(error);
  if (input.status === 'failed') invalidateProxyConfig(normalizeShopDomain(input.shop));
  if (data !== input.status) {
    throw new Error(`Try-on job was already finalized as ${String(data)}`);
  }
}

export async function refundCredit(jobId: string): Promise<void> {
  const { data, error } = await getServiceClient().rpc('refund_tryon_credit', { p_job_id: jobId });
  throwRpcError(error);
  if (data !== 'failed') throw new Error(`Try-on job was already finalized as ${String(data)}`);
}

export async function reconcileShopSubscription(shop: string): Promise<void> {
  const { error } = await getServiceClient().rpc('reconcile_tryon_subscription', { p_shop_domain: shop });
  throwRpcError(error);
  // A renewal grants a new period's looks.
  invalidateProxyConfig(normalizeShopDomain(shop));
}

export async function runDailyReconciliation(): Promise<number> {
  const { data, error } = await getServiceClient().rpc('reconcile_tryon_entitlements');
  throwRpcError(error);
  return Number(data ?? 0);
}

export async function runOwnerEntitlementMutation(
  functionName:
    | 'activate_tryon_plan'
    | 'renew_tryon_plan'
    | 'apply_tryon_top_up'
    | 'schedule_tryon_downgrade',
  params: Record<string, unknown> & { p_action_key: string },
): Promise<OwnerMutationResult> {
  requireActionKey(params.p_action_key);
  const { data, error } = await getServiceClient().rpc(functionName, params);
  throwRpcError(error);
  // Plans, renewals and top-ups all change the looks left.
  invalidateProxyConfig(normalizeShopDomain(params.p_shop_domain));
  const result = data as OwnerMutationResult | null;
  if (!result) throw new Error('Owner plan action returned no result');
  return result;
}
