import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { signOriginToken, verifyOriginToken } from './identity';

const SECRET = 'test-secret-abcdef';
const KEY = 'gc_store_one';
const STORE = 'https://example.myshopify.com';

describe('origin proof token', () => {
  it('round-trips the storefront the embed page verified', () => {
    const token = signOriginToken(SECRET, { key: KEY, origin: STORE });
    expect(token).not.toBeNull();
    expect(verifyOriginToken(SECRET, token, KEY)).toBe(STORE);
  });

  it('refuses a token minted for a different store', () => {
    // Otherwise a shopper on store A could lift their own token and drive
    // store B's conversations with B's embed key, which is public.
    const token = signOriginToken(SECRET, { key: KEY, origin: STORE });
    expect(verifyOriginToken(SECRET, token, 'gc_store_two')).toBeNull();
  });

  it('refuses a forged or re-signed token', () => {
    const token = signOriginToken(SECRET, { key: KEY, origin: STORE })!;
    expect(verifyOriginToken('other-secret', token, KEY)).toBeNull();

    const [h, , s] = token.split('.');
    const swapped = Buffer.from(
      JSON.stringify({
        iss: 'grindctrl-messenger',
        aud: 'messenger-origin',
        exp: Math.floor(Date.now() / 1000) + 600,
        key: KEY,
        org: 'https://evil.example.com',
      }),
    ).toString('base64url');
    expect(verifyOriginToken(SECRET, `${h}.${swapped}.${s}`, KEY)).toBeNull();
  });

  it('refuses an expired token and a missing one', () => {
    const stale = signOriginToken(SECRET, { key: KEY, origin: STORE })!;
    const [h, p, s] = stale.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    payload.exp = Math.floor(Date.now() / 1000) - 120;
    const expired = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
    expect(verifyOriginToken(SECRET, expired, KEY)).toBeNull();

    expect(verifyOriginToken(SECRET, undefined, KEY)).toBeNull();
    expect(verifyOriginToken(SECRET, 'not-a-token', KEY)).toBeNull();
    expect(verifyOriginToken('', stale, KEY)).toBeNull();
  });
});

/* The bug this guards against shipped twice. `originAllowed`'s third argument
   is what decides whether a store's own domain counts as its storefront, and
   a call that omits it does not fail loudly — it silently answers "no" for
   every freshly installed store, because those have zero verified domain rows.
   The result is a widget that installs, renders, and then 403s every single
   shopper request. Adding the argument to the two routes I was looking at and
   missing the other six is exactly how that happened, so the check is
   mechanical rather than a matter of remembering. */
describe('originAllowed call sites', () => {
  it('always decide trust explicitly', () => {
    const root = process.cwd();

    function sources(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...sources(rel));
        else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(rel);
      }
      return out;
    }

    const files = [...sources('app'), ...sources('lib')];
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(path.join(root, file), 'utf8');
      // The call plus everything up to the end of its statement; a compliant
      // call names `trusted` somewhere inside it.
      for (const m of src.matchAll(/originAllowed\(([^;]*?)\)\s*[),;{]/g)) {
        if (!m[1].includes('trusted')) offenders.push(`${file}: ${m[0].trim().slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
