import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Onboarding asks about the person's own store. Someone who signed up from
   a team's invite joins that team and goes straight to the dashboard (N21). */
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  accept: vi.fn(async (): Promise<string[]> => []),
  profile: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/dashboard', () => ({ requireDashboardUser: vi.fn(async () => 'user_new') }));
vi.mock('@/lib/auth/locale', () => ({ getRequestLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/onboarding/profile', () => ({ getOnboardingProfile: mocks.profile }));
vi.mock('@/lib/team/accept', () => ({ acceptInvitesForSignedIn: mocks.accept }));
vi.mock('@/components/brand-logo', () => ({ BrandLogo: () => null }));
vi.mock('@/components/landing/ambient-background', () => ({ AmbientBackground: () => null }));
vi.mock('@/components/onboarding/onboarding-form', () => ({ OnboardingForm: () => <form aria-label="onboarding" /> }));

import OnboardingPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accept.mockResolvedValue([]);
  mocks.profile.mockResolvedValue(null);
});

describe('OnboardingPage', () => {
  it('sends someone who just joined a team to the dashboard', async () => {
    mocks.accept.mockResolvedValue(['ws_1']);
    await expect(OnboardingPage()).rejects.toThrow('redirect:/dashboard');
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it('sends a finished or invited account on to the page it was going to', async () => {
    const searchParams = Promise.resolve({ next: '/claim?token=abc' });
    mocks.profile.mockResolvedValue({ onboardedAt: '2026-10-01T00:00:00Z' });
    await expect(OnboardingPage({ searchParams })).rejects.toThrow('redirect:/claim?token=abc');
    mocks.accept.mockResolvedValue(['ws_1']);
    await expect(OnboardingPage({ searchParams })).rejects.toThrow('redirect:/claim?token=abc');
  });

  it('ignores an off-site next', async () => {
    mocks.profile.mockResolvedValue({ onboardedAt: '2026-10-01T00:00:00Z' });
    await expect(OnboardingPage({ searchParams: Promise.resolve({ next: '//evil.example' }) })).rejects.toThrow('redirect:/dashboard');
  });

  it('asks everyone else about their store, as before', async () => {
    render(await OnboardingPage());
    expect(screen.getByRole('form', { name: 'onboarding' })).toBeInTheDocument();
    mocks.profile.mockResolvedValue({ onboardedAt: '2026-10-01T00:00:00Z' });
    await expect(OnboardingPage()).rejects.toThrow('redirect:/dashboard');
  });
});
