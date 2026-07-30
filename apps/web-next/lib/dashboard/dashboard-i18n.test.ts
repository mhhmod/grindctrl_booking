import { describe, expect, it } from 'vitest';
import { getDashboardCopy } from './dashboard-i18n';
import { getDashboardRouteMeta } from './route-meta';
import { resolveDashboardNavItems } from './nav-config';
import { resolveDashboardPermissions } from '@/lib/rbac/dashboard-policy';

const permissions = resolveDashboardPermissions({ role: 'owner' });

describe('dashboard copy', () => {
  it('translates every route it claims to cover', () => {
    const en = getDashboardCopy('en');
    const ar = getDashboardCopy('ar');

    // A half-translated dictionary is worse than none: the page would mix
    // languages. Both must cover exactly the same routes.
    expect(Object.keys(ar.routes).sort()).toEqual(Object.keys(en.routes).sort());

    for (const [path, copy] of Object.entries(ar.routes)) {
      expect(copy.title.trim(), `${path} title`).not.toBe('');
      expect(copy.description.trim(), `${path} description`).not.toBe('');
      expect(copy.title, `${path} still English`).not.toBe(en.routes[path].title);
    }
  });
});

describe('getDashboardRouteMeta', () => {
  it('defaults to English', () => {
    expect(getDashboardRouteMeta('/dashboard/try-on').title).toBe('Try-On');
  });

  it('returns Arabic titles, descriptions and breadcrumbs', () => {
    const meta = getDashboardRouteMeta('/dashboard/try-on', 'ar');
    expect(meta.title).toBe('التجربة الافتراضية');
    expect(meta.description).toContain('الإعدادات');
    expect(meta.breadcrumbs[0].label).toBe('لوحة التحكم');
  });

  it('keeps resolving aliases when translated', () => {
    // /dashboard/sites is an alias of /dashboard/install.
    const meta = getDashboardRouteMeta('/dashboard/sites', 'ar');
    expect(meta.title).toBe('الأداة والتضمين');
  });
});

describe('resolveDashboardNavItems', () => {
  it('labels tabs in Arabic', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
      locale: 'ar',
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.label)).toContain('نظرة عامة');
  });

  it('gives a tab the same label as the page it opens', () => {
    // A tab reading one thing and its page heading another is the classic
    // half-translated dashboard bug.
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/overview',
      permissions,
      locale: 'ar',
    });
    for (const item of items) {
      expect(item.label).toBe(getDashboardRouteMeta(item.href, 'ar').title);
    }
  });

  it('still marks the active tab', () => {
    const items = resolveDashboardNavItems({
      pathname: '/dashboard/try-on',
      permissions,
      locale: 'ar',
    });
    expect(items.find((i) => i.href === '/dashboard/try-on')?.isActive).toBe(true);
  });
});
