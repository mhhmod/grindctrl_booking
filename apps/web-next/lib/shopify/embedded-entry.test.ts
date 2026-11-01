// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { resolveEmbeddedClientId } from './embedded-entry';
beforeEach(() => {
  vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{ clientId: 'app-a', secret: 'a' }, { clientId: 'app-b', secret: 'b' }]));
  vi.stubEnv('SHOPIFY_API_KEY',''); vi.stubEnv('SHOPIFY_API_SECRET','');
});
afterEach(() => vi.unstubAllEnvs());
function token() {
  const now = Math.floor(Date.now()/1000);
  const body = `${Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')}.${Buffer.from(JSON.stringify({
    aud:'app-b',iss:'https://demo.myshopify.com/admin',dest:'https://demo.myshopify.com',sub:'42',nbf:now-1,exp:now+60,
  })).toString('base64url')}`;
  return `${body}.${createHmac('sha256','b').update(body).digest('base64url')}`;
}
describe('App Bridge registration selection', () => {
  it('never guesses the first app when multiple registrations are configured', () => {
    expect(resolveEmbeddedClientId()).toBeNull();
  });
  it('supports a configured per-registration application URL', () => {
    expect(resolveEmbeddedClientId('app-b')).toBe('app-b');
    expect(resolveEmbeddedClientId('unknown')).toBeNull();
  });
  it('uses a verified ID token and rejects a mismatched route', () => {
    expect(resolveEmbeddedClientId(undefined,token())).toBe('app-b');
    expect(resolveEmbeddedClientId('app-a',token())).toBeNull();
    expect(resolveEmbeddedClientId(undefined,'bad-token')).toBeNull();
  });
  it('preserves the original unambiguous single-app development entry', () => {
    vi.stubEnv('SHOPIFY_APPS', JSON.stringify([{clientId:'only-app',secret:'a'}]));
    expect(resolveEmbeddedClientId()).toBe('only-app');
  });
});
