import { describe, expect, it } from 'vitest';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { getDefaultDashboardPermissions } from '@/lib/rbac/dashboard-policy';

describe('dashboard navigation config', () => {
  it('marks the matching route as active', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/try-on',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/try-on')?.isActive).toBe(true);
    expect(items.find((item) => item.href === '/dashboard/overview')?.isActive).toBe(false);
  });

  it('treats /dashboard as the overview route', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/overview')?.isActive).toBe(true);
  });

  it('filters out entries denied by permissions', () => {
    const permissions = {
      ...getDefaultDashboardPermissions(),
      canViewAgents: false,
    };

    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
    });

    expect(items.some((item) => item.href === '/dashboard/try-on')).toBe(false);
  });

  // The dashboard advertises only what the service actually sells: see the
  // acceptance criteria in nav-config.ts before adding to this list.
  it('ships exactly Overview and Try-On by default', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.map((item) => item.href)).toEqual([
      '/dashboard/overview',
      '/dashboard/try-on',
    ]);
    expect(items.map((item) => item.label)).toEqual(['Overview', 'Try-On']);
  });

  it('assigns group hints to nav items', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.every((item) => item.group === 'core')).toBe(true);
  });
});
