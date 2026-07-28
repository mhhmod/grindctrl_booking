import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';
import { getOnboardingProfile } from '@/lib/onboarding/profile';

export const metadata: Metadata = {
  title: 'GRINDCTRL | Set up your account',
  description: 'Tell us about your store so we can set up the right AI for it.',
};

export default async function OnboardingPage() {
  const clerkUserId = await requireDashboardUser('/onboarding');
  const locale = await getRequestLocale();
  const copy = getAuthCopy(locale);
  const profile = await getOnboardingProfile(clerkUserId);

  // Already done: no reason to make them fill it twice.
  if (profile?.onboardedAt) {
    redirect('/dashboard/overview');
  }

  return (
    <>
      <AmbientBackground />

      <main
        dir={getDir(locale)}
        lang={locale}
        className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16"
      >
        <div className="flex flex-col gap-3">
          <BrandLogo />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.onboardingTitle}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">{copy.onboardingLead}</p>
        </div>

        <OnboardingForm profile={profile} copy={copy} />
      </main>
    </>
  );
}
