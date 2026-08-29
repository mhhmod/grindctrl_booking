// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, MissingTokenKeyError, resolveTokenKey } from './token-crypto';

const KEY = randomBytes(32);

describe('token encryption', () => {
  it('round-trips a token', () => {
    const token = 'shpat_0123456789abcdef';
    expect(decryptToken(encryptToken(token, KEY), KEY)).toBe(token);
  });

  it('never stores the token in the clear', () => {
    const record = encryptToken('shpat_secret_value', KEY);
    expect(record.ciphertext).not.toContain('shpat');
    expect(Buffer.from(record.ciphertext, 'base64').toString('utf8')).not.toContain('shpat');
  });

  it('uses a fresh nonce every time, so identical tokens differ at rest', () => {
    const a = encryptToken('same', KEY);
    const b = encryptToken('same', KEY);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('refuses a tampered ciphertext rather than returning garbage', () => {
    // GCM authenticates. Without this, a modified row would decrypt to
    // nonsense that then gets sent to Shopify as a bearer token.
    const record = encryptToken('shpat_value', KEY);
    const flipped = Buffer.from(record.ciphertext, 'base64');
    flipped[0] ^= 0xff;
    expect(() => decryptToken({ ...record, ciphertext: flipped.toString('base64') }, KEY)).toThrow();
  });

  it('refuses the wrong key', () => {
    expect(() => decryptToken(encryptToken('v', KEY), randomBytes(32))).toThrow();
  });
});

describe('resolveTokenKey', () => {
  it('accepts exactly 32 base64 bytes', () => {
    expect(resolveTokenKey(KEY.toString('base64')).length).toBe(32);
  });

  it('throws rather than falling back to plaintext', () => {
    expect(() => resolveTokenKey(undefined)).toThrow(MissingTokenKeyError);
    expect(() => resolveTokenKey('   ')).toThrow(MissingTokenKeyError);
    expect(() => resolveTokenKey(randomBytes(16).toString('base64'))).toThrow(/32 base64-encoded bytes/);
  });
});
