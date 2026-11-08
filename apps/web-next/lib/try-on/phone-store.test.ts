import { describe, expect, it } from 'vitest';
import {
  CONSENT_KEEP_MS,
  createPhoneStore,
  memoryBackend,
  PHONE_KEEP_MS,
  MAX_KEPT_LOOKS,
  type PhoneBackend,
} from './phone-store';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const PHOTO = 'data:image/jpeg;base64,UEhPVE8=';

function look(jobId: string) {
  return {
    jobId,
    productId: 'zahra-dress',
    productName: 'Zahra dress',
    imageDataUrl: `data:image/png;base64,${Buffer.from(jobId).toString('base64')}`,
  };
}

/* Phase zero item 2: the photo and looks stay on the phone for 24 hours,
   consent stays for its own longer time, and expired entries go on load. */
describe('phone store', () => {
  it('empties the photo and looks once 24 hours have passed', async () => {
    const store = createPhoneStore(memoryBackend());
    await store.keepPhoto(PHOTO, NOW);
    await store.keepLook(look('tryon_a'), NOW);

    expect(await store.photo(NOW + PHONE_KEEP_MS - 1)).toBe(PHOTO);
    expect(await store.looks(NOW + PHONE_KEEP_MS - 1)).toHaveLength(1);

    const later = NOW + PHONE_KEEP_MS;
    expect(await store.photo(later)).toBeNull();
    expect(await store.looks(later)).toEqual([]);
    expect(await store.purgeExpired(later)).toBe(2);
    expect(await store.purgeExpired(later)).toBe(0);
  });

  it('counts each look from when it was saved, newest first', async () => {
    const store = createPhoneStore(memoryBackend());
    await store.keepLook(look('tryon_first'), NOW);
    await store.keepLook(look('tryon_second'), NOW + 60_000);

    expect((await store.looks(NOW + 120_000)).map((kept) => kept.jobId)).toEqual(['tryon_second', 'tryon_first']);
    expect((await store.looks(NOW + PHONE_KEEP_MS + 1)).map((kept) => kept.jobId)).toEqual(['tryon_second']);
  });

  it('remembers consent after the photo is gone, until its own expiry', async () => {
    const store = createPhoneStore(memoryBackend());
    await store.rememberConsent(NOW);
    await store.keepPhoto(PHOTO, NOW);

    await store.purgeExpired(NOW + PHONE_KEEP_MS + 1);
    expect(await store.photo(NOW + PHONE_KEEP_MS + 1)).toBeNull();
    expect(await store.hasConsent(NOW + PHONE_KEEP_MS + 1)).toBe(true);

    expect(await store.hasConsent(NOW + CONSENT_KEEP_MS)).toBe(false);
    expect(CONSENT_KEEP_MS).toBeGreaterThan(PHONE_KEEP_MS);
  });

  it('deletes the photo and every look at once, and keeps consent', async () => {
    const store = createPhoneStore(memoryBackend());
    await store.rememberConsent(NOW);
    await store.keepPhoto(PHOTO, NOW);
    await store.keepLook(look('tryon_a'), NOW);
    await store.keepLook(look('tryon_b'), NOW);

    await store.deleteAll();

    expect(await store.photo(NOW)).toBeNull();
    expect(await store.looks(NOW)).toEqual([]);
    expect(await store.hasConsent(NOW)).toBe(true);
  });

  it('keeps nothing while "Keep my photo on this phone" is off, and turning it off deletes', async () => {
    const store = createPhoneStore(memoryBackend());
    expect(await store.keepOnPhone(NOW)).toBe(true);
    await store.keepPhoto(PHOTO, NOW);

    await store.setKeepOnPhone(false, NOW);
    expect(await store.photo(NOW)).toBeNull();
    expect(await store.keepPhoto(PHOTO, NOW)).toBe(false);
    expect(await store.keepLook(look('tryon_a'), NOW)).toBe(false);
    expect(await store.looks(NOW)).toEqual([]);

    await store.setKeepOnPhone(true, NOW);
    expect(await store.keepPhoto(PHOTO, NOW)).toBe(true);
  });

  it('refuses anything that is not a picture', async () => {
    const store = createPhoneStore(memoryBackend());
    expect(await store.keepPhoto('https://example.com/photo.jpg', NOW)).toBe(false);
    expect(await store.keepLook({ ...look('tryon_a'), imageDataUrl: 'javascript:alert(1)' }, NOW)).toBe(false);
  });

  it('treats a phone with no storage as the normal empty case', async () => {
    const store = createPhoneStore(null);
    expect(await store.keepPhoto(PHOTO, NOW)).toBe(false);
    expect(await store.looks(NOW)).toEqual([]);
    expect(await store.photo(NOW)).toBeNull();
    expect(await store.hasConsent(NOW)).toBe(false);
    expect(await store.purgeExpired(NOW)).toBe(0);
  });

  it('never throws when the browser storage fails', async () => {
    const broken: PhoneBackend = {
      get: () => Promise.reject(new Error('QuotaExceededError')),
      put: () => Promise.reject(new Error('QuotaExceededError')),
      delete: () => Promise.reject(new Error('QuotaExceededError')),
      entries: () => Promise.reject(new Error('QuotaExceededError')),
    };
    const store = createPhoneStore(broken);
    expect(await store.keepPhoto(PHOTO, NOW)).toBe(false);
    expect(await store.looks(NOW)).toEqual([]);
    await expect(store.deleteAll()).resolves.toBeUndefined();
    await expect(store.rememberConsent(NOW)).resolves.toBeUndefined();
    expect(await store.purgeExpired(NOW)).toBe(0);
  });

  it('restores only the latest look for this tenant and product after the server result is deleted', async () => {
    const backend = memoryBackend();
    const store = createPhoneStore(backend);
    await store.keepLook({ ...look('first'), tenantKey: 'site:one' }, NOW);
    await store.keepLook({ ...look('newest'), tenantKey: 'site:one' }, NOW + 1);
    await store.keepLook({ ...look('other-store'), tenantKey: 'site:two' }, NOW + 2);
    await store.keepLook({ ...look('other-product'), tenantKey: 'site:one', productId: 'another' }, NOW + 3);
    // Re-opening IndexedDB requires only local image bytes, never the now-deleted signed URL.
    const revisited = createPhoneStore(backend);
    expect((await revisited.latestLook('site:one', 'zahra-dress', NOW + 10))?.jobId).toBe('newest');
    expect(await revisited.latestLook('site:one', 'missing', NOW + 10)).toBeNull();
    expect(await revisited.latestLook('site:one', 'zahra-dress', NOW + PHONE_KEEP_MS + 1)).toBeNull();
    await revisited.deleteLook('newest');
    expect((await revisited.latestLook('site:one', 'zahra-dress', NOW + 10))?.jobId).toBe('first');
  });

  it('caps the store at the five most recent looks', async () => {
    const store = createPhoneStore(memoryBackend());
    for (let i = 0; i < 8; i++) await store.keepLook({ ...look(`look${i}`), tenantKey: 'shop' }, NOW + i);
    expect((await store.looks(NOW + 9)).map((item) => item.jobId)).toEqual(['look7', 'look6', 'look5', 'look4', 'look3']);
    expect(MAX_KEPT_LOOKS).toBe(5);
  });

  it('treats bad JSON, malformed records and remote result URLs as empty', async () => {
    const backend = memoryBackend();
    const store = createPhoneStore(backend);
    await backend.put('kept', 'look:json', '{bad json');
    await backend.put('kept', 'look:invalid', { ...look('invalid'), savedAt: NOW, expiresAt: Infinity });
    await backend.put('kept', 'look:remote', { ...look('remote'), imageDataUrl: 'https://expired.example/result.png', savedAt: NOW, expiresAt: NOW + PHONE_KEEP_MS });
    expect(await store.latestLook('shop', 'zahra-dress', NOW)).toBeNull();
    expect(await store.looks(NOW)).toEqual([]);
  });
});
