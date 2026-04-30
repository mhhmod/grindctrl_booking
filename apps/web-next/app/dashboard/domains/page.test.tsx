import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardDomainsPage from '@/app/dashboard/domains/page';

describe('DashboardDomainsPage', () => {
  it('redirects legacy domains route to sites domains tab preserving filters', async () => {
    await DashboardDomainsPage({
      searchParams: Promise.resolve({
        site: 'site_1',
        q: 'example',
        status: 'verified',
        sort: 'domain_asc',
        page: '2',
        pageSize: '25',
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/sites?site=site_1&q=example&status=verified&sort=domain_asc&page=2&pageSize=25&tab=domains');
  });
});
