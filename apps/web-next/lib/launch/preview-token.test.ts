// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PREVIEW_TOKEN_TTL_SECONDS, signPreviewToken, verifyPreviewToken } from './preview-token';

const SECRET = 'shpss_test_secret_value';
const NOW = 1_800_000_000;

describe('the preview link (N5)', () => {
  it('is valid for its own shop for 24 hours', () => {
    const { token, expiresAt } = signPreviewToken(SECRET, 'Maison.myshopify.com', NOW);
    expect(expiresAt).toBe(new Date((NOW + PREVIEW_TOKEN_TTL_SECONDS) * 1000).toISOString());
    expect(verifyPreviewToken(SECRET, token, 'maison.myshopify.com', NOW + 60)).toBe(true);
    expect(verifyPreviewToken(SECRET, token, 'maison.myshopify.com', NOW + PREVIEW_TOKEN_TTL_SECONDS + 1)).toBe(false);
  });

  it('opens no other shop, and no other secret accepts it', () => {
    const { token } = signPreviewToken(SECRET, 'maison.myshopify.com', NOW);
    expect(verifyPreviewToken(SECRET, token, 'other.myshopify.com', NOW)).toBe(false);
    expect(verifyPreviewToken('another_secret', token, 'maison.myshopify.com', NOW)).toBe(false);
  });

  it('refuses a changed or malformed token', () => {
    const { token } = signPreviewToken(SECRET, 'maison.myshopify.com', NOW);
    const [body, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ p: 'storefront-preview', shop: 'maison.myshopify.com', iat: NOW, exp: NOW + 9_999_999 })).toString('base64url');
    expect(verifyPreviewToken(SECRET, `${forged}.${signature}`, 'maison.myshopify.com', NOW)).toBe(false);
    expect(verifyPreviewToken(SECRET, `${body}.${signature}.x`, 'maison.myshopify.com', NOW)).toBe(false);
    expect(verifyPreviewToken(SECRET, 'nonsense', 'maison.myshopify.com', NOW)).toBe(false);
    expect(verifyPreviewToken(SECRET, null, 'maison.myshopify.com', NOW)).toBe(false);
  });
});
