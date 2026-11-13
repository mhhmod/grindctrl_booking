'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import { getRequestLocale } from '@/lib/auth/locale';
import { authPageHref, onboardingPath, POST_ONBOARDING_PATH, resolveOnboardingNext } from '@/lib/auth/redirect';
import { ensureMessengerSite, listMessengerSites } from '@/lib/messenger/provisioning';
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
  /* The page this new account was on its way to (a claim link, a deep
     link). Checked again here: a hidden field is whatever the client sends. */
  const next = resolveOnboardingNext(formData.get('next'));
  const { userId } = await auth();
  if (!userId) {
    redirect(authPageHref('/sign-in', onboardingPath(next)));
  }

  /* Errors come back in whatever language the page was rendered in, so a
     failed submit does not switch the visitor to English mid-form. */
  const copy = getAuthCopy(await getRequestLocale());

  const input = readInput(formData);
  const errors = validateOnboarding(input, {
    fullName: copy.errorName,
    phone: copy.errorPhone,
    website: copy.errorWebsite,
    companyName: copy.errorCompany,
    storePlatform: copy.errorPlatform,
    monthlyOrders: copy.errorOrders,
  });
  if (Object.keys(errors).length > 0) {
    return { errors, values: input };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return { errors: {}, message: copy.errorNoEmail, values: input };
  }

  const result = await saveOnboardingProfile(userId, email, input, {
    noStorage: copy.errorNoStorage,
    saveFailed: copy.errorSaveFailed,
  });
  if (!result.ok) {
    return { errors: {}, message: result.message, values: input };
  }

  const destination = next ?? POST_ONBOARDING_PATH;
  if (destination.split(/[?#]/, 1)[0] === POST_ONBOARDING_PATH) {
    await prepareFirstStore(userId, email, input.companyName);
  }
  redirect(destination);
}

/* Store setup is where a new account goes next. Its page gives a first-time
   merchant a store when it renders, but the dashboard shell has already read
   the store list by then, so the first visit showed no store switcher, and
   the store was called "My store" in either language. Making it here, named
   after the store they just gave, means the shell and the page agree from
   the first paint. Only for someone with no store at all; anything else is
   Store setup's own provisioning, which still runs. A failure here costs
   only that, so it never blocks finishing onboarding. */
async function prepareFirstStore(userId: string, email: string, companyName: string): Promise<void> {
  try {
    if ((await listMessengerSites(userId, email)).length > 0) return;
    await ensureMessengerSite(userId, null, companyName.trim() || undefined);
  } catch (error) {
    console.error('[onboarding] first store not prepared', {
      code: 'onboarding_first_store_failed',
      error: error instanceof Error ? error.name : typeof error,
    });
  }
}
