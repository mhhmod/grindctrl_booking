import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardBrandingPage from '@/app/dashboard/branding/page';

describe('DashboardBrandingPage', () => {
  it('redirects legacy branding route to install center preserving site query', async () => {
    await DashboardBrandingPage({ searchParams: Promise.resolve({ site: 'site_1' }) });
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/install?site=site_1');
  });
});
