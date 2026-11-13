import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({
  /* The props are drawn as attributes so the tests can read where Clerk is
     told to send the new account. */
  SignUp: (props: { forceRedirectUrl: string; signInUrl: string; signInForceRedirectUrl: string }) => (
    <div
      data-testid="clerk-sign-up"
      data-force-redirect-url={props.forceRedirectUrl}
      data-sign-in-url={props.signInUrl}
      data-sign-in-force-redirect-url={props.signInForceRedirectUrl}
    >
      Clerk SignUp
    </div>
  ),
  ClerkFailed: () => null,
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
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

  it('keeps a claim link through sign-up: onboarding first, then the claim', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignUpPage({ searchParams: Promise.resolve({ redirect_url: '/claim?token=abc123' }) }));

    const signUp = screen.getByTestId('clerk-sign-up');
    expect(signUp).toHaveAttribute('data-force-redirect-url', '/onboarding?next=%2Fclaim%3Ftoken%3Dabc123');
    // An existing account that signs in from here goes straight to the claim.
    expect(signUp).toHaveAttribute('data-sign-in-force-redirect-url', '/claim?token=abc123');
    expect(signUp).toHaveAttribute('data-sign-in-url', '/sign-in?redirect_url=%2Fclaim%3Ftoken%3Dabc123');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?redirect_url=%2Fclaim%3Ftoken%3Dabc123',
    );
  });

  it('drops an off-site or auth-page destination and sends the new account to onboarding', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    for (const hostile of ['https://evil.example', '//evil.example', '/sign-up']) {
      const { unmount } = render(await SignUpPage({ searchParams: Promise.resolve({ redirect_url: hostile }) }));
      expect(screen.getByTestId('clerk-sign-up')).toHaveAttribute('data-force-redirect-url', '/onboarding');
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
      unmount();
    }
  });

  it('says sign-up is unavailable, in plain words, when production has no auth configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    vi.stubEnv('NODE_ENV', 'production');
    cookieLocale = 'ar';

    render(await SignUpPage());

    expect(screen.getByRole('alert')).toHaveTextContent('تسجيل الدخول غير متاح الآن');
    expect(screen.queryByText(/NEXT_PUBLIC_CLERK|Clerk environment/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
