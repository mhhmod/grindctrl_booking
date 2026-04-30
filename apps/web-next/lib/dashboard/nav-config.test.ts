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

  it('includes all platform nav items by default', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.some((item) => item.href === '/dashboard/workflows')).toBe(true);
    expect(items.some((item) => item.href === '/dashboard/integrations')).toBe(true);
    expect(items.some((item) => item.href === '/dashboard/settings')).toBe(true);
  });

  it('includes Conversations in the core group', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const conversations = items.find((item) => item.href === '/dashboard/conversations');
    expect(conversations).toBeDefined();
    expect(conversations?.group).toBe('core');
  });

  it('assigns group hints to nav items', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const overview = items.find((item) => item.href === '/dashboard/overview');
    const install = items.find((item) => item.href === '/dashboard/install');
    const workflows = items.find((item) => item.href === '/dashboard/workflows');
    const integrations = items.find((item) => item.href === '/dashboard/integrations');

    expect(overview?.group).toBe('core');
    expect(install?.group).toBe('widgets');
    expect(workflows?.group).toBe('platform');
    expect(integrations?.group).toBe('platform');
  });

  it('uses short label "Install" instead of "Install Widget"', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const install = items.find((item) => item.href === '/dashboard/install');
    expect(install?.label).toBe('Install');
  });

  it('has exactly 10 nav items with default permissions', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items).toHaveLength(10);
  });
});
