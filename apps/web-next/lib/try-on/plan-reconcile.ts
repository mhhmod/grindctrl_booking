import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getConfiguredShopifyApps } from '@/lib/shopify/app-registry';
import { reconcileShopifyAppPricing } from '@/lib/shopify/app-pricing';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

export const TRYON_PLAN_RECONCILE_BATCH_LIMIT = 100;
export const SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT = 5;
const SHOPIFY_PRICING_RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000;

const PLAN_COUNTS = ['subscriptions', 'rolledOver', 'grace', 'expired', 'cancelled', 'expiredGrants', 'staleJobs'] as const;
type PlanCounts = Record<typeof PLAN_COUNTS[number], number>;
export type PlanReconcileSummary = PlanCounts & { failed: number; notReady?: true };
export type ShopifyPricingReconcileSummary = { scanned: number; reconciled: number; skipped: number; failed: number; notReady?: true };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('plan_reconcile_storage_unavailable');
  return createClient(url, key, { auth: { persistSession: false } });
}

function boundedLimit(limit: number, maximum: number): number {
  return Number.isFinite(limit) ? Math.max(1, Math.min(maximum, Math.floor(limit))) : maximum;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** Until the additive migration is applied, leave lazy entitlement checks in
 * charge. A missing RPC is a deployment skip; other storage errors stay visible. */
function isReconcileSchemaMissing(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || error.code === 'PGRST204' || error.code === '42883'
    || error.code === '42P01' || error.code === '42703'
    || /could not find the function|does not exist/i.test(error.message ?? '');
}

export async function reconcileTryOnPlanStates(limit = TRYON_PLAN_RECONCILE_BATCH_LIMIT): Promise<PlanReconcileSummary> {
  const batchLimit = boundedLimit(limit, TRYON_PLAN_RECONCILE_BATCH_LIMIT);
  const empty: PlanReconcileSummary = { subscriptions: 0, rolledOver: 0, grace: 0, expired: 0, cancelled: 0, expiredGrants: 0, staleJobs: 0, failed: 0 };
  const result = await serviceClient().rpc('reconcile_tryon_plans', { p_limit: batchLimit });
  if (result.error && isReconcileSchemaMissing(result.error)) {
    console.warn('[try-on-plan-reconcile] skipped', { code: 'plan_reconcile_schema_missing' });
    return { ...empty, notReady: true };
  }
  const counts = record(result.data);
  if (result.error || !counts || PLAN_COUNTS.some((key) => !Number.isSafeInteger(counts[key])
    || (counts[key] as number) < 0 || (counts[key] as number) > batchLimit)) {
    throw new Error('plan_reconcile_batch_failed');
  }
  if ((counts.rolledOver as number) + (counts.grace as number) + (counts.expired as number)
    + (counts.cancelled as number) > (counts.subscriptions as number)) {
    throw new Error('plan_reconcile_counts_invalid');
  }
  return { ...Object.fromEntries(PLAN_COUNTS.map((key) => [key, counts[key]])) as PlanCounts, failed: 0 };
}

// Errors from the pricing service are fixed application codes. Do not copy an
// arbitrary provider/GraphQL message into logs, even when it looks like a code.
const PRICING_FAILURE_CODES = new Set([
  'shopify_pricing_storage_unavailable', 'shopify_pricing_invalid_snapshot',
  'shopify_pricing_ambiguous_subscription', 'shopify_pricing_unknown_plan',
  'shopify_pricing_invalid_period', 'shopify_pricing_invalid_shop',
  'shopify_pricing_missing_token', 'shopify_pricing_reconciliation_unavailable',
  'shopify_pricing_catalog_unavailable',
]);

/** A missed App Pricing webhook heals without an app visit. Only configured
 * public registrations qualify; site tenants and custom installs remain manual.
 * Work rotates through the least-recently attempted cohort, with oldest
 * successful syncs first within that cohort. Never-attempted shops get a turn
 * before retrying failures. A six-hour cooldown bounds repeat API calls; failed
 * checks never update the successful-sync timestamp.
 * Each installation uses the existing SQL lease and authoritative Shopify read. */
export async function reconcileShopifyPricingBatch(limit = SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT): Promise<ShopifyPricingReconcileSummary> {
  const summary = { scanned: 0, reconciled: 0, skipped: 0, failed: 0 };
  const publicApps = getConfiguredShopifyApps().filter((app) => app.distribution === 'public').map((app) => app.clientId);
  if (publicApps.length === 0) return summary;
  const batchLimit = boundedLimit(limit, SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT);
  const client = serviceClient();
  const attemptedAt = new Date().toISOString();
  const retryBefore = new Date(Date.parse(attemptedAt) - SHOPIFY_PRICING_RETRY_INTERVAL_MS).toISOString();
  const cohort = await client.from('shopify_installations')
    .select('pricing_reconcile_attempted_at')
    .eq('status', 'active').in('app_client_id', publicApps)
    .order('pricing_reconcile_attempted_at', { ascending: true, nullsFirst: true }).limit(1);
  if (cohort.error && isReconcileSchemaMissing(cohort.error)) {
    console.warn('[shopify-pricing-reconcile] skipped', { code: 'plan_reconcile_schema_missing' });
    return { ...summary, notReady: true };
  }
  if (cohort.error || !Array.isArray(cohort.data) || cohort.data.length > 1) {
    throw new Error('shopify_pricing_batch_unavailable');
  }
  if (cohort.data.length === 0) return summary;
  const oldestAttempt = record(cohort.data[0])?.pricing_reconcile_attempted_at;
  if (oldestAttempt !== null && (typeof oldestAttempt !== 'string'
    || !/^[0-9T:.+Z-]+$/.test(oldestAttempt) || !Number.isFinite(Date.parse(oldestAttempt)))) {
    throw new Error('shopify_pricing_batch_unavailable');
  }
  // A fixed cooldown alone can starve a backlog larger than six batches:
  // failures re-enter before every never-synced shop has had its first turn.
  // Select only the oldest attempt cohort, then preserve oldest-sync order.
  const eligible = oldestAttempt === null ? 'pricing_reconcile_attempted_at.is.null'
    : `and(pricing_reconcile_attempted_at.lte.${oldestAttempt},pricing_reconcile_attempted_at.lt.${retryBefore})`;
  const batch = await client.from('shopify_installations')
    .select('id, shop_domain, app_client_id')
    .eq('status', 'active').in('app_client_id', publicApps)
    .or(eligible)
    .order('pricing_synced_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true }).limit(batchLimit);
  if (batch.error && isReconcileSchemaMissing(batch.error)) {
    console.warn('[shopify-pricing-reconcile] skipped', { code: 'plan_reconcile_schema_missing' });
    return { ...summary, notReady: true };
  }
  if (batch.error || !Array.isArray(batch.data) || batch.data.length > batchLimit) {
    throw new Error('shopify_pricing_batch_unavailable');
  }
  // Bounded parallel reads keep one slow/failing shop from delaying all others.
  await Promise.all(batch.data.map(async (value: unknown) => {
    summary.scanned += 1;
    const row = record(value);
    const shopDomain = normalizeShopDomain(row?.shop_domain);
    const appClientId = row?.app_client_id;
    if (typeof row?.id !== 'string' || !row.id || !shopDomain || typeof appClientId !== 'string' || !publicApps.includes(appClientId)) {
      summary.failed += 1;
      console.error('[shopify-pricing-reconcile] failed', { code: 'shopify_pricing_installation_invalid' });
      return;
    }
    try {
      // Conditional update also fences concurrent scheduler invocations: only
      // the first worker to stamp this eligible installation starts a read.
      const stamped = await client.from('shopify_installations')
        .update({ pricing_reconcile_attempted_at: attemptedAt }).eq('id', row.id)
        .eq('status', 'active').or(eligible).select('id');
      if (stamped.error || !Array.isArray(stamped.data) || stamped.data.length > 1) {
        throw new Error('shopify_pricing_storage_unavailable');
      }
      if (stamped.data.length === 0) {
        summary.skipped += 1;
        return;
      }
      await reconcileShopifyAppPricing({ shopDomain, appClientId, source: 'bootstrap' });
      summary.reconciled += 1;
    } catch (error) {
      summary.failed += 1;
      const code = error instanceof Error && PRICING_FAILURE_CODES.has(error.message)
        ? error.message : 'shopify_pricing_reconcile_failed';
      console.error('[shopify-pricing-reconcile] failed', { shopDomain, code });
    }
  }));
  return summary;
}
