'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  saveOnboardingProfile,
  validateOnboarding,
  type OnboardingErrors,
  type OnboardingInput,
} from '@/lib/onboarding/profile';

export type OnboardingFormState = {
  errors: OnboardingErrors;
  message?: string;
  values?: Partial<OnboardingInput>;
};

function readInput(formData: FormData): OnboardingInput {
  const read = (key: keyof OnboardingInput) => String(formData.get(key) ?? '');
  return {
    fullName: read('fullName'),
    phone: read('phone'),
    website: read('website'),
    companyName: read('companyName'),
    storePlatform: read('storePlatform'),
    monthlyOrders: read('monthlyOrders'),
    primaryGoal: read('primaryGoal'),
  };
}

export async function submitOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/onboarding');
  }

  const input = readInput(formData);
  const errors = validateOnboarding(input);
  if (Object.keys(errors).length > 0) {
    return { errors, values: input };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return { errors: {}, message: 'No email on your account. Contact support.', values: input };
  }

  const result = await saveOnboardingProfile(userId, email, input);
  if (!result.ok) {
    return { errors: {}, message: result.message, values: input };
  }

  redirect('/dashboard/overview');
}
