// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: vi.fn() }));

import { signWooIdentityPayload, verifyWooIdentityTokenWithSecret } from './identity-token';

const SECRET = 'A'.repeat(43);
const SITE = '123e4567-e89b-12d3-a456-426614174000';
const SID = 'sid-abcdefgh';
const NOW = 1_800_000_000;
// Same vector the plugin documents in includes/identity.php.
const VECTOR_PAYLOAD =
  'eyJ2IjoxLCJzaXRlIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIiwid3BVc2VySWQiOjQyLCJzaWQiOiJzaWQtYWJjZGVmZ2giLCJleHAiOjE4MDAwMDA2MDAsImVtYWlsX2hhc2giOiJhODVlOWNhMThmMzQ5MzVhYjliMDM4MWIyNWJmYWQyNDU1NDQ0MTEyYjAxNDkyNzBmZDg4ZTNkYTE3MmZlMTk2In0';
const VECTOR_SIGNATURE = 'ALjdAH_7Yt9HFa83MoWkjpGyOPwJUrwkKSgaaeHLqd4';

function mint(overrides: Record<string, unknown> = {}, secret = SECRET): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, site: SITE, wpUserId: 42, sid: SID, exp: NOW + 600, email_hash: 'a'.repeat(64), ...overrides }),
  ).toString('base64url');
  return `gcw1.${payload}.${createHmac('sha256', secret).update(`gc-woo-identity-v1\n${payload}`, 'utf8').digest('base64url')}`;
}

const verify = (token: string, expected = { siteId: SITE, sid: SID }, now = NOW) =>
  verifyWooIdentityTokenWithSecret(SECRET, token, expected, now);

describe('Woo identity token', () => {
  it('matches the plugin known-answer signature', () => {
    expect(signWooIdentityPayload(SECRET, VECTOR_PAYLOAD)).toBe(VECTOR_SIGNATURE);
    expect(verify(`gcw1.${VECTOR_PAYLOAD}.${VECTOR_SIGNATURE}`, { siteId: SITE, sid: SID }, 1_800_000_100)).toEqual({
      wpUserId: '42',
      emailHash: 'a85e9ca18f34935ab9b0381b25bfad2455444112b0149270fd88e3da172fe196',
    });
  });

  it('accepts a fresh token for this site and session', () => {
    expect(verify(mint())).toEqual({ wpUserId: '42', emailHash: 'a'.repeat(64) });
  });

  it('rejects an expired token', () => {
    expect(verify(mint({ exp: NOW - 31 }))).toBeNull();
    expect(verify(mint({ exp: NOW + 5 }), undefined, NOW + 100)).toBeNull();
  });

  it('rejects a lifetime longer than ten minutes', () => {
    expect(verify(mint({ exp: NOW + 3600 }))).toBeNull();
  });

  it('rejects a token for another site', () => {
    expect(verify(mint({ site: '223e4567-e89b-12d3-a456-426614174000' }))).toBeNull();
    expect(verify(mint(), { siteId: '223e4567-e89b-12d3-a456-426614174000', sid: SID })).toBeNull();
  });

  it('rejects a token for another chat session', () => {
    expect(verify(mint({ sid: 'other-session-1' }))).toBeNull();
    expect(verify(mint(), { siteId: SITE, sid: 'other-session-1' })).toBeNull();
  });

  it('rejects a tampered payload or signature', () => {
    const token = mint();
    const [prefix, payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, site: SITE, wpUserId: 1, sid: SID, exp: NOW + 600 })).toString('base64url');
    expect(verify(`${prefix}.${forged}.${signature}`)).toBeNull();
    expect(verify(`${prefix}.${payload}.${signature.slice(0, -2)}AA`)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    expect(verify(mint({}, 'B'.repeat(43)))).toBeNull();
  });

  it('rejects malformed shapes and bad user ids', () => {
    expect(verify('gcw1.only-one-part')).toBeNull();
    expect(verify(`not-a-woo-token`)).toBeNull();
    expect(verify(mint({ wpUserId: 0 }))).toBeNull();
    expect(verify(mint({ wpUserId: '42' }))).toBeNull();
    expect(verify(mint({ v: 2 }))).toBeNull();
    expect(verify(`gcw1.${'a'.repeat(2000)}.sig`)).toBeNull();
  });
});
