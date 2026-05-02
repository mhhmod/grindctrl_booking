import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardDomainsPage from '@/app/dashboard/domains/page';

describe('DashboardDomainsPage', () => {
  it('redirects legacy domains route to install center preserving site context', async () => {
    await DashboardDomainsPage({
      searchParams: Promise.resolve({
        site: 'site_1',
        q: 'example',
        status: 'verified',
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/install?site=site_1');
  });
});
