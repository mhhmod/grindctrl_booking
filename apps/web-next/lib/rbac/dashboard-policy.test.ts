import { describe, expect, it } from 'vitest';
import {
  normalizeDashboardWorkspaceRole,
  requireRole,
  resolveDashboardPermissions,
  RoleNotAllowedError,
  roleCan,
  strongestRole,
  type DashboardCapability,
} from '@/lib/rbac/dashboard-policy';

const CAPABILITIES: DashboardCapability[] = ['billing', 'settings', 'team', 'store', 'chats', 'answers'];

describe('dashboard policy', () => {
  it('normalizes known workspace roles only', () => {
    expect(normalizeDashboardWorkspaceRole('owner')).toBe('owner');
    expect(normalizeDashboardWorkspaceRole('admin')).toBe('admin');
    expect(normalizeDashboardWorkspaceRole('member')).toBe('member');
    expect(normalizeDashboardWorkspaceRole('viewer')).toBeNull();
    expect(normalizeDashboardWorkspaceRole(null)).toBeNull();
  });

  /* The Team board's rule: owners see everything, including billing;
     admins manage settings; members answer chats and keep answers up to
     date. */
  it.each([
    ['owner', ['billing', 'settings', 'team', 'store', 'chats', 'answers']],
    ['admin', ['settings', 'team', 'chats', 'answers']],
    ['member', ['chats', 'answers']],
    ['viewer', []],
    [null, []],
  ] as const)('lets %s do exactly %j', (role, allowed) => {
    expect(CAPABILITIES.filter((capability) => roleCan(role, capability))).toEqual(allowed);
  });

  it('keeps billing for the owner alone', () => {
    expect(roleCan('owner', 'billing')).toBe(true);
    expect(roleCan('admin', 'billing')).toBe(false);
    expect(roleCan('member', 'billing')).toBe(false);
  });

  it('refuses what a role may not do', () => {
    expect(() => requireRole('admin', 'billing')).toThrow(RoleNotAllowedError);
    expect(() => requireRole('member', 'settings')).toThrow('You do not have permission to perform this action.');
    expect(() => requireRole(undefined, 'chats')).toThrow(RoleNotAllowedError);
    expect(() => requireRole('member', 'chats')).not.toThrow();
  });

  it('takes the strongest role of several, and ignores unknown ones', () => {
    expect(strongestRole(['member', 'admin'])).toBe('admin');
    expect(strongestRole(['admin', 'owner', 'member'])).toBe('owner');
    expect(strongestRole(['viewer', null, 'member'])).toBe('member');
    expect(strongestRole([])).toBeNull();
  });

  it.each([
    ['owner', { canViewToday: true, canViewTryOn: true, canViewStoreChat: true, canViewPlan: true, canViewSettings: true }],
    ['admin', { canViewToday: true, canViewTryOn: true, canViewStoreChat: true, canViewPlan: false, canViewSettings: true }],
    ['member', { canViewToday: true, canViewTryOn: true, canViewStoreChat: true, canViewPlan: false, canViewSettings: false }],
    ['viewer', { canViewToday: false, canViewTryOn: false, canViewStoreChat: false, canViewPlan: false, canViewSettings: false }],
  ] as const)('shows %s the pages their role allows', (role, permissions) => {
    expect(resolveDashboardPermissions({ role })).toEqual(permissions);
  });
});
