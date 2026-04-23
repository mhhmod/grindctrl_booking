import { describe, expect, it } from 'vitest';
import { getDashboardRedirectPath } from '@/lib/auth/dashboard';

describe('dashboard auth protection', () => {
  it('builds the Clerk sign-in redirect for protected dashboard routes', () => {
    expect(getDashboardRedirectPath('/dashboard/install')).toBe('/sign-in?redirect_url=%2Fdashboard%2Finstall');
  });
});
