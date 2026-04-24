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
    expect(meta.description).toContain('allowed domains');
    expect(meta.breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard/overview' },
      { label: 'Domains' },
    ]);
  });

  it('builds a readable fallback for unknown dashboard sections', () => {
    const meta = getDashboardRouteMeta('/dashboard/audit-logs');

    expect(meta.title).toBe('Audit Logs');
    expect(meta.breadcrumbs.at(-1)).toEqual({ label: 'Audit Logs' });
  });
});
