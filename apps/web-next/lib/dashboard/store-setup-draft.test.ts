import { expect, it } from 'vitest';
import { storeSetupDraft } from './store-setup-draft';
import type { OnboardingProfile } from '@/lib/onboarding/profile';

it.each([
  ['Shopify', 'shopify'], ['WooCommerce', 'woocommerce'], ['Salla', 'website'],
  ['سلة', 'website'], ['تطوير مخصص', 'website'], ['Not live yet', 'website'],
])('m2: carries the saved %s answer to the supported setup path', (storePlatform, platform) => {
  const profile: OnboardingProfile = { fullName: 'Owner', phone: '', website: 'https://store.example', companyName: 'Store', storePlatform, monthlyOrders: '', primaryGoal: '', onboardedAt: '2026-11-12' };
  expect(storeSetupDraft(profile)).toEqual({ platform, website: profile.website });
});
it('has no draft without saved answers', () => { expect(storeSetupDraft(null)).toBeUndefined(); });
