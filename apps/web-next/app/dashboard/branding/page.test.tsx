import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardBrandingPage from '@/app/dashboard/branding/page';

describe('DashboardBrandingPage', () => {
  it('redirects the retired branding route to Store Chat', () => {
    DashboardBrandingPage();
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/messenger');
  });
});
