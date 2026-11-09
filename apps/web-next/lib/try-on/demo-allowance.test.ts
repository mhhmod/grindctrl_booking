// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimDemoLook, DEFAULT_DEMO_DAILY_BUDGET, demoDailyBudget, type DemoLookCounter } from './demo-allowance';
import { networkKey } from '@/lib/http/network-key';

afterEach(() => vi.unstubAllEnvs());

describe('demo daily budget setting', () => {
  it('defaults to 150 and reads TRYON_DEMO_DAILY_BUDGET', () => {
    vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', '');
    expect(demoDailyBudget()).toBe(DEFAULT_DEMO_DAILY_BUDGET);
    expect(DEFAULT_DEMO_DAILY_BUDGET).toBe(150);
    vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', '40');
    expect(demoDailyBudget()).toBe(40);
  });
  it.each(['-1', '2.5', 'lots'])('ignores an invalid value (%s)', (value) => {
    vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', value);
    expect(demoDailyBudget()).toBe(DEFAULT_DEMO_DAILY_BUDGET);
  });
  it('pauses the demo at 0 without asking Redis', async () => {
    vi.stubEnv('TRYON_DEMO_DAILY_BUDGET', '0');
    const counter = vi.fn<DemoLookCounter>();
    expect(await claimDemoLook({ network: '203.0.113.5', requestKey: 'k' }, counter)).toBe('budget_exhausted');
    expect(counter).not.toHaveBeenCalled();
  });
});

describe('claimDemoLook', () => {
  it('keys one UTC day per network and one shared spend key in the same slot', async () => {
    const counter = vi.fn<DemoLookCounter>().mockResolvedValue(1);
    await claimDemoLook({ network: '2001:db8:1:2::/64', requestKey: 'req', now: new Date('2026-11-09T23:59:59Z') }, counter);
    expect(counter).toHaveBeenCalledWith(['gc-demo:{2026-11-09}:net:2001:db8:1:2::/64', 'gc-demo:{2026-11-09}:spent'], 'req', 3, 150, 172800);
  });
  it.each([[1, 'allowed'], [2, 'network_exhausted'], [3, 'budget_exhausted'], [7, 'unavailable']] as const)('maps %i to %s', async (code, result) => {
    expect(await claimDemoLook({ network: 'n', requestKey: 'r' }, async () => code)).toBe(result);
  });
  it('fails closed when Redis throws or is not configured', async () => {
    expect(await claimDemoLook({ network: 'n', requestKey: 'r' }, async () => { throw new Error('timeout'); })).toBe('unavailable');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await claimDemoLook({ network: 'n', requestKey: 'r' })).toBe('unavailable');
  });
});

describe('networkKey', () => {
  it('keys every address of one IPv6 /64 together', () => {
    expect(networkKey('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(networkKey('2001:0DB8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(networkKey('[2001:db8:1:2:aaaa::9]')).toBe('2001:db8:1:2::/64');
    expect(networkKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(networkKey('2001:db8:1:3::1')).not.toBe(networkKey('2001:db8:1:2::1'));
  });
  it('keys IPv4 and IPv4-mapped IPv6 by the address', () => {
    expect(networkKey('203.0.113.5')).toBe('203.0.113.5');
    expect(networkKey('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });
  it('shares one bucket for a missing address and keeps unparseable text as itself', () => {
    expect(networkKey(null)).toBe('unknown');
    expect(networkKey('  ')).toBe('unknown');
    expect(networkKey('1::2::3')).toBe('1::2::3');
  });
});
