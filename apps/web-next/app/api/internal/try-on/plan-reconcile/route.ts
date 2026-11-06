import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  reconcileShopifyPricingBatch,
  reconcileTryOnPlanStates,
  SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT,
  TRYON_PLAN_RECONCILE_BATCH_LIMIT,
} from '@/lib/try-on/plan-reconcile';

export const runtime = 'nodejs';

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.TRYON_CLEANUP_SECRET;
  const provided = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers });
  }
  // Independent bounded jobs: an unapplied migration or a broken Shopify
  // installation never prevents the other reconciliation from running.
  const [plans, pricing] = await Promise.allSettled([
    reconcileTryOnPlanStates(TRYON_PLAN_RECONCILE_BATCH_LIMIT),
    reconcileShopifyPricingBatch(SHOPIFY_PRICING_RECONCILE_BATCH_LIMIT),
  ]);
  const data = {
    plans: plans.status === 'fulfilled' ? plans.value : null,
    pricing: pricing.status === 'fulfilled' ? pricing.value : null,
    failedOperations: (plans.status === 'fulfilled' ? plans.value.failed : 1)
      + (pricing.status === 'fulfilled' ? pricing.value.failed : 1),
  };
  // Individual shop failures are counted/logged by the worker and retried on
  // a later run. They do not fail the whole schedule or discard other shops.
  if (plans.status === 'rejected' || pricing.status === 'rejected'
    || (plans.status === 'fulfilled' && plans.value.failed > 0)) {
    console.error('[try-on-plan-reconcile] failed', data);
    return NextResponse.json({ ok: false, error: 'Plan reconciliation did not complete.', data }, { status: 500, headers });
  }
  console.info('[try-on-plan-reconcile] completed', data);
  return NextResponse.json({ ok: true, data }, { headers });
}
