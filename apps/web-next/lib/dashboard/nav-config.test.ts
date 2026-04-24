import { describe, expect, it } from 'vitest';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { getDefaultDashboardPermissions } from '@/lib/rbac/dashboard-policy';

describe('dashboard navigation config', () => {
  it('marks the matching route as active', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/install',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/install')?.isActive).toBe(true);
    expect(items.find((item) => item.href === '/dashboard/overview')?.isActive).toBe(false);
  });

  it('filters out entries denied by permissions', () => {
    const permissions = {
      ...getDefaultDashboardPermissions(),
      canViewDomains: false,
    };

    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
    });

    expect(items.some((item) => item.href === '/dashboard/domains')).toBe(false);
  });
});
