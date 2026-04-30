import { describe, expect, it } from 'vitest';
import { resolveDashboardNavItems } from '@/lib/dashboard/nav-config';
import { getDefaultDashboardPermissions } from '@/lib/rbac/dashboard-policy';

describe('dashboard navigation config', () => {
  it('marks the matching route as active', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/sites',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/sites')?.isActive).toBe(true);
    expect(items.find((item) => item.href === '/dashboard/overview')?.isActive).toBe(false);
  });

  it('filters out entries denied by permissions', () => {
    const permissions = {
      ...getDefaultDashboardPermissions(),
      canViewInstall: false,
    };

    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
    });

    expect(items.some((item) => item.href === '/dashboard/sites')).toBe(false);
  });

  it('includes all platform nav items by default', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.some((item) => item.href === '/dashboard/workflows')).toBe(true);
    expect(items.some((item) => item.href === '/dashboard/integrations')).toBe(true);
    expect(items.some((item) => item.href === '/dashboard/settings')).toBe(true);
  });

  it('includes Inbox in the core group', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const inbox = items.find((item) => item.href === '/dashboard/inbox');
    expect(inbox).toBeDefined();
    expect(inbox?.group).toBe('core');
  });

  it('assigns group hints to nav items', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const overview = items.find((item) => item.href === '/dashboard/overview');
    const sites = items.find((item) => item.href === '/dashboard/sites');
    const workflows = items.find((item) => item.href === '/dashboard/workflows');
    const integrations = items.find((item) => item.href === '/dashboard/integrations');

    expect(overview?.group).toBe('core');
    expect(sites?.group).toBe('widgets');
    expect(workflows?.group).toBe('platform');
    expect(integrations?.group).toBe('platform');
  });

  it('uses product labels for Sites and Routing', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const sites = items.find((item) => item.href === '/dashboard/sites');
    const routing = items.find((item) => item.href === '/dashboard/routing');
    expect(sites?.label).toBe('Sites');
    expect(routing?.label).toBe('Routing');
  });

  it('has exactly 8 nav items with default permissions', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items).toHaveLength(8);
  });
});
