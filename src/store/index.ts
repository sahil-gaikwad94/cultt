/**
 * The v5 store: one persisted, reactive source of truth for `reactions`,
 * `saves`, `pins`, `seen`, `limits` and `stories`.
 *
 * Contract:
 *  - Reads go through `getState()` + the selectors in `./selectors`.
 *  - Writes are optimistic: the in-memory state is updated and subscribers are
 *    notified synchronously, persistence happens on a debounce.
 *  - Every mutation returns a result object rather than throwing, because a
 *    refused action (laugh budget spent, pin board full) is a UI state, not an
 *    error.
 *
 * The legacy seam (`src/legacy.ts`) imports `getStore()` and mirrors its own
 * `S.react` / `S.mm` shapes on write so both worlds agree during the migration,
 * but the store — not the seam — decides what the numbers are.
 */

import type { PersistedState, Pin, Reaction, ReactionSurface, Save, StoreState, Story } from './types';
import { emptyState, itemKey } from './types';
import {
  LEGACY_KEY,
  SCHEMA_VERSION,
  readLegacyState,
  reconcile,
  type LegacyState,
  type MigrationResult,
} from './migrate';
import {
  createDebouncedWriter,
  createPersistenceAdapter,
  type DebouncedWriter,
  type PersistenceAdapter,
} from './persist';
import { DEFAULT_CONFIG, type V5Config } from './config';
import {
  PINK_CAPS,
  effectiveLimits,
  isPinned,
  isSaved,
  localDay,
  reactionFor,
  spendsLaugh,
} from './selectors';

export type { StoreState, Reaction, Save, Pin, Story, PersistedState, V5Config };
export { SCHEMA_VERSION, LEGACY_KEY };
export * from './selectors';
export { DEFAULT_CONFIG, readV5Config } from './config';
export { emptyState, itemKey, parseItemKey, toRepoKind } from './types';
export type { ItemKind, ItemRef, Limits, Progress, PinSlotKind } from './types';

export type ReactResult =
  | { ok: true; reason: 'added' | 'changed'; reaction: Reaction }
  | { ok: false; reason: 'budget' | 'unknown-emoji'; reaction: null };

export type SaveResult = { ok: true; saved: boolean };

export type PinResult =
  | { ok: true; reason: 'added' | 'already' | 'removed'; pin: Pin | null }
  | { ok: false; reason: 'full'; pin: null };

export type BudgetResult = { ok: true; left: number } | { ok: false; reason: 'budget'; left: 0 };

export interface StoreOptions {
  persistence?: PersistenceAdapter;
  storage?: Storage | null;
  config?: V5Config;
  /** Injectable clock. Tests drive it; the app uses `Date.now`. */
  now?: () => number;
  /** Legacy blob, injected by tests. Read from `storage` in the app. */
  legacy?: LegacyState | null;
  /** Cross-tab sync. Off in tests, on in the app. */
  crossTab?: boolean;
}

export interface V5Store {
  /** Resolves once the first load + migration is complete. */
  readonly ready: Promise<MigrationResult>;
  readonly persistenceName: PersistenceAdapter['name'];
  getState(): StoreState;
  subscribe(listener: (state: StoreState) => void): () => void;

  react(input: { kind: Reaction['kind']; itemId: string; emoji: string; surface?: ReactionSurface }): ReactResult;
  removeReaction(kind: Reaction['kind'], itemId: string): void;

  toggleSave(kind: Save['kind'], itemId: string): SaveResult;
  setSaved(kind: Save['kind'], itemId: string, saved: boolean): SaveResult;

  pin(kind: Pin['kind'], itemId: string): PinResult;
  unpin(kind: Pin['kind'], itemId: string): PinResult;
  reorderPins(kind: Pin['kind'], orderedItemIds: string[]): void;

  markSeen(itemIds: string[]): void;

  spendResonate(): BudgetResult;
  refundResonate(): void;

  putStory(story: Story): void;
  dropStory(id: string): void;
  /** Removes expired stories. Returns how many went. */
  expireStories(): number;

  markNhieAsked(ids: string[]): void;
  resetNhieAsked(): void;

  flush(): Promise<void>;
  clearLocalData(): Promise<void>;
  dispose(): void;
}

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

