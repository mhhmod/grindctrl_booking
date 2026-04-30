import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-sign-in">Clerk SignIn</div>,
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
  });

  it('shows the env-missing alert when Clerk is not configured', () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    render(<SignInPage />);

    expect(screen.getByText('Clerk environment variables are missing')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('renders Clerk sign-in when the publishable key is configured', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(<SignInPage />);

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(screen.queryByText('Clerk environment variables are missing')).not.toBeInTheDocument();
  });
});
