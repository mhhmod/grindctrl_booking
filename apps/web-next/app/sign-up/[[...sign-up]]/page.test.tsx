import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-sign-up">Clerk SignUp</div>,
}));

/* The page resolves its language from the locale cookie, so the test controls
   that cookie directly. */
let cookieLocale: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gc-locale' && cookieLocale ? { name, value: cookieLocale } : undefined,
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
