/* What the try-on keeps on the shopper's own phone (phase zero item 2, and
   the privacy rules in docs/handoff/product-v16/01-system.md).

   - The photo and the looks: 24 hours from when each was saved, and only
     while the shopper leaves "Keep my photo on this phone" on. Turning it
     off deletes them.
   - Consent: its own record with a longer expiry, so "We only ask this
     once" stays true after the photo and looks are gone.
   - Expired entries are purged on every load, and Delete all removes the
     photo and every look at once.

   It lives in IndexedDB in our iframe's origin. Browsers partition that
   storage by the store's site, so it covers one store, and a private window
   or Safari's storage clearing can empty it early: every read treats
   "nothing saved" as the normal case, and no call here ever throws. */

export const PHONE_KEEP_MS = 24 * 60 * 60 * 1000;
export const CONSENT_KEEP_MS = 365 * 24 * 60 * 60 * 1000;

const DB_NAME = 'grindctrl-tryon';
const DB_VERSION = 1;
const KEPT = 'kept';
const SETTINGS = 'settings';
const PHOTO_KEY = 'photo';
const LOOK_PREFIX = 'look:';
const CONSENT_KEY = 'consent';
const KEEP_ON_PHONE_KEY = 'keep-on-phone';

export type PhoneStoreName = typeof KEPT | typeof SETTINGS;

type Expiring = { savedAt: number; expiresAt: number };

export type KeptLook = Expiring & {
  jobId: string;
  productId: string;
  productName: string;
  imageDataUrl: string;
};

type KeptPhoto = Expiring & { dataUrl: string };
type Setting = Expiring & { value: boolean };

/** The few storage calls the store needs. IndexedDB in the browser, a Map
 *  in tests. Each may reject; the store catches. */
export type PhoneBackend = {
  get(store: PhoneStoreName, key: string): Promise<unknown>;
  put(store: PhoneStoreName, key: string, value: unknown): Promise<void>;
  delete(store: PhoneStoreName, key: string): Promise<void>;
  entries(store: PhoneStoreName): Promise<Array<[string, unknown]>>;
};

function isExpiring(value: unknown): value is Expiring {
  if (!value || typeof value !== 'object') return false;
  const { savedAt, expiresAt } = value as Partial<Expiring>;
  return typeof savedAt === 'number' && typeof expiresAt === 'number';
}

function isLive(value: unknown, now: number): boolean {
  return isExpiring(value) && value.expiresAt > now;
}

function isKeptLook(value: unknown): value is KeptLook {
  if (!isExpiring(value)) return false;
  const look = value as Partial<KeptLook>;
  return (
    typeof look.jobId === 'string' &&
    typeof look.productId === 'string' &&
    typeof look.productName === 'string' &&
    typeof look.imageDataUrl === 'string' &&
    look.imageDataUrl.startsWith('data:image/')
  );
}

async function quietly<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

