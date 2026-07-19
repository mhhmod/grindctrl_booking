/* Try-on job persistence (Supabase, service role).
   Metadata only: images are never stored, so customer photos stay
   ephemeral. Persistence is best-effort. A DB hiccup must never fail
   a generation that already succeeded. */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { TryOnJob } from './types';
import {
  finalizeCreditJob,
  getShopEntitlement,
  reserveCredit,
  type CreditReservation,
  type ShopEntitlement,
} from './entitlement';
import { normalizeShopDomain } from '@/lib/shopify/shop-authorization';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function persistTryOnJob(job: TryOnJob, durationMs?: number): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;

  const { error } = await supabase.from('tryon_jobs').insert({
    id: job.jobId,
    session_id: job.sessionId,
    product_id: job.productId,
    shop: normalizeShopDomain(job.shop),
    status: job.status,
    provider: job.meta.provider,
    cost_usd: job.meta.costEstimate,
    duration_ms: durationMs ?? null,
    message: job.message ?? null,
  });

  if (error) {
    console.error('tryon_jobs insert failed:', error.message);
  }
}

export async function beginTryOnJob(input: {
  shop: string;
  jobId: string;
  requestKey: string;
  modelKey: string;
  sessionId: string;
  productId: string;
}): Promise<CreditReservation> {
  return reserveCredit(input);
}

export async function finalizeTryOnJob(job: TryOnJob, durationMs: number): Promise<void> {
  await finalizeCreditJob({
    jobId: job.jobId,
    status: job.status === 'completed' ? 'completed' : 'failed',
    provider: job.meta.provider,
    costUsd: job.meta.costEstimate,
    durationMs,
    message: job.message,
  });
}

export async function getShopEntitlementState(shop: unknown): Promise<ShopEntitlement> {
  return getShopEntitlement(shop);
}

export type TryOnJobRow = {
  id: string;
  product_id: string;
  /** null for demo-page jobs; a myshopify domain for storefront traffic. */
  shop: string | null;
  status: string;
  provider: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  message: string | null;
  created_at: string;
};

export async function listRecentTryOnJobs(limit = 20): Promise<TryOnJobRow[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tryon_jobs')
    .select('id, product_id, shop, status, provider, cost_usd, duration_ms, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('tryon_jobs select failed:', error.message);
    return [];
  }
  return data ?? [];
}
