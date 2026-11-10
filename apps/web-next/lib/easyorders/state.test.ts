// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signInstallState, verifyInstallState, STATE_TTL_SECONDS } from './state';
import { SITE, USER } from './test-fixtures';

beforeEach(() => vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'x'.repeat(32)));
afterEach(() => vi.unstubAllEnvs());
describe('EasyOrders signed state', () => {
  it('binds site, initiating user, random nonce and expiry', () => {
    const { state, claims } = signInstallState(SITE, USER, 1000);
    expect(verifyInstallState(state, 1001)).toEqual(claims);
    expect(claims.exp).toBe(1000 + STATE_TTL_SECONDS);
    expect(signInstallState(SITE, USER, 1000).claims.nonce).not.toBe(claims.nonce);
  });
  it('rejects a forged site, signature, appended segment and unsigned payload', () => {
    const { state } = signInstallState(SITE, USER, 1000);
    const [payload, mac] = state.split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
    forged.siteId = '123e4567-e89b-12d3-a456-426614174001';
    for (const bad of [`${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${mac}`, `${payload}.${'0'.repeat(64)}`, `${state}.extra`, payload, '', null]) {
      expect(verifyInstallState(bad, 1001)).toBeNull();
    }
  });
  it('rejects expiry at the boundary and future state', () => {
    const { state } = signInstallState(SITE, USER, 1000);
    expect(verifyInstallState(state, 1599)).not.toBeNull();
    expect(verifyInstallState(state, 1600)).toBeNull();
    expect(verifyInstallState(state, 999)).toBeNull();
  });
  it('fails closed without the shared capability key', () => {
    const { state } = signInstallState(SITE, USER, 1000);
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', '');
    expect(() => signInstallState(SITE, USER)).toThrow();
    expect(() => verifyInstallState(state, 1001)).toThrow();
  });
});
