import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardLeadsPage from '@/app/dashboard/leads/page';

describe('DashboardLeadsPage', () => {
  it('redirects the retired leads route to Store Chat', () => {
    DashboardLeadsPage();
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/messenger');
  });
});
