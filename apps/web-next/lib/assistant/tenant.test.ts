import { describe, expect, it } from 'vitest';
import { resolveTenant } from './tenant';

describe('resolveTenant', () => {
  it('uses the Clerk user id as tenant and the auth tier when signed in', () => {
    const result = resolveTenant('user_abc123', undefined);

    expect(result).toEqual({ tenantId: 'user_abc123', tier: 'auth' });
  });

  it('prefers the Clerk identity over any anon signal when both are present', () => {
    const result = resolveTenant('user_abc123', 'sess_existing', '203.0.113.9');

    expect(result).toEqual({ tenantId: 'user_abc123', tier: 'auth' });
  });

  it('keys anonymous enforcement on the request IP when one is visible', () => {
    const result = resolveTenant(null, 'sess_existing', '203.0.113.10');

    expect(result).toEqual({ tenantId: 'ip:203.0.113.10', tier: 'anon' });
  });

  it('falls back to a sid-scoped key when no proxy IP header exists', () => {
    const result = resolveTenant(null, 'sess_existing');

    expect(result).toEqual({ tenantId: 'sid:sess_existing', tier: 'anon' });
  });

  it('mints a fresh continuity cookie even when an IP is present', () => {
    const result = resolveTenant(null, undefined, '203.0.113.11');

    expect(result.tier).toBe('anon');
    expect(result.tenantId).toBe('ip:203.0.113.11');
    expect(result.newSessionId).toBeTruthy();
  });

  it('mints a fresh anon session id when there is neither an IP nor a cookie', () => {
    const result = resolveTenant(null, undefined);

    expect(result.tier).toBe('anon');
    expect(result.newSessionId).toBeTruthy();
    expect(result.tenantId).toBe(`sid:${result.newSessionId}`);
  });
});
