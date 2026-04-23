import { describe, expect, it } from 'vitest';
import { buildCanonicalInstallSnippet, buildCspInstallSnippet, containsLegacyInstallPattern } from '@/lib/adapters/install';

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
});
