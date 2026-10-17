import { describe, expect, it } from 'vitest';
import { getDashboardRouteMeta, normalizeDashboardPathname } from '@/lib/dashboard/route-meta';

describe('dashboard route metadata', () => {
  it('normalizes dashboard index and trailing slash paths', () => {
    expect(normalizeDashboardPathname('/dashboard')).toBe('/dashboard');
    expect(normalizeDashboardPathname('/dashboard/store-chat/')).toBe('/dashboard/store-chat');
  });

  it('returns metadata for the home, Store Chat and install routes', () => {
    const home = getDashboardRouteMeta('/dashboard');
    const storeChat = getDashboardRouteMeta('/dashboard/store-chat');
    const install = getDashboardRouteMeta('/dashboard/install');
    const tryOn = getDashboardRouteMeta('/dashboard/try-on');

    expect(home.title).toBe('Overview');
    expect(home.breadcrumbs).toEqual([{ label: 'Dashboard', href: '/dashboard' }]);
    expect(storeChat.title).toBe('Store Chat');
    expect(storeChat.breadcrumbs.at(-1)).toEqual({ label: 'Store Chat' });

    expect(install.title).toBe('Widget / Embed');
    expect(install.description).toContain('Install snippet');

    expect(tryOn.title).toBe('Try-On');
    expect(tryOn.description).toContain('generation history');
  });

  it('normalizes legacy route aliases to canonical routes', () => {
    expect(normalizeDashboardPathname('/dashboard/sites')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/branding')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/domains')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/overview')).toBe('/dashboard');
  });

  it('does not alias the retired inbox route', () => {
    expect(normalizeDashboardPathname('/dashboard/inbox')).toBe('/dashboard/inbox');
  });

  it('no longer knows the retired preview routes', () => {
    for (const route of ['agents', 'analytics', 'crm', 'workflows', 'integrations', 'implementation', 'leads']) {
      const meta = getDashboardRouteMeta(`/dashboard/${route}`);
      expect(meta.description).toBe('Workspace data for this dashboard section.');
    }
  });

  it('builds a readable fallback for unknown dashboard sections', () => {
    const meta = getDashboardRouteMeta('/dashboard/audit-logs');

    expect(meta.title).toBe('Audit Logs');
    expect(meta.breadcrumbs.at(-1)).toEqual({ label: 'Audit Logs' });
  });
});
