/**
 * Offline-cache: de sidst hentede data gemmes på enheden, så appen kan vise dem med det samme ved næste besøg
 * (og uden net). Bruger IndexedDB (plads til mange posteringer), ellers localStorage, ellers hukommelsen.
 *
 * - Data gemmes pr. bruger og med et versionsnummer; forkert version eller for gamle data ignoreres.
 * - `clearAll()` kaldes ved log ud, så bankdata ikke ligger tilbage på enheden.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
    keys: async () => [...m.keys()],
  };
}

export function localStorageStore(ls: Storage = globalThis.localStorage): KeyValueStore {
  return {
    get: async (k) => { try { return ls.getItem(k); } catch { return null; } },
    set: async (k, v) => { ls.setItem(k, v); },
    delete: async (k) => { try { ls.removeItem(k); } catch { /* ignorer */ } },
    keys: async () => { try { return Object.keys(ls); } catch { return []; } },
  };
}

export function indexedDbStore(dbName = "budgetbunkeren", storeName = "cache"): KeyValueStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(storeName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(storeName, mode).objectStore(storeName));
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  };
  return {
    get: async (k) => ((await run("readonly", (s) => s.get(k))) as string | undefined) ?? null,
    set: async (k, v) => { await run("readwrite", (s) => s.put(v, k)); },
    delete: async (k) => { await run("readwrite", (s) => s.delete(k)); },
    keys: async () => (await run("readonly", (s) => s.getAllKeys())).map(String),
  };
}

/** Bedste tilgængelige lager på denne enhed. */
export function defaultStore(): KeyValueStore {
  if (typeof indexedDB !== "undefined") return indexedDbStore();
  try { if (typeof localStorage !== "undefined") { localStorage.setItem("__bb", "1"); localStorage.removeItem("__bb"); return localStorageStore(); } } catch { /* fx privat browsing */ }
  return memoryStore();
}

const PREFIX = "bb-data-";
export const CACHE_VERSION = 1;
export const MAX_AGE_MS = 30 * 864e5;

export interface CachedSnapshot<T> { version: number; savedAt: number; data: T }

export function createOfflineCache<T>(store: KeyValueStore = defaultStore(), now: () => number = Date.now) {
  return {
    async save(userId: string, data: T): Promise<void> {
      const snap: CachedSnapshot<T> = { version: CACHE_VERSION, savedAt: now(), data };
      try { await store.set(PREFIX + userId, JSON.stringify(snap)); }
      catch { await store.delete(PREFIX + userId); }   // fx fuldt lager: hellere ingen cache end en halv
    },
    /** Seneste data for brugeren – eller null, hvis der ingen er, de er for gamle eller i en gammel version. */
    async load(userId: string, maxAgeMs = MAX_AGE_MS): Promise<CachedSnapshot<T> | null> {
      try {
        const raw = await store.get(PREFIX + userId);
        if (!raw) return null;
        const snap = JSON.parse(raw) as CachedSnapshot<T>;
        if (snap.version !== CACHE_VERSION || now() - snap.savedAt > maxAgeMs) return null;
        return snap;
      } catch { return null; }
    },
    /** Sletter alle brugeres data på enheden (bruges ved log ud). */
    async clearAll(): Promise<void> {
      for (const k of await store.keys()) if (k.startsWith(PREFIX)) await store.delete(k);
    },
  };
}
export type OfflineCache<T> = ReturnType<typeof createOfflineCache<T>>;
