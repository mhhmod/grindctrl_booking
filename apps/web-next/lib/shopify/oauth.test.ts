// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { APP_SCOPES, buildAuthorizeUrl, statesMatch, verifyOAuthHmac } from './oauth';

const SECRET = 'shpss_test_secret';

function sign(pairs: string[]): string {
  const sorted = [...pairs].sort();
  const digest = createHmac('sha256', SECRET).update(sorted.join('&'), 'utf8').digest('hex');
  return `?${pairs.join('&')}&hmac=${digest}`;
}

describe('verifyOAuthHmac', () => {
  it('accepts a genuine callback', () => {
    const query = sign(['code=abc123', 'shop=demo.myshopify.com', 'state=deadbeef', 'timestamp=1700000000']);
    expect(verifyOAuthHmac(query, SECRET)).toBe(true);
  });

  it('accepts regardless of the order Shopify sent the parameters in', () => {
    const query = sign(['timestamp=1700000000', 'state=deadbeef', 'shop=demo.myshopify.com', 'code=abc123']);
    expect(verifyOAuthHmac(query, SECRET)).toBe(true);
  });

  it('rejects a tampered parameter', () => {
    const query = sign(['code=abc123', 'shop=demo.myshopify.com', 'state=deadbeef']).replace(
      'shop=demo.myshopify.com',
      'shop=attacker.myshopify.com',
    );
    expect(verifyOAuthHmac(query, SECRET)).toBe(false);
  });

  it('rejects an added parameter, which is the replay-with-extras attack', () => {
    const query = `${sign(['code=abc123', 'shop=demo.myshopify.com'])}&extra=1`;
    expect(verifyOAuthHmac(query, SECRET)).toBe(false);
  });

  it('rejects a missing hmac, an empty query and a wrong secret', () => {
    expect(verifyOAuthHmac('?code=abc&shop=demo.myshopify.com', SECRET)).toBe(false);
    expect(verifyOAuthHmac('', SECRET)).toBe(false);
    expect(verifyOAuthHmac(sign(['code=abc']), 'other-secret')).toBe(false);
  });

  it('is not confused by percent-encoded values', () => {
    // Decoding and re-encoding is how this check gets subtly broken; the
    // implementation signs the raw pairs for exactly this reason.
    const query = sign(['host=YXBwcy5teXNob3BpZnk%3D', 'shop=demo.myshopify.com']);
    expect(verifyOAuthHmac(query, SECRET)).toBe(true);
  });
});

describe('statesMatch', () => {
  it('matches only an exact pair', () => {
    expect(statesMatch('abc', 'abc')).toBe(true);
    expect(statesMatch('abc', 'abd')).toBe(false);
    expect(statesMatch('abc', 'ab')).toBe(false);
    expect(statesMatch(undefined, 'abc')).toBe(false);
    expect(statesMatch('abc', null)).toBe(false);
    expect(statesMatch('', '')).toBe(false);
  });
});

describe('buildAuthorizeUrl', () => {
  it('requests an offline token with the app scopes', () => {
    const url = buildAuthorizeUrl({
      shopDomain: 'demo.myshopify.com',
      clientId: 'client-1',
      redirectUri: 'https://grindctrl.cloud/api/shopify/oauth/callback',
      state: 'nonce',
    });
    expect(url.startsWith('https://demo.myshopify.com/admin/oauth/authorize?')).toBe(true);
    expect(url).toContain(`scope=${encodeURIComponent(APP_SCOPES)}`);
    expect(url).toContain('state=nonce');
    // per-user would give a token that dies with the admin's session — the
    // opposite of what a 2am order question needs.
    expect(url).not.toContain('grant_options');
  });

  it('requests read_orders, which is what forces re-consent', () => {
    expect(APP_SCOPES.split(',')).toContain('read_orders');
  });
});
