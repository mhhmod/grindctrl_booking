export function isLocalhostHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1';
}

// Pattern rules (spec):
// - exact: example.com
// - wildcard subdomain: *.example.com (matches foo.example.com, not example.com)
export function hostMatchesPattern(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();

  if (!p) return false;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1); // keep leading dot
    if (!h.endsWith(suffix)) return false;
    // Must have something before suffix
    return h.length > suffix.length;
  }
  return h === p;
}

export function anyAllowedDomainMatch(host: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (hostMatchesPattern(host, p)) return true;
  }
  return false;
}
