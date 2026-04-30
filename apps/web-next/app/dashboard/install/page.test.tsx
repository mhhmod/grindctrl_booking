import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardInstallPage from '@/app/dashboard/install/page';

describe('DashboardInstallPage', () => {
  it('redirects legacy install route to sites install tab', async () => {
    await DashboardInstallPage({ searchParams: Promise.resolve({ site: 'site_1', window: '7d' }) });
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/sites?site=site_1&window=7d&tab=install');
  });
});
