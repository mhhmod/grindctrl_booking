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
      canViewAnalytics: false,
    };

    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
    });

    expect(items.some((item) => item.href === '/dashboard/analytics')).toBe(false);
  });

  it('includes all required customer-journey nav modules by default', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    const hrefs = items.map((item) => item.href);
    expect(hrefs).toEqual([
      '/dashboard/overview',
      '/dashboard/agents',
      '/dashboard/conversations',
      '/dashboard/messages',
      '/dashboard/leads',
      '/dashboard/crm',
      '/dashboard/workflows',
      '/dashboard/try-on',
      '/dashboard/install',
      '/dashboard/integrations',
      '/dashboard/analytics',
      '/dashboard/settings',
      '/dashboard/implementation',
    ]);
  });

  it('assigns group hints to nav items', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/overview')?.group).toBe('core');
    expect(items.find((item) => item.href === '/dashboard/leads')?.group).toBe('journey');
    expect(items.find((item) => item.href === '/dashboard/integrations')?.group).toBe('platform');
  });

  it('uses product labels for UI journey modules', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items.find((item) => item.href === '/dashboard/agents')?.label).toBe('AI Agents');
    expect(items.find((item) => item.href === '/dashboard/try-on')?.label).toBe('Try-On Agent');
    expect(items.find((item) => item.href === '/dashboard/install')?.label).toBe('Widget / Embed');
    expect(items.find((item) => item.href === '/dashboard/implementation')?.label).toBe('Implementation');
  });

  it('has exactly 13 nav items with default permissions', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions: getDefaultDashboardPermissions(),
    });

    expect(items).toHaveLength(13);
  });
});
