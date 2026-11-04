// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';

afterEach(() => vi.unstubAllEnvs());

describe('robots.txt', () => {
  it('points at the sitemap on the site origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://grindctrl.cloud');
    expect(robots().sitemap).toBe('https://grindctrl.cloud/sitemap.xml');
  });

  it('keeps the private surfaces disallowed and leaves /llms.txt crawlable', () => {
    const { rules } = robots();
    const rule = [rules].flat()[0];
    const disallow = [rule.disallow].flat().filter((path): path is string => typeof path === 'string');
    expect(rule.allow).toBe('/');
    for (const path of ['/api/', '/dashboard', '/onboarding', '/embed/', '/shopify/', '/dev/', '/assistant', '/downloads/']) {
      expect(disallow).toContain(path);
    }
    // A rule blocks a path when it is a prefix of it.
    expect(disallow.filter((path) => '/llms.txt'.startsWith(path))).toEqual([]);
  });
});
