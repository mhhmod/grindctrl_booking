import type { OnboardingProfile } from '@/lib/onboarding/profile';
import type { InstallPlatform } from './paste-install-copy';

/** Saved answers are editable defaults only. The install actions still
 * validate the address and prove ownership before enabling shopper features. */
export function storeSetupDraft(profile: OnboardingProfile | null): { platform: InstallPlatform; website: string } | undefined {
  if (!profile?.website || !profile.storePlatform) return undefined;
  const platform = profile.storePlatform.toLowerCase();
  return {
    platform: platform === 'shopify' ? 'shopify' : platform === 'woocommerce' ? 'woocommerce' : 'website',
    website: profile.website,
  };
}
