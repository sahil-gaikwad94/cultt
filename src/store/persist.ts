/**
 * Persistence for the v5 store.
 *
 * IndexedDB is the primary target (the `seen` set and reaction log grow
 * without bound and localStorage is a synchronous 5 MB string store). A
 * localStorage adapter backs it up so jsdom, older browsers and the unit tests
 * exercise the exact same code path.
 *
 * Writes are debounced and coalesced: an optimistic UI update must never wait
 * on I/O, and a fast swipe burst must not queue twenty transactions.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedState } from './types';

export const DB_NAME = 'cultured-v5';
export const STORE_NAME = 'state';
export const RECORD_KEY = 'current';
export const LOCAL_KEY = 'cultured@v5';

export interface PersistenceAdapter {
  readonly name: 'idb' | 'local';
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ local */

const localAdapter = (storage: Storage): PersistenceAdapter => ({
  name: 'local',
  async load() {
    try {
      const raw = storage.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as PersistedState) : null;
    } catch {
      return null;
    }
  },
  async save(state) {
    try {
      storage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch {
      /* Quota exceeded: the in-memory store stays correct for this session.
         Losing persistence silently is better than throwing into a gesture. */
    }
  },
  async clear() {
    try {
      storage.removeItem(LOCAL_KEY);
    } catch {
      /* nothing to do */
    }
  },
});

/* -------------------------------------------------------------------- idb */

const idbAdapter = (): PersistenceAdapter => {
  let opening: Promise<IDBPDatabase> | null = null;
  const db = () =>
    (opening ??= openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      },
    }));

  return {
    name: 'idb',
    async load() {
      try {
        return ((await (await db()).get(STORE_NAME, RECORD_KEY)) as PersistedState | undefined) ?? null;
      } catch {
        return null;
      }
    },
    async save(state) {
      try {
        await (await db()).put(STORE_NAME, state, RECORD_KEY);
      } catch {
        /* see localAdapter.save */
      }
    },
    async clear() {
      try {
        await (await db()).delete(STORE_NAME, RECORD_KEY);
      } catch {
        /* nothing to do */
      }
    },
  };
};

/**
 * Picks the best adapter available. IndexedDB only when it is really there —
 * private-mode Safari has historically thrown on `openDB`, and jsdom has none
 * at all.
 */
export const createPersistenceAdapter = (storage?: Storage | null): PersistenceAdapter => {
  const store = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
  const idbUsable =
    typeof indexedDB !== 'undefined' &&
    typeof globalThis.structuredClone === 'function' &&
    // Some environments expose the name but not a working implementation.
    !(typeof navigator !== 'undefined' && /HeadlessChrome/.test(navigator.userAgent ?? ''));

  if (idbUsable) {
    const primary = idbAdapter();
    if (!store) return primary;
    // Mirror to localStorage so a catastrophic IDB failure still leaves a
    // recoverable copy, and so the local adapter can seed a first load.
    const mirror = localAdapter(store);
    return {
      name: 'idb',
      async load() {
        return (await primary.load()) ?? (await mirror.load());
      },
      async save(state) {
        await primary.save(state);
        await mirror.save(state);
      },
      async clear() {
        await primary.clear();
        await mirror.clear();
      },
    };
  }

  if (store) return localAdapter(store);

  // No durable storage at all (server-side render, exotic test host): keep the
  // session working in memory rather than crashing the boot path.
  let memory: PersistedState | null = null;
  return {
    name: 'local',
    async load() {
      return memory;
    },
    async save(state) {
      memory = state;
    },
    async clear() {
      memory = null;
    },
  };
};

/**
 * Coalesces writes. `flush()` is exposed so a test (or `pagehide`) can force a
 * pending write instead of waiting for the timer.
 */
export interface DebouncedWriter {
  write(state: PersistedState): void;
  flush(): Promise<void>;
  cancel(): void;
}

export const createDebouncedWriter = (
  adapter: PersistenceAdapter,
  delayMs = 250,
  scheduler: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
): DebouncedWriter => {
  let pending: PersistedState | null = null;
  let handle: unknown = null;
  let inFlight: Promise<void> | null = null;

  const run = () => {
    handle = null;
    const next = pending;
    pending = null;
    if (!next) return;
    inFlight = adapter.save(next).finally(() => {
      if (inFlight) inFlight = null;
    });
  };

  return {
    write(state) {
      pending = state;
      if (handle === null) handle = scheduler.set(run, delayMs);
    },
    async flush() {
      if (handle !== null) {
        scheduler.clear(handle);
        handle = null;
      }
      if (pending) run();
      if (inFlight) await inFlight;
    },
    cancel() {
      if (handle !== null) {
        scheduler.clear(handle);
        handle = null;
      }
      pending = null;
    },
  };
};
