import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import DashboardIntentsPage from '@/app/dashboard/intents/page';

describe('DashboardIntentsPage', () => {
  it('redirects legacy intents route to canonical routing', async () => {
    await DashboardIntentsPage();
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/routing');
  });
});
