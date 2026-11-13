import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFormStateCopy, getAuthCopy } from '@/lib/auth/auth-i18n';

const state = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: false as boolean | undefined },
  resolvedTheme: undefined as string | undefined,
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: state.resolvedTheme }) }));
vi.mock('@clerk/themes', () => ({ dark: { name: 'dark' } }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => state.auth,
  ClerkLoading: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ClerkFailed: () => null,
  ClerkLoaded: () => null,
  SignIn: () => null,
  SignUp: () => null,
}));

import { AuthSignIn, CONTINUE_AFTER_SIGN_IN_MS, useClerkAppearance, useContinueWhenSignedIn } from './auth-clerk';

beforeEach(() => {
  vi.useFakeTimers();
  state.auth = { isLoaded: true, isSignedIn: false };
  state.resolvedTheme = undefined;
  state.replace.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove('dark');
});

describe('useContinueWhenSignedIn', () => {
  it('continues an open sign-in page once a sign-in happens in another tab', () => {
    const { rerender } = renderHook(() => useContinueWhenSignedIn('/dashboard/inbox'));
    state.auth = { isLoaded: true, isSignedIn: true };
    rerender();
    act(() => {
      vi.advanceTimersByTime(CONTINUE_AFTER_SIGN_IN_MS);
    });
    expect(state.replace).toHaveBeenCalledWith('/dashboard/inbox');
  });

  it('leaves Clerk alone for a visitor who arrives already signed in', () => {
    state.auth = { isLoaded: true, isSignedIn: true };
    renderHook(() => useContinueWhenSignedIn('/dashboard'));
    act(() => {
      vi.advanceTimersByTime(CONTINUE_AFTER_SIGN_IN_MS * 2);
    });
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('lets Clerk’s own redirect win when the page goes away first', () => {
    const { rerender, unmount } = renderHook(() => useContinueWhenSignedIn('/dashboard'));
    state.auth = { isLoaded: true, isSignedIn: true };
    rerender();
    unmount();
    act(() => {
      vi.advanceTimersByTime(CONTINUE_AFTER_SIGN_IN_MS);
    });
    expect(state.replace).not.toHaveBeenCalled();
  });
});

describe('useClerkAppearance', () => {
  it('is dark from the first frame when the stored theme is dark, before hydration resolves it', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useClerkAppearance());
    expect(result.current).toHaveProperty('baseTheme');
  });

  it.each(['light', 'dark'])('puts "Continue with Google" first as a labelled block button (%s)', (theme) => {
    state.resolvedTheme = theme;
    const { result } = renderHook(() => useClerkAppearance());
    expect(result.current.layout).toEqual({
      logoPlacement: 'none',
      socialButtonsPlacement: 'top',
      socialButtonsVariant: 'blockButton',
    });
    // The social button keeps its 44px touch target.
    expect(result.current.elements.socialButtonsBlockButton).toMatchObject({ minHeight: '44px' });
  });

  it('follows the resolved theme once it is known', () => {
    document.documentElement.classList.add('dark');
    state.resolvedTheme = 'light';
    const { result } = renderHook(() => useClerkAppearance());
    expect(result.current).not.toHaveProperty('baseTheme');
  });
});

describe('AuthSignIn while Clerk loads', () => {
  it('shows the placeholder, then the slow state', () => {
    const copy = authFormStateCopy(getAuthCopy('en'));
    render(<AuthSignIn redirectTo="/dashboard" signUpUrl="/sign-up" signUpRedirectTo="/onboarding" copy={copy} />);
    expect(screen.getByRole('status')).toHaveTextContent(copy.formLoading);
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(copy.formSlowTitle);
  });
});
