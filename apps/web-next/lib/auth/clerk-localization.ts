import { arSA, enUS } from '@clerk/localizations';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Clerk's form copy, with the lines the sign-up method order leans on
   (owner decision 2026-11-12: Google first, then email with a one-time
   code, no password) worded the way the rest of the site speaks.
   Clerk's Arabic "للمتابعة مع Google" reads as "in order to continue with";
   the button is an action, so it is said as one. */
const overrides: Record<SiteLocale, Partial<typeof enUS>> = {
  en: {
    socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
    dividerText: 'or',
  },
  ar: {
    socialButtonsBlockButton: 'المتابعة باستخدام {{provider|titleize}}',
    dividerText: 'أو',
  },
};

const base = { en: enUS, ar: arSA } as const;

export function clerkLocalization(locale: SiteLocale): typeof enUS {
  return { ...base[locale], ...overrides[locale] };
}