export const createStore = (options: StoreOptions = {}): V5Store => {
  const config = options.config ?? DEFAULT_CONFIG;
  const now = options.now ?? (() => Date.now());
  const persistence = options.persistence ?? createPersistenceAdapter(options.storage ?? null);
  const writer: DebouncedWriter = createDebouncedWriter(persistence);

  let state: StoreState = emptyState(SCHEMA_VERSION);
  const listeners = new Set<(state: StoreState) => void>();

  const commit = (patch: Partial<StoreState>): void => {
    state = { ...state, ...patch };
    writer.write(toPersisted(state));
    for (const listener of [...listeners]) listener(state);
  };

  const toPersisted = (s: StoreState): PersistedState => clone(s);

  /**
   * The limits record as of "now", rolled to today if the day changed.
   * Pure: callers commit the result alongside their own write, so a rolled day
   * is never persisted without the mutation that observed it.
   */
  const rolledLimits = (): StoreState['limits'] => effectiveLimits(state, now());

  /* ------------------------------------------------------------- reactions */

  const react: V5Store['react'] = ({ kind, itemId, emoji, surface = 'deck' }) => {
    if (!itemId || !emoji) return { ok: false, reason: 'unknown-emoji', reaction: null };
    const key = itemKey(kind, itemId);
    const existing = reactionFor(state, kind, itemId);
    if (existing && existing.emoji === emoji) {
      return { ok: true, reason: 'added', reaction: existing };
    }

    let limits = rolledLimits();
    let laughSpend = state.laughSpend;

    // The first reaction picked on an item spends one laugh. Changing the
    // reaction on the same item is free (brief §6.2).
    const mustSpend = spendsLaugh(emoji) && !laughSpend.includes(key);
    if (mustSpend) {
      if (limits.laughsUsed >= config.laughsPerDay) return { ok: false, reason: 'budget', reaction: null };
      limits = { ...limits, laughsUsed: limits.laughsUsed + 1, lastObservedTs: now() };
      laughSpend = [...laughSpend, key];
    }

    const ts = now();
    const reaction: Reaction = { itemId, kind, emoji, ts, surface };
    const reactions = existing
      ? state.reactions.map((r) => (r.itemId === itemId && r.kind === kind ? reaction : r))
      : [...state.reactions, reaction];

    // Streak: consecutive local days with at least one laugh.
    let progress = state.progress;
    if (mustSpend) {
      const today = localDay(ts);
      const yesterday = localDay(ts - 86_400_000);
      const last = progress.lastLaughDay;
      const streak = last === today ? progress.laughStreak : last === yesterday ? progress.laughStreak + 1 : 1;
      progress = { ...progress, lastLaughDay: today, laughStreak: Math.max(1, streak) };
    }

    commit({ reactions, limits, laughSpend, progress });
    return { ok: true, reason: existing ? 'changed' : 'added', reaction };
  };

  const removeReaction: V5Store['removeReaction'] = (kind, itemId) => {
    if (!reactionFor(state, kind, itemId)) return;
    // No refund: see the `laughSpend` note in types.ts.
    commit({ reactions: state.reactions.filter((r) => !(r.itemId === itemId && r.kind === kind)) });
  };

  /* ------------------------------------------------------------------ saves */

  const setSaved: V5Store['setSaved'] = (kind, itemId, saved) => {
    const currently = isSaved(state, kind, itemId);
    if (currently === saved) return { ok: true, saved };
    const saves = saved
      ? [...state.saves, { itemId, kind, ts: now() } as Save]
      : state.saves.filter((s) => !(s.itemId === itemId && s.kind === kind));
    commit({ saves });
    return { ok: true, saved };
  };

  const toggleSave: V5Store['toggleSave'] = (kind, itemId) => setSaved(kind, itemId, !isSaved(state, kind, itemId));

  /* ------------------------------------------------------------------- pins */

  const unpin: V5Store['unpin'] = (kind, itemId) => {
    if (!state.pins.some((p) => p.itemId === itemId && p.kind === kind)) return { ok: true, reason: 'removed', pin: null };
    const kept = state.pins
      .filter((p) => !(p.itemId === itemId && p.kind === kind))
      .map((p) => (p.kind === kind ? { ...p, slot: p.slot > 0 ? p.slot - 1 : p.slot } : p));
    // Re-slot so positions stay contiguous.
    const reSlotted = reSlot(kept, kind);
    commit({ pins: reSlotted });
    return { ok: true, reason: 'removed', pin: null };
  };

  const pin: V5Store['pin'] = (kind, itemId) => {
    if (kind !== 'anthem' && isPinned(state, kind, itemId)) {
      const existing = state.pins.find((p) => p.itemId === itemId && p.kind === kind) ?? null;
      return { ok: true, reason: 'already', pin: existing };
    }
    const cap = PINK_CAPS[kind];
    const current = state.pins.filter((p) => p.kind === kind);
    if (current.length >= cap) return { ok: false, reason: 'full', pin: null };
    const next: Pin = { itemId, kind, slot: current.length, ts: now() };
    commit({ pins: [...state.pins, next] });
    return { ok: true, reason: 'added', pin: next };
  };

  const reorderPins: V5Store['reorderPins'] = (kind, orderedItemIds) => {
    const inKind = state.pins.filter((p) => p.kind === kind);
    const others = state.pins.filter((p) => p.kind !== kind);
    const byId = new Map(inKind.map((p) => [p.itemId, p]));
    const reordered: Pin[] = [];
    for (const id of orderedItemIds) {
      const found = byId.get(id);
      if (!found) continue;
      byId.delete(id);
      reordered.push({ ...found, slot: reordered.length });
    }
    // Anything not mentioned keeps its place at the end rather than vanishing.
    for (const leftover of byId.values()) reordered.push({ ...leftover, slot: reordered.length });
    commit({ pins: [...others, ...reordered] });
  };

  /* ------------------------------------------------------------------- seen */

  const markSeen: V5Store['markSeen'] = (itemIds) => {
    const known = new Set(state.seen);
    const added: string[] = [];
    for (const id of itemIds) if (id && !known.has(id)) added.push(id);
    if (!added.length) return;
    commit({ seen: [...state.seen, ...added] });
  };

  /* ----------------------------------------------------------------- limits */

  const spendResonate: V5Store['spendResonate'] = () => {
    const current = rolledLimits();
    if (current.resonatesUsed >= config.resonatesPerDay) return { ok: false, reason: 'budget', left: 0 };
    const limits = { ...current, resonatesUsed: current.resonatesUsed + 1, lastObservedTs: now() };
    commit({ limits });
    return { ok: true, left: config.resonatesPerDay - limits.resonatesUsed };
  };

  const refundResonate: V5Store['refundResonate'] = () => {
    if (state.limits.resonatesUsed <= 0) return;
    commit({ limits: { ...state.limits, resonatesUsed: state.limits.resonatesUsed - 1 } });
  };

  /* ---------------------------------------------------------------- stories */

  const putStory: V5Store['putStory'] = (story) => {
    const stories = state.stories.filter((s) => s.id !== story.id);
    commit({ stories: [...stories, story] });
  };

  const dropStory: V5Store['dropStory'] = (id) => {
    commit({ stories: state.stories.filter((s) => s.id !== id) });
  };

  const expireStories: V5Store['expireStories'] = () => {
    const at = now();
    const before = state.stories.length;
    const kept = state.stories.filter((s) => s.expiresAt > at);
    if (kept.length === before) return 0;
    commit({ stories: kept });
    return before - kept.length;
  };

  /* ------------------------------------------------------------------- game */

  const markNhieAsked: V5Store['markNhieAsked'] = (ids) => {
    const known = new Set(state.progress.nhieAsked);
    const added = ids.filter((id) => id && !known.has(id));
    if (!added.length) return;
    commit({ progress: { ...state.progress, nhieAsked: [...state.progress.nhieAsked, ...added] } });
  };

  const resetNhieAsked: V5Store['resetNhieAsked'] = () => {
    if (!state.progress.nhieAsked.length) return;
    commit({ progress: { ...state.progress, nhieAsked: [] } });
  };

  /* ------------------------------------------------------------------- boot */

  const legacyStorage = options.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);

  const ready: Promise<MigrationResult> = (async () => {
    const [persisted, legacy] = await Promise.all([
      persistence.load(),
      Promise.resolve(options.legacy !== undefined ? options.legacy : readLegacyState(legacyStorage)),
    ]);
    const at = now();
    const result = reconcile(persisted, legacy, at);
    state = result.state;
    // Persist the reconciled result immediately so the migration is durable
    // even if the user closes the tab before their first interaction.
    await persistence.save(toPersisted(state));
    return result;
  })();

  /* ------------------------------------------------------------- cross-tab */

  let detachCrossTab: (() => void) | null = null;
  if (options.crossTab && typeof window !== 'undefined' && persistence.name === 'idb') {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== LEGACY_KEY) return;
      void persistence.load().then((next) => {
        if (!next) return;
        state = { ...emptyState(SCHEMA_VERSION), ...next, schemaVersion: SCHEMA_VERSION };
        for (const listener of [...listeners]) listener(state);
      });
    };
    window.addEventListener('storage', onStorage);
    detachCrossTab = () => window.removeEventListener('storage', onStorage);
  }

  return {
    ready,
    persistenceName: persistence.name,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    react,
    removeReaction,
    toggleSave,
    setSaved,
    pin,
    unpin,
    reorderPins,
    markSeen,
    spendResonate,
    refundResonate,
    putStory,
    dropStory,
    expireStories,
    markNhieAsked,
    resetNhieAsked,
    flush: () => writer.flush(),
    async clearLocalData() {
      writer.cancel();
      state = emptyState(SCHEMA_VERSION);
      await persistence.clear();
      for (const listener of [...listeners]) listener(state);
    },
    dispose() {
      detachCrossTab?.();
      writer.cancel();
      listeners.clear();
    },
  };
};

/** Re-index slots for one kind so they stay 0..n-1 after a removal. */
const reSlot = (pins: Pin[], kind: Pin['kind']): Pin[] => {
  let slot = 0;
  return pins.map((p) => {
    if (p.kind !== kind) return p;
    const next = { ...p, slot: slot++ };
    return next;
  });
};

/* ------------------------------------------------------------- singleton */

let singleton: V5Store | null = null;

/** The app-wide store. Created on first use; `main.ts` awaits `.ready` at boot. */
export const getStore = (): V5Store => (singleton ??= createStore({ crossTab: true }));

/** Test/diagnostic escape hatch: swap in a store built with an injected clock. */
export const setStoreForTests = (store: V5Store | null): void => {
  singleton?.dispose();
  singleton = store;
};
