import { describe, expect, it } from 'vitest';
import { getDashboardRouteMeta, normalizeDashboardPathname } from '@/lib/dashboard/route-meta';

describe('dashboard route metadata', () => {
  it('normalizes dashboard index and trailing slash paths', () => {
    expect(normalizeDashboardPathname('/dashboard')).toBe('/dashboard/overview');
    expect(normalizeDashboardPathname('/dashboard/messages/')).toBe('/dashboard/messages');
  });

  it('returns metadata for core journey routes', () => {
    const agents = getDashboardRouteMeta('/dashboard/agents');
    const conversations = getDashboardRouteMeta('/dashboard/conversations');
    const implementation = getDashboardRouteMeta('/dashboard/implementation');

    expect(agents.title).toBe('AI Agents');
    expect(agents.description).toContain('AI agents');

    expect(conversations.title).toBe('Conversations');
    expect(conversations.description).toContain('Unified inbox');

    expect(implementation.title).toBe('Implementation');
    expect(implementation.description).toContain('request form');
  });

  it('returns metadata for analytics and install routes', () => {
    const install = getDashboardRouteMeta('/dashboard/install');
    const analytics = getDashboardRouteMeta('/dashboard/analytics');
    const tryOn = getDashboardRouteMeta('/dashboard/try-on');

    expect(install.title).toBe('Widget / Embed');
    expect(install.description).toContain('Install snippet');

    expect(analytics.title).toBe('Analytics');
    expect(analytics.description).toContain('trial funnel');

    expect(tryOn.title).toBe('Try-On Agent');
    expect(tryOn.description).toContain('Mock-first management');
  });

  it('normalizes legacy route aliases to canonical routes', () => {
    expect(normalizeDashboardPathname('/dashboard/inbox')).toBe('/dashboard/conversations');
    expect(normalizeDashboardPathname('/dashboard/sites')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/branding')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/domains')).toBe('/dashboard/install');
    expect(normalizeDashboardPathname('/dashboard/routing')).toBe('/dashboard/agents');
    expect(normalizeDashboardPathname('/dashboard/intents')).toBe('/dashboard/agents');
  });

  it('builds a readable fallback for unknown dashboard sections', () => {
    const meta = getDashboardRouteMeta('/dashboard/audit-logs');

    expect(meta.title).toBe('Audit Logs');
    expect(meta.breadcrumbs.at(-1)).toEqual({ label: 'Audit Logs' });
  });
});
