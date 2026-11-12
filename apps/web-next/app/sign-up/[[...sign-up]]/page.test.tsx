import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-sign-up">Clerk SignUp</div>,
  /* auth-clerk.tsx renders these around SignIn/SignUp so the form doesn't
     flash in from empty space. Real Clerk toggles between them by load
     state; the mock always takes the "loaded" branch so existing assertions
     against the SignUp testid keep working unchanged. */
  ClerkLoaded: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ClerkLoading: () => null,
}));

/* The page resolves its language from the locale cookie, so the test controls
   that cookie directly. */
let cookieLocale: string | undefined;
/* getRequestLocale falls back to Accept-Language when no cookie is set, so the
   mock has to supply headers as well as cookies. */
let acceptLanguage: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gc-locale' && cookieLocale ? { name, value: cookieLocale } : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'accept-language' ? (acceptLanguage ?? null) : null,
  }),
}));

import SignUpPage from '@/app/sign-up/[[...sign-up]]/page';

const originalClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function restoreClerkKey() {
  if (originalClerkKey) {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalClerkKey;
    return;
  }

  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

describe('SignUpPage', () => {
  it.each(['en', 'ar'] as const)('links to both public legal pages in %s with or without Clerk', async (locale) => {
    cookieLocale = locale;
    for (const configured of [false, true]) {
      if (configured) process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
      else delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const { unmount } = render(await SignUpPage());
      expect(screen.getByRole('link', { name: locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy' })).toHaveAttribute('href', '/privacy');
      expect(screen.getByRole('link', { name: locale === 'ar' ? 'شروط الخدمة' : 'Terms of service' })).toHaveAttribute('href', '/terms');
      unmount();
    }
  });
  afterEach(() => {
    restoreClerkKey();
    cookieLocale = undefined;
  });

  it('shows the env-missing alert when Clerk is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    render(await SignUpPage());

    expect(screen.getByText('Clerk environment variables are missing')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-up')).not.toBeInTheDocument();
  });

  it('renders Clerk sign-up when the publishable key is configured', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignUpPage());

    expect(screen.getByTestId('clerk-sign-up')).toBeInTheDocument();
    expect(screen.queryByText('Clerk environment variables are missing')).not.toBeInTheDocument();
  });

  it('renders Arabic and flips direction when the locale cookie says so', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
    cookieLocale = 'ar';

    const { container } = render(await SignUpPage());

    expect(screen.getByRole('heading', { name: 'أنشئ حسابك' })).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});
