import { describe, expect, it } from 'vitest';
import {
  getDefaultDashboardPermissions,
  normalizeDashboardWorkspaceRole,
  resolveDashboardPermissions,
} from '@/lib/rbac/dashboard-policy';

describe('dashboard policy', () => {
  it('normalizes known workspace roles only', () => {
    expect(normalizeDashboardWorkspaceRole('owner')).toBe('owner');
    expect(normalizeDashboardWorkspaceRole('admin')).toBe('admin');
    expect(normalizeDashboardWorkspaceRole('member')).toBe('member');
    expect(normalizeDashboardWorkspaceRole('viewer')).toBeNull();
    expect(normalizeDashboardWorkspaceRole(null)).toBeNull();
  });

  it('returns default permissions for unknown roles', () => {
    expect(resolveDashboardPermissions({ role: 'viewer' })).toEqual(getDefaultDashboardPermissions());
  });

  it('returns dashboard permissions for workspace roles', () => {
    expect(resolveDashboardPermissions({ role: 'owner' })).toEqual(getDefaultDashboardPermissions());
    expect(resolveDashboardPermissions({ role: 'admin' })).toEqual(getDefaultDashboardPermissions());
    expect(resolveDashboardPermissions({ role: 'member' })).toEqual(getDefaultDashboardPermissions());
  });
});
