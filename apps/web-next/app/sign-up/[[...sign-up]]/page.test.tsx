import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-sign-up">Clerk SignUp</div>,
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
  });

  it('shows the env-missing alert when Clerk is not configured', () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    render(<SignUpPage />);

    expect(screen.getByText('Clerk environment variables are missing')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-up')).not.toBeInTheDocument();
  });

  it('renders Clerk sign-up when the publishable key is configured', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    render(<SignUpPage />);

    expect(screen.getByTestId('clerk-sign-up')).toBeInTheDocument();
    expect(screen.queryByText('Clerk environment variables are missing')).not.toBeInTheDocument();
  });
});
