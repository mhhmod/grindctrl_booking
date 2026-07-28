import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type PublicPlanCatalogItem = {
  planKey: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  rendersIncluded: number;
  modelKey: string;
  isFree: boolean;
  sortOrder: number;
};

export type PublicCreditPackCatalogItem = {
  packKey: string;
  name: string;
  priceMinor: number;
  currency: string;
  renders: number;
  modelKey: string;
  validityDays: number;
  sortOrder: number;
};

export type PublicEntitlementCatalog = {
  plans: PublicPlanCatalogItem[];
  packs: PublicCreditPackCatalogItem[];
};

type PublicPlanRow = {
  plan_key: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  renders_included: number;
  model_key: string;
  is_free: boolean;
  sort_order: number;
};

type PublicCreditPackRow = {
  pack_key: string;
  name: string;
  price_minor: number;
  currency: string;
  renders: number;
  model_key: string;
  validity_days: number;
  sort_order: number;
};

const FALLBACK_CATALOG: PublicEntitlementCatalog = {
  plans: [
    {
      planKey: 'free-v1',
      name: 'Free',
      description: 'Start with the live storefront experience.',
      priceMinor: 0,
      currency: 'USD',
      rendersIncluded: 20,
      modelKey: 'google/gemini-3.1-flash-lite-image',
      isFree: true,
      sortOrder: 10,
    },
    {
      planKey: 'launch-v1',
      name: 'Launch',
      description: 'A practical monthly plan for growing stores.',
      priceMinor: 1500,
      currency: 'USD',
      rendersIncluded: 300,
      modelKey: 'google/gemini-3.1-flash-lite-image',
      isFree: false,
      sortOrder: 20,
    },
    {
      planKey: 'dfy-v1',
      name: 'Done-for-you',
      description: 'Premium renders plus hands-on setup and support.',
      priceMinor: 5900,
      currency: 'USD',
      rendersIncluded: 450,
      modelKey: 'google/gemini-3.1-flash-image',
      isFree: false,
      sortOrder: 30,
    },
  ],
  packs: [
    {
      packKey: 'pack-lite-v1',
      name: 'Boost 80',
      priceMinor: 500,
      currency: 'USD',
      renders: 80,
      modelKey: 'google/gemini-3.1-flash-lite-image',
      validityDays: 365,
      sortOrder: 10,
    },
    {
      packKey: 'pack-flash-v1',
      name: 'Boost 75 Pro',
      priceMinor: 1000,
      currency: 'USD',
      renders: 75,
      modelKey: 'google/gemini-3.1-flash-image',
      validityDays: 365,
      sortOrder: 20,
    },
  ],
};

function cloneFallbackCatalog(): PublicEntitlementCatalog {
  return {
    plans: FALLBACK_CATALOG.plans.map((plan) => ({ ...plan })),
    packs: FALLBACK_CATALOG.packs.map((pack) => ({ ...pack })),
  };
}

function mapPlan(row: PublicPlanRow): PublicPlanCatalogItem {
  return {
    planKey: row.plan_key,
    name: row.name,
    description: row.description,
    priceMinor: Number(row.price_minor),
    currency: row.currency,
    rendersIncluded: row.renders_included,
    modelKey: row.model_key,
    isFree: row.is_free,
    sortOrder: row.sort_order,
  };
}

function mapPack(row: PublicCreditPackRow): PublicCreditPackCatalogItem {
  return {
    packKey: row.pack_key,
    name: row.name,
    priceMinor: Number(row.price_minor),
    currency: row.currency,
    renders: row.renders,
    modelKey: row.model_key,
    validityDays: row.validity_days,
    sortOrder: row.sort_order,
  };
}

export async function listPublicPlanCatalog(): Promise<PublicEntitlementCatalog> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return cloneFallbackCatalog();

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [plansResult, packsResult] = await Promise.all([
      supabase
        .from('tryon_plans')
        .select(
          'plan_key, name, description, price_minor, currency, renders_included, model_key, is_free, sort_order',
        )
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tryon_credit_packs')
        .select(
          'pack_key, name, price_minor, currency, renders, model_key, validity_days, sort_order',
        )
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (plansResult.error || packsResult.error) return cloneFallbackCatalog();

    const plans = ((plansResult.data ?? []) as PublicPlanRow[]).map(mapPlan);
    const packs = ((packsResult.data ?? []) as PublicCreditPackRow[]).map(mapPack);
    if (plans.length === 0 || packs.length === 0) return cloneFallbackCatalog();

    return { plans, packs };
  } catch {
    return cloneFallbackCatalog();
  }
}
