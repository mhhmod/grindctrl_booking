// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimPasteLook, PASTE_LOOKS_PER_SHOPPER_SESSION, PASTE_LOOK_WINDOW_SECONDS, type LookCounter } from './look-allowance';

const session = { platform: 'paste-shopify' as const, shop: 'site:11111111-1111-4111-8111-111111111111', sessionId: 'ts_abcdefghijklmnopqrstuvwx',
  requestKey: '11111111-1111-4111-8111-111111111111' };
const look = (n: number) => ({ ...session, requestKey: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}` });

function memory(): LookCounter & { calls: unknown[][] } {
  const sets = new Map<string, Set<string>>();
  const calls: unknown[][] = [];
  const counter = async (key: string, member: string, limit: number, window: number) => {
    calls.push([key, member, limit, window]);
    const set = sets.get(key) ?? new Set<string>();
    sets.set(key, set);
    if (set.has(member)) return 1;
    if (set.size >= limit) return 0;
    set.add(member);
    return 1;
  };
  return Object.assign(counter, { calls });
}

afterEach(() => vi.unstubAllEnvs());

describe('claimPasteLook', () => {
  it('allows six paid looks per shopper session an hour, counting a retried look once', async () => {
    const counter = memory();
    for (let n = 1; n <= PASTE_LOOKS_PER_SHOPPER_SESSION; n++) expect(await claimPasteLook(look(n), counter)).toBe('allowed');
    expect(await claimPasteLook(look(1), counter)).toBe('allowed');
    expect(await claimPasteLook(look(7), counter)).toBe('exhausted');
    expect(counter.calls[0]).toEqual([`gc-paste:looks:v1:${session.shop}:${session.sessionId}`, look(1).requestKey,
      PASTE_LOOKS_PER_SHOPPER_SESSION, PASTE_LOOK_WINDOW_SECONDS]);
    // Another server-issued session has its own allowance.
    expect(await claimPasteLook({ ...look(7), sessionId: 'ts_zyxwvutsrqponmlkjihgfedc' }, counter)).toBe('allowed');
  });

  it('applies to both paste flavours and leaves test looks, the Shopify app and Woo alone', async () => {
    const counter = memory();
    for (const platform of ['paste-website', 'paste-shopify'] as const) {
      expect(await claimPasteLook({ ...session, platform }, counter)).toBe('allowed');
    }
    expect(counter.calls).toHaveLength(2);
    expect(await claimPasteLook({ ...session, test: true }, counter)).toBe('allowed');
    expect(await claimPasteLook({ ...session, platform: undefined }, counter)).toBe('allowed');
    expect(await claimPasteLook({ ...session, platform: 'woocommerce' }, counter)).toBe('allowed');
    expect(counter.calls).toHaveLength(2);
  });

  it('denies when the store is down, unconfigured or answers nonsense', async () => {
    expect(await claimPasteLook(session, async () => { throw new Error('redis down'); })).toBe('unavailable');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await claimPasteLook(session)).toBe('unavailable');
    expect(await claimPasteLook({ ...session, sessionId: '' }, memory())).toBe('unavailable');
  });
});
