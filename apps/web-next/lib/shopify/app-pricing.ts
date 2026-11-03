import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { listEntitlementCatalog, type PlanCatalogItem } from '@/lib/try-on/entitlement';
import { adminGraphql } from './admin';
import { findShopifyAppByClientId } from './app-registry';
import { normalizeShopDomain } from './shop-authorization';
import { getShopToken } from './tokens';
import { invalidateProxyConfig } from './proxy-config-cache';

export type ShopifyAppPricingPresentation = {
  distribution: 'public' | 'custom' | 'development';
  pricingPlansUrl: string | null;
  plans: PlanCatalogItem[];
};

export type ShopifyPricingPlan = {
  plan_key: string;
  currency: string;
  active: boolean;
  is_free: boolean;
  external_refs: unknown;
};

const PRICING_QUERY = `query GrindctrlAppPricing {
  currentAppInstallation {
    activeSubscriptions { name status currentPeriodEnd }
    app { handle }
  }
}`;
const USD_PLAN_KEYS = new Set(['free-v2', 'launch-v1', 'growth-v1', 'pro-v1']);

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('shopify_pricing_storage_unavailable');
  return createClient(url, key, { auth: { persistSession: false } });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function handle(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value) && value.length <= 200
    ? value : null;
}

/** Compare explicit catalog refs, never amounts, fuzzy names or webhook data.
 * Unknown/ambiguous active plans are an integration failure, not a Free downgrade. */
export function mapShopifyPricingSnapshot(snapshot: unknown, catalog: ShopifyPricingPlan[]): {
  planKey: string; currentPeriodEnd: string | null; appHandle: string | null;
} {
  const installation = record(record(snapshot)?.currentAppInstallation);
  if (!installation || !Array.isArray(installation.activeSubscriptions)) {
    throw new Error('shopify_pricing_invalid_snapshot');
  }
  const subscriptions = installation.activeSubscriptions.map((value) => {
    const subscription = record(value);
    if (!subscription || typeof subscription.name !== 'string' || typeof subscription.status !== 'string'
      || !['ACTIVE', 'CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN', 'PENDING', 'ACCEPTED'].includes(subscription.status)) {
      throw new Error('shopify_pricing_invalid_snapshot');
    }
    return subscription;
  });
  const active = subscriptions.filter((subscription) => subscription.status === 'ACTIVE');
  if (active.length > 1) throw new Error('shopify_pricing_ambiguous_subscription');
  const candidates = catalog.filter((plan) => plan.active && plan.currency === 'USD' && USD_PLAN_KEYS.has(plan.plan_key));
  const desiredHandle = active.length === 0 ? 'free' : (active[0].name as string).trim().toLowerCase();
  const matched = candidates.filter((plan) => {
    const ref = record(record(plan.external_refs)?.shopify_app_pricing);
    return ref?.handle === desiredHandle;
  });
  if (matched.length !== 1 || (active.length === 0 && !matched[0].is_free)) {
    throw new Error('shopify_pricing_unknown_plan');
  }
  const plan = matched[0];
  const periodEnd = active[0]?.currentPeriodEnd;
  if (!plan.is_free && (typeof periodEnd !== 'string' || !Number.isFinite(Date.parse(periodEnd))
    || Date.parse(periodEnd) <= Date.now())) {
    throw new Error('shopify_pricing_invalid_period');
  }
  return {
    planKey: plan.plan_key,
    currentPeriodEnd: plan.is_free ? null : new Date(periodEnd as string).toISOString(),
    appHandle: handle(record(installation.app)?.handle),
  };
}

type PricingContext = { shopDomain: string; appClientId: string };

/** A database lease surrounds the provider READ as well as its application.
 * A delayed/replayed webhook always reads Shopify again. Lease expiry, reinstall
 * and concurrent workers are fenced in SQL; a busy webhook must be retried. */
export async function reconcileShopifyAppPricing(input: PricingContext & { source: 'webhook' | 'bootstrap' }): Promise<void> {
  const app = findShopifyAppByClientId(input.appClientId);
  if (app?.distribution !== 'public') return;
  const shop = normalizeShopDomain(input.shopDomain);
  if (!shop) throw new Error('shopify_pricing_invalid_shop');
  const token = await getShopToken(shop, app.clientId);
  if (!token || token.appClientId !== app.clientId || !token.installationId || !token.accessToken) {
    throw new Error('shopify_pricing_missing_token');
  }
  const client = serviceClient();
  const lease = randomUUID();
  async function operation(op: 'claim' | 'apply' | 'release', payload: Record<string, unknown> = {}) {
    const { data, error } = await client.rpc('shopify_app_pricing_operation', {
      p_installation: token!.installationId, p_operation: op, p_lease: lease,
      p_payload: { ...payload, distribution: 'public' },
    });
    if (error || !record(data)) throw new Error('shopify_pricing_storage_unavailable');
    return data as Record<string, unknown>;
  }
  const claim = await operation('claim', { force: input.source === 'webhook' });
  if (claim.status === 'throttled' && input.source === 'bootstrap') return;
  if (claim.status !== 'acquired') throw new Error('shopify_pricing_reconciliation_unavailable');
  try {
    const [{ data: plans, error }, snapshot] = await Promise.all([
      client.from('tryon_plans').select('plan_key, currency, active, is_free, external_refs').eq('currency', 'USD').eq('active', true),
      adminGraphql<unknown>({ shopDomain: shop, accessToken: token.accessToken, query: PRICING_QUERY }),
    ]);
    if (error || !Array.isArray(plans)) throw new Error('shopify_pricing_catalog_unavailable');
    const mapped = mapShopifyPricingSnapshot(snapshot, plans as ShopifyPricingPlan[]);
    const applied = await operation('apply', {
      plan_key: mapped.planKey, current_period_end: mapped.currentPeriodEnd, app_handle: mapped.appHandle,
    });
    if (applied.status !== 'applied' && applied.status !== 'unchanged') {
      throw new Error('shopify_pricing_reconciliation_unavailable');
    }
    invalidateProxyConfig(shop);
  } catch (error) {
    await operation('release').catch(() => {});
    throw error;
  }
}

/** Only metadata crosses to the embedded UI. The handle is scoped to this
 * installation, and resolved by the authoritative query during reconciliation. */
export async function getShopifyAppPricingPresentation(input: PricingContext): Promise<ShopifyAppPricingPresentation> {
  const app = findShopifyAppByClientId(input.appClientId);
  const shop = normalizeShopDomain(input.shopDomain);
  if (!app || !shop) throw new Error('shopify_pricing_invalid_installation');
  const { plans } = await listEntitlementCatalog();
  const distribution = app.distribution ?? 'development';
  let appHandle: string | null = null;
  if (distribution === 'public') {
    appHandle = handle(process.env.SHOPIFY_PUBLIC_APP_HANDLE?.trim());
    if (!appHandle) {
      const { data, error } = await serviceClient().from('shopify_installations')
        .select('pricing_app_handle').eq('shop_domain', shop).eq('app_client_id', app.clientId)
        .eq('status', 'active').maybeSingle();
      if (error) throw new Error('shopify_pricing_storage_unavailable');
      appHandle = handle(data?.pricing_app_handle);
    }
  }
  return {
    distribution,
    pricingPlansUrl: appHandle
      ? `https://admin.shopify.com/store/${shop.slice(0, -'.myshopify.com'.length)}/charges/${appHandle}/pricing_plans`
      : null,
    plans: plans.filter((plan) => plan.active && plan.currency === 'USD' && USD_PLAN_KEYS.has(plan.planKey)),
  };
}
