import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({
  SignIn: (props: { forceRedirectUrl: string; signUpUrl: string; signUpForceRedirectUrl: string }) => (
    <div
      data-testid="clerk-sign-in"
      data-force-redirect-url={props.forceRedirectUrl}
      data-sign-up-url={props.signUpUrl}
      data-sign-up-force-redirect-url={props.signUpForceRedirectUrl}
    >
      Clerk SignIn
    </div>
  ),
  ClerkFailed: () => null,
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  /* auth-clerk.tsx renders these around SignIn/SignUp so the form doesn't
     flash in from empty space. Real Clerk toggles between them by load
     state; the mock always takes the "loaded" branch so existing assertions
     against the SignIn testid keep working unchanged. */
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

import SignInPage from '@/app/sign-in/[[...sign-in]]/page';

const originalClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function restoreClerkKey() {
  if (originalClerkKey) {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalClerkKey;
    return;
  }

  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

describe('SignInPage', () => {
  afterEach(() => {
    restoreClerkKey();
    cookieLocale = undefined;
  });

  it('shows the env-missing alert when Clerk is not configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('Clerk environment variables are missing')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('renders Clerk sign-in when the publishable key is configured', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(screen.queryByText('Clerk environment variables are missing')).not.toBeInTheDocument();
  });

  it('renders Arabic and flips direction when the locale cookie says so', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
    cookieLocale = 'ar';

    const { container } = render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'أهلًا بعودتك' })).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });

  it('shows context-aware copy, not "Welcome back", when arriving via the Shopify claim redirect', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(
      await SignInPage({
        searchParams: Promise.resolve({ redirect_url: '/claim?token=abc123' }),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'One more step to connect your store' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
  });

  it('keeps the normal "Welcome back" copy for a plain sign-in visit', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('carries the destination to "Create one", so a claim link survives choosing sign-up', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignInPage({ searchParams: Promise.resolve({ redirect_url: '/claim?token=abc123' }) }));

    const signUpHref = '/sign-up?redirect_url=%2Fclaim%3Ftoken%3Dabc123';
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', signUpHref);
    const signIn = screen.getByTestId('clerk-sign-in');
    expect(signIn).toHaveAttribute('data-force-redirect-url', '/claim?token=abc123');
    // Clerk's own "Sign up" link and a sign-in that becomes a new account keep it too.
    expect(signIn).toHaveAttribute('data-sign-up-url', signUpHref);
    expect(signIn).toHaveAttribute('data-sign-up-force-redirect-url', '/onboarding?next=%2Fclaim%3Ftoken%3Dabc123');
  });

  it('never sends someone back to an auth page after signing in', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignInPage({ searchParams: Promise.resolve({ redirect_url: '/sign-in' }) }));

    expect(screen.getByTestId('clerk-sign-in')).toHaveAttribute('data-force-redirect-url', '/dashboard');
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/sign-up');
  });

  it('confirms a sign-out', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(await SignInPage({ searchParams: Promise.resolve({ signed_out: '1' }) }));

    expect(screen.getByRole('status')).toHaveTextContent('You’re signed out.');
  });

  it('says sign-in is unavailable, in plain words, when production has no auth configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    vi.stubEnv('NODE_ENV', 'production');

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('alert')).toHaveTextContent('Signing in isn’t available right now');
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:grindctrlnow@gmail.com');
    expect(screen.queryByText(/NEXT_PUBLIC_CLERK|Clerk environment/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
