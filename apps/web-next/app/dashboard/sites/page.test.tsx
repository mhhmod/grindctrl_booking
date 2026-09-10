import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import DashboardSitesPage from '@/app/dashboard/sites/page';

describe('DashboardSitesPage', () => {
  it('redirects the retired sites route to Store Chat', () => {
    DashboardSitesPage();
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard/messenger');
  });
});
