import { describe, expect, it } from 'vitest';
import { ACTIVE_INSTALL_WINDOW_MS, buildCanonicalInstallSnippet, buildCspInstallSnippet, containsLegacyInstallPattern, getInstallDomainSafety, getInstallStatus } from '@/lib/adapters/install';

describe('install adapter', () => {
  it('renders the canonical Store Chat snippet', () => {
    const snippet = buildCanonicalInstallSnippet('gc_live_test_123');
    expect(snippet).toBe('<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_live_test_123"></script>');
  });

  it('uses the same external-script shape for the CSP-friendly snippet', () => {
    const snippet = buildCspInstallSnippet('gc_live_test_456');
    expect(snippet).toBe('<script async src="https://grindctrl.cloud/widget/v1/messenger.js" data-key="gc_live_test_456"></script>');
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