export function createPhoneStore(backend: PhoneBackend | null) {
  async function readSetting(key: string, now: number): Promise<Setting | null> {
    if (!backend) return null;
    const value = await quietly(() => backend.get(SETTINGS, key), null);
    if (!isLive(value, now) || typeof (value as Setting).value !== 'boolean') return null;
    return value as Setting;
  }

  async function deleteAll(): Promise<void> {
    if (!backend) return;
    const kept = await quietly(() => backend.entries(KEPT), []);
    for (const [key] of kept) await quietly(() => backend.delete(KEPT, key), undefined);
  }

  async function keepOnPhone(now: number = Date.now()): Promise<boolean> {
    // On unless the shopper turned it off.
    return (await readSetting(KEEP_ON_PHONE_KEY, now))?.value ?? true;
  }

  return {
    /** Removes every expired entry. Returns how many went. */
    async purgeExpired(now: number = Date.now()): Promise<number> {
      if (!backend) return 0;
      let removed = 0;
      for (const store of [KEPT, SETTINGS] as const) {
        const entries = await quietly(() => backend.entries(store), []);
        for (const [key, value] of entries) {
          if (isLive(value, now)) continue;
          await quietly(() => backend.delete(store, key), undefined);
          removed += 1;
        }
      }
      return removed;
    },

    keepOnPhone,

    /** Turning it off deletes the photo and every look now. */
    async setKeepOnPhone(on: boolean, now: number = Date.now()): Promise<void> {
      if (!backend) return;
      if (!on) await deleteAll();
      const setting: Setting = { value: on, savedAt: now, expiresAt: now + CONSENT_KEEP_MS };
      await quietly(() => backend.put(SETTINGS, KEEP_ON_PHONE_KEY, setting), undefined);
    },

    async keepPhoto(dataUrl: string, now: number = Date.now()): Promise<boolean> {
      if (!backend || !dataUrl.startsWith('data:image/') || !(await keepOnPhone(now))) return false;
      const photo: KeptPhoto = { dataUrl, savedAt: now, expiresAt: now + PHONE_KEEP_MS };
      return quietly(async () => {
        await backend.put(KEPT, PHOTO_KEY, photo);
        return true;
      }, false);
    },

    async photo(now: number = Date.now()): Promise<string | null> {
      if (!backend) return null;
      const value = await quietly(() => backend.get(KEPT, PHOTO_KEY), null);
      if (!isLive(value, now) || typeof (value as KeptPhoto).dataUrl !== 'string') return null;
      return (value as KeptPhoto).dataUrl;
    },

    async keepLook(
      look: Omit<KeptLook, 'savedAt' | 'expiresAt'>,
      now: number = Date.now(),
    ): Promise<boolean> {
      const kept: KeptLook = { ...look, savedAt: now, expiresAt: now + PHONE_KEEP_MS };
      if (!backend || !isKeptLook(kept) || !(await keepOnPhone(now))) return false;
      return quietly(async () => {
        await backend.put(KEPT, `${LOOK_PREFIX}${look.jobId}`, kept);
        return true;
      }, false);
    },

    /** Looks still within their 24 hours, newest first. */
    async looks(now: number = Date.now()): Promise<KeptLook[]> {
      if (!backend) return [];
      const entries = await quietly(() => backend.entries(KEPT), []);
      return entries
        .filter(([key, value]) => key.startsWith(LOOK_PREFIX) && isKeptLook(value) && value.expiresAt > now)
        .map(([, value]) => value as KeptLook)
        .sort((a, b) => b.savedAt - a.savedAt);
    },

    /** Delete all: the photo and every look, at once. Consent stays. */
    deleteAll,

    async rememberConsent(now: number = Date.now()): Promise<void> {
      if (!backend) return;
      const consent: Setting = { value: true, savedAt: now, expiresAt: now + CONSENT_KEEP_MS };
      await quietly(() => backend.put(SETTINGS, CONSENT_KEY, consent), undefined);
    },

    async hasConsent(now: number = Date.now()): Promise<boolean> {
      return (await readSetting(CONSENT_KEY, now))?.value === true;
    },
  };
}

export type PhoneStore = ReturnType<typeof createPhoneStore>;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** IndexedDB in this page's origin, or null where the browser refuses it
 *  (some private windows, storage turned off). */
export function indexedDbBackend(): PhoneBackend | null {
  let factory: IDBFactory;
  try {
    if (typeof indexedDB === 'undefined') return null;
    factory = indexedDB;
  } catch {
    return null;
  }

  let opened: Promise<IDBDatabase> | null = null;
  const open = () => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of [KEPT, SETTINGS]) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
    return opened;
  };

  /* One transaction per call, resolved only once it has committed. */
  const run = async <T>(
    store: PhoneStoreName,
    mode: IDBTransactionMode,
    work: (objectStore: IDBObjectStore) => Promise<T>,
  ): Promise<T> => {
    const db = await open();
    const tx = db.transaction(store, mode);
    const committed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    committed.catch(() => {});
    const result = await work(tx.objectStore(store));
    await committed;
    return result;
  };

  return {
    get: (store, key) => run(store, 'readonly', (s) => request(s.get(key))),
    put: async (store, key, value) => {
      await run(store, 'readwrite', (s) => request(s.put(value, key)));
    },
    delete: async (store, key) => {
      await run(store, 'readwrite', (s) => request(s.delete(key)));
    },
    entries: (store) =>
      run(store, 'readonly', async (s) => {
        const [keys, values] = await Promise.all([request(s.getAllKeys()), request(s.getAll())]);
        return keys.map((key, index) => [String(key), values[index]] as [string, unknown]);
      }),
  };
}


/** A Map-backed store for tests and for pages with no IndexedDB. */
export function memoryBackend(): PhoneBackend {
  const stores = new Map<PhoneStoreName, Map<string, unknown>>([
    [KEPT, new Map()],
    [SETTINGS, new Map()],
  ]);
  const of = (store: PhoneStoreName) => stores.get(store) as Map<string, unknown>;
  return {
    get: async (store, key) => structuredClone(of(store).get(key)),
    put: async (store, key, value) => {
      of(store).set(key, structuredClone(value));
    },
    delete: async (store, key) => {
      of(store).delete(key);
    },
    entries: async (store) => Array.from(of(store).entries()).map(([k, v]) => [k, structuredClone(v)]),
  };
}

/** The phone store for this page. */
export function phoneStore(): PhoneStore {
  return createPhoneStore(indexedDbBackend());
}
