import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/* Encryption for per-shop Shopify Admin tokens.

   The table these land in is already service_role only. Encrypting on top
   of that is about a different threat: a database dump, a restored backup,
   or a read-replica credential should not yield live store credentials.
   AES-256-GCM from node:crypto — authenticated, and no new dependency. */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM's standard nonce length
const KEY_BYTES = 32;

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  tag: string;
}

export class MissingTokenKeyError extends Error {
  constructor(detail: string) {
    super(`SHOPIFY_TOKEN_ENC_KEY ${detail}`);
    this.name = 'MissingTokenKeyError';
  }
}

/** Throws rather than falling back to plaintext. A deploy without the key
 *  must fail loudly at the moment it would have stored a credential badly,
 *  not quietly write one nobody can protect. */
export function resolveTokenKey(raw = process.env.SHOPIFY_TOKEN_ENC_KEY): Buffer {
  const value = raw?.trim();
  if (!value) throw new MissingTokenKeyError('is not set');
  const key = Buffer.from(value, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new MissingTokenKeyError(`must be ${KEY_BYTES} base64-encoded bytes, got ${key.length}`);
  }
  return key;
}

export function encryptToken(plaintext: string, key = resolveTokenKey()): EncryptedToken {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/** Throws on a tampered or truncated record — GCM authenticates, so a
 *  modified ciphertext fails here instead of decrypting to garbage that
 *  gets sent to Shopify as a bearer token. */
export function decryptToken(record: EncryptedToken, key = resolveTokenKey()): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
