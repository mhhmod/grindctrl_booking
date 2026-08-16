import { describe, expect, it } from 'vitest';
import { resolveTenant } from './tenant';

describe('resolveTenant', () => {
  it('uses the Clerk user id as tenant and the auth tier when signed in', () => {
    const result = resolveTenant('user_abc123', undefined);

    expect(result).toEqual({ tenantId: 'user_abc123', tier: 'auth' });
  });

  it('uses the existing anon session cookie as tenant when signed out', () => {
    const result = resolveTenant(null, 'sess_existing');

    expect(result).toEqual({ tenantId: 'sess_existing', tier: 'anon' });
  });

  it('mints a fresh anon session id when signed out with no existing cookie', () => {
    const result = resolveTenant(null, undefined);

    expect(result.tier).toBe('anon');
    expect(result.tenantId).toBeTruthy();
    expect(result.newSessionId).toBe(result.tenantId);
  });

  it('prefers the Clerk identity over an existing anon cookie when both are present', () => {
    const result = resolveTenant('user_abc123', 'sess_existing');

    expect(result).toEqual({ tenantId: 'user_abc123', tier: 'auth' });
  });
});
