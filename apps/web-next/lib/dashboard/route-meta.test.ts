import { describe, expect, it } from 'vitest';
import { getDashboardRouteMeta, normalizeDashboardPathname } from '@/lib/dashboard/route-meta';

describe('dashboard route metadata', () => {
  it('normalizes dashboard index and trailing slash paths', () => {
    expect(normalizeDashboardPathname('/dashboard')).toBe('/dashboard/overview');
    expect(normalizeDashboardPathname('/dashboard/install/')).toBe('/dashboard/install');
  });

  it('returns canonical metadata for known routes', () => {
    const meta = getDashboardRouteMeta('/dashboard/domains');

    expect(meta.title).toBe('Domains');
    expect(meta.description).toContain('authorized');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Domains' },
    ]);
  });

  it('returns metadata for Workflows route', () => {
    const meta = getDashboardRouteMeta('/dashboard/workflows');

    expect(meta.title).toBe('Workflows');
    expect(meta.description).toContain('automation');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Workflows' },
    ]);
  });

  it('returns metadata for Settings route', () => {
    const meta = getDashboardRouteMeta('/dashboard/settings');

    expect(meta.title).toBe('Settings');
    expect(meta.description).toContain('Workspace');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Settings' },
    ]);
  });

  it('returns metadata for Conversations route', () => {
    const meta = getDashboardRouteMeta('/dashboard/conversations');

    expect(meta.title).toBe('Conversations');
    expect(meta.description).toContain('conversation');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Conversations' },
    ]);
  });

  it('returns metadata for Integrations route', () => {
    const meta = getDashboardRouteMeta('/dashboard/integrations');

    expect(meta.title).toBe('Integrations');
    expect(meta.description).toContain('Connect');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Integrations' },
    ]);
  });

  it('builds a readable fallback for unknown dashboard sections', () => {
    const meta = getDashboardRouteMeta('/dashboard/audit-logs');

    expect(meta.title).toBe('Audit Logs');
    expect(meta.breadcrumbs.at(-1)).toEqual({ label: 'Audit Logs' });
  });
});
