/* Onboarding lead profile (Supabase, service role).
   Table: public.tryon_onboarding_profiles, keyed by clerk_user_id.
   Reads degrade to null and writes report a message when Supabase env is
   missing, so a misconfigured environment never hard-crashes the dashboard. */

import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type OnboardingInput = {
  fullName: string;
  phone: string;
  website: string;
  companyName: string;
  storePlatform: string;
  monthlyOrders: string;
  primaryGoal: string;
};

export type OnboardingProfile = OnboardingInput & { onboardedAt: string | null };

export type OnboardingErrors = Partial<Record<keyof OnboardingInput, string>>;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* Validation runs on the server because the client form can be bypassed.
   Phone and website are the two fields the sales team actually needs to be
   usable, so they get format checks, not just a presence check. */
export function validateOnboarding(input: OnboardingInput): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (input.fullName.trim().length < 2) {
    errors.fullName = 'Enter your full name.';
  }

  // Digits only after stripping the usual separators, 7 to 15 per E.164.
  const digits = input.phone.replace(/[\s()+.-]/g, '');
  if (!/^\d{7,15}$/.test(digits)) {
    errors.phone = 'Enter a valid phone number, including the country code.';
  }

  if (!isUsableUrl(input.website)) {
    errors.website = 'Enter a valid store or website address.';
  }

  if (input.companyName.trim().length < 2) {
    errors.companyName = 'Enter your store or company name.';
  }

  if (!input.storePlatform.trim()) {
    errors.storePlatform = 'Pick where your store runs.';
  }

  if (!input.monthlyOrders.trim()) {
    errors.monthlyOrders = 'Pick a monthly order range.';
  }

  return errors;
}

function isUsableUrl(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    // Reject "foo" style hostnames: a real site has a dot and a TLD.
    return /^[^\s.]+(\.[^\s.]+)+$/.test(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeWebsite(value: string) {
  const raw = value.trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export async function getOnboardingProfile(
  clerkUserId: string,
): Promise<OnboardingProfile | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('tryon_onboarding_profiles')
    .select(
      'full_name, phone, website, company_name, store_platform, monthly_orders, primary_goal, onboarded_at',
    )
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    fullName: data.full_name ?? '',
    phone: data.phone ?? '',
    website: data.website ?? '',
    companyName: data.company_name ?? '',
    storePlatform: data.store_platform ?? '',
    monthlyOrders: data.monthly_orders ?? '',
    primaryGoal: data.primary_goal ?? '',
    onboardedAt: data.onboarded_at ?? null,
  };
}

export async function hasCompletedOnboarding(clerkUserId: string) {
  const profile = await getOnboardingProfile(clerkUserId);
  /* Null means Supabase is unreachable or unconfigured. Treat that as
     "completed" so an outage cannot lock existing users out of the
     dashboard behind a form that also cannot save. */
  if (profile === null) return true;
  return Boolean(profile.onboardedAt);
}

export async function saveOnboardingProfile(
  clerkUserId: string,
  email: string,
  input: OnboardingInput,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = getServiceClient();
  if (!supabase) {
    return { ok: false, message: 'Storage is not configured. Contact support.' };
  }

  const { error } = await supabase.from('tryon_onboarding_profiles').upsert(
    {
      clerk_user_id: clerkUserId,
      email,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      website: normalizeWebsite(input.website),
      company_name: input.companyName.trim(),
      store_platform: input.storePlatform,
      monthly_orders: input.monthlyOrders,
      primary_goal: input.primaryGoal.trim() || null,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clerk_user_id' },
  );

  if (error) {
    console.error('onboarding upsert failed:', error.message);
    return { ok: false, message: 'Could not save your details. Try again.' };
  }

  return { ok: true };
}
