import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getOnboardingProfile } from '@/lib/onboarding/profile';

export const metadata: Metadata = {
  title: 'GRINDCTRL | Set up your account',
  description: 'Tell us about your store so we can set up the right AI for it.',
};

export default async function OnboardingPage() {
  const clerkUserId = await requireDashboardUser('/onboarding');
  const profile = await getOnboardingProfile(clerkUserId);

  // Already done: no reason to make them fill it twice.
  if (profile?.onboardedAt) {
    redirect('/dashboard/overview');
  }

  return (
    <>
      <AmbientBackground />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3">
          <BrandLogo />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Tell us about your store
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Six quick answers. We use them to set up your account and to prepare before we
            speak, so nothing on the call is a blank page.
          </p>
        </div>

        <OnboardingForm profile={profile} />
      </main>
    </>
  );
}
