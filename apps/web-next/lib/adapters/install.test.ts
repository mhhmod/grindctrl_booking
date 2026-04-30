import { describe, expect, it } from 'vitest';
import { ACTIVE_INSTALL_WINDOW_MS, buildCanonicalInstallSnippet, buildCspInstallSnippet, containsLegacyInstallPattern, getInstallDomainSafety, getInstallStatus } from '@/lib/adapters/install';

describe('install adapter', () => {
  it('renders the canonical embed snippet with the real loader contract', () => {
    const snippet = buildCanonicalInstallSnippet('gc_live_test_123');
    expect(snippet).toContain("window.GrindctrlSupport = window.GrindctrlSupport || [];");
    expect(snippet).toContain("window.GrindctrlSupport.push({");
    expect(snippet).toContain("embedKey: 'gc_live_test_123'");
    expect(snippet).toContain('https://cdn.grindctrl.com/widget/v1/loader.js');
  });

  it('renders the CSP-friendly snippet with the embed key data attribute', () => {
    const snippet = buildCspInstallSnippet('gc_live_test_456');
    expect(snippet).toContain('data-gc-embed-key="gc_live_test_456"');
    expect(snippet).toContain('https://cdn.grindctrl.com/widget/v1/loader.js');
  });

  it('does not allow stale install snippet patterns in the primary contract', () => {
    expect(containsLegacyInstallPattern(buildCanonicalInstallSnippet('gc_live_test_789'))).toBe(false);
  });

  it('classifies install heartbeat status as active, stale, or never seen', () => {
    const now = new Date('2026-04-23T10:00:00.000Z');

    expect(getInstallStatus(null, now)).toBe('never_seen');
    expect(getInstallStatus({ last_heartbeat_at: new Date(now.getTime() - ACTIVE_INSTALL_WINDOW_MS + 60_000).toISOString() }, now)).toBe('active');
    expect(getInstallStatus({ last_heartbeat_at: new Date(now.getTime() - ACTIVE_INSTALL_WINDOW_MS - 60_000).toISOString() }, now)).toBe('stale');
  });

  it('reports a domain warning when the last heartbeat origin is outside the allowed list', () => {
    const summary = getInstallDomainSafety(
      [
        {
          id: 'domain_1',
          widget_site_id: 'site_1',
          domain: 'example.com',
          verification_status: 'verified',
        },
      ],
      {
        last_heartbeat_at: '2026-04-23T09:00:00.000Z',
        last_seen_origin: 'https://rogue.example.net',
        last_seen_domain: 'rogue.example.net',
      },
      false,
    );

    expect(summary.label).toBe('Domain warning');
    expect(summary.summary).toContain('rogue.example.net');
  });
});
