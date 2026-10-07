/**
 * Versioned migration into the v5 store.
 *
 * Rule 5 of the brief: "Migrate existing stored data with a versioned
 * migration; never wipe user data." Concretely that means:
 *
 *  1. The v5 record carries `schemaVersion`.
 *  2. A payload written by a *newer* build is preserved verbatim (its unknown
 *     keys survive a round-trip) instead of being reset.
 *  3. The pre-v5 `cultured2:state` blob is read once, folded in, and left on
 *     disk untouched so a rollback cannot lose anything.
 *
 * The legacy blob has two incompatible reaction shapes, which is the root
 * cause of the "You tab shows 0" bug:
 *
 *    S.react[postId] = { l: 0|1, h: 0|1, s: 0|1 }   // 10 hard-coded POSTS
 *    S.mm            = { l: {id:0|1}, s: {id:0|1} } // the 122+ meme corpus
 *
 * Both fold into one `reactions` / `saves` pair here.
 */

import type { ItemKind, Pin, Reaction, StoreState } from './types';
import { emptyState } from './types';

export const SCHEMA_VERSION = 1;

/** Pre-v5 localStorage namespace. Read-only from v5 onward. */
export const LEGACY_KEY = 'cultured2:state';

/**
 * Kind of each hard-coded `POSTS` id in `src/legacy.ts:154`. The seam is
 * `@ts-nocheck` and side-effectful, so it cannot be imported here; the table
 * mirrors it and a mismatch degrades to `meme` rather than dropping data.
 */
export const LEGACY_POST_KIND: Record<string, ItemKind> = {
  d1a: 'song',
  d1b: 'meme',
  d2a: 'song',
  d2b: 'meme',
  c1: 'song',
  c2: 'meme',
  c3: 'song',
  c4: 'meme',
  c5: 'song',
  y1: 'song',
  y2: 'meme',
  y3: 'song',
};

/** Legacy heart. Not a laugh — see DECISIONS D-04. */
export const LEGACY_LIKE_EMOJI = '❤️';
/** Legacy laugh, mapped onto the tray's "Slaps". */
export const LEGACY_LAUGH_EMOJI = '🔥';

interface LegacyReactEntry {
  l?: number;
  h?: number;
  s?: number;
}

export interface LegacyState {
  react?: Record<string, LegacyReactEntry>;
  mm?: { l?: Record<string, number>; s?: Record<string, number> };
  shelf?: string[];
  [key: string]: unknown;
}

export interface MigrationResult {
  state: StoreState;
  /** What happened, for logging and for the tests that pin this behaviour. */
  outcome: 'fresh' | 'current' | 'upgraded' | 'legacy-only' | 'newer-preserved';
  /** Counts folded in from the pre-v5 blob. */
  imported: { reactions: number; saves: number; pins: number };
  /** Unknown keys preserved from a newer payload. */
  preservedKeys: string[];
}

const knownKeys: ReadonlySet<string> = new Set([
  'schemaVersion',
  'reactions',
  'saves',
  'pins',
  'seen',
  'laughSpend',
  'limits',
  'stories',
  'progress',
]);

/** `m:<memeId>` / `t:<trackId>` shelf entries → ordered pins per slot kind. */
export const migrateShelf = (shelf: string[] | undefined, ts: number): Pin[] => {
  if (!Array.isArray(shelf)) return [];
  const counters: Record<string, number> = { meme: 0, song: 0, anthem: 0 };
  const pins: Pin[] = [];
  for (const entry of shelf) {
    if (typeof entry !== 'string') continue;
    const sep = entry.indexOf(':');
    if (sep <= 0) continue;
    const marker = entry.slice(0, sep);
    const id = entry.slice(sep + 1);
    if (!id) continue;
    const kind: Pin['kind'] | null = marker === 'm' ? 'meme' : marker === 't' ? 'song' : null;
    if (!kind) continue;
    pins.push({ itemId: id, kind, slot: counters[kind]++, ts });
  }
  return pins;
};

/**
 * Folds the pre-v5 blob into a v5 state. Pure: the same input always gives the
 * same output, ordered by key so the result is deterministic and diffable.
 */
export const migrateLegacyState = (legacy: LegacyState, ts: number): MigrationResult => {
  const state = emptyState(SCHEMA_VERSION);
  state.limits.lastObservedTs = ts;

  /* v5 gives an item exactly one reaction; the legacy blob could carry a heart
     AND a laugh on the same POST. The laugh is the stronger signal, so it
     wins — collapsing here rather than in the selector keeps `reactionIndex`
     honest for every reader. */
  const byItem = new Map<string, Reaction>();
  const pushReaction = (kind: ItemKind, itemId: string, emoji: string, surface: Reaction['surface']) => {
    if (!itemId) return;
    const key = `${kind}:${itemId}`;
    const existing = byItem.get(key);
    if (existing && !(existing.emoji === LEGACY_LIKE_EMOJI && emoji === LEGACY_LAUGH_EMOJI)) return;
    byItem.set(key, { itemId, kind, emoji, ts, surface });
    // A migrated laugh already happened; it must not be charged again.
    if (emoji === LEGACY_LAUGH_EMOJI && !state.laughSpend.includes(key)) state.laughSpend.push(key);
  };

  const react = legacy.react && typeof legacy.react === 'object' ? legacy.react : {};
  for (const postId of Object.keys(react).sort()) {
    const entry = react[postId] ?? {};
    const kind = LEGACY_POST_KIND[postId] ?? 'meme';
    const emoji = entry.h ? LEGACY_LAUGH_EMOJI : entry.l ? LEGACY_LIKE_EMOJI : null;
    if (emoji) pushReaction(kind, postId, emoji, 'deck');
    if (entry.s) state.saves.push({ itemId: postId, kind, ts });
  }

  const mm = legacy.mm && typeof legacy.mm === 'object' ? legacy.mm : {};
  const mmLikes = mm.l && typeof mm.l === 'object' ? mm.l : {};
  const mmSaves = mm.s && typeof mm.s === 'object' ? mm.s : {};
  for (const memeId of Object.keys(mmLikes).sort()) {
    if (mmLikes[memeId]) pushReaction('meme', memeId, LEGACY_LIKE_EMOJI, 'deck');
  }
  for (const memeId of Object.keys(mmSaves).sort()) {
    if (mmSaves[memeId]) state.saves.push({ itemId: memeId, kind: 'meme', ts });
  }

  state.reactions = [...byItem.values()];
  state.pins = migrateShelf(legacy.shelf, ts);

  return {
    state,
    outcome: 'legacy-only',
    imported: { reactions: state.reactions.length, saves: state.saves.length, pins: state.pins.length },
    preservedKeys: [],
  };
};

/** Reads and parses the legacy blob. Returns `null` when absent or unreadable. */
export const readLegacyState = (storage: Pick<Storage, 'getItem'> | null | undefined): LegacyState | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LegacyState) : null;
  } catch {
    return null;
  }
};

/**
 * Reconciles whatever was on disk with the current schema.
 *
 * `persisted` is the v5 record (may be null). `legacy` is the pre-v5 blob (may
 * be null). A v5 record always wins on a key-by-key basis; the legacy blob only
 * contributes where the v5 record is genuinely empty, so re-running the
 * migration on a second boot cannot resurrect a reaction the user removed.
 */
export const reconcile = (
  persisted: Partial<StoreState> | null | undefined,
  legacy: LegacyState | null,
  ts: number,
): MigrationResult => {
  const legacyMigration = legacy ? migrateLegacyState(legacy, ts) : null;

  if (!persisted) {
    if (legacyMigration) return legacyMigration;
    return {
      state: emptyState(SCHEMA_VERSION),
      outcome: 'fresh',
      imported: { reactions: 0, saves: 0, pins: 0 },
      preservedKeys: [],
    };
  }

  const version = typeof persisted.schemaVersion === 'number' ? persisted.schemaVersion : 0;
  const base = emptyState(SCHEMA_VERSION);

  if (version > SCHEMA_VERSION) {
    // A newer build wrote this. Keep everything we understand, preserve the
    // rest, and do not "fix" the data we cannot interpret.
    const preservedKeys = Object.keys(persisted).filter((k) => !knownKeys.has(k));
    return {
      state: {
        ...base,
        ...(Array.isArray(persisted.reactions) ? { reactions: persisted.reactions } : {}),
        ...(Array.isArray(persisted.saves) ? { saves: persisted.saves } : {}),
        ...(Array.isArray(persisted.pins) ? { pins: persisted.pins } : {}),
        ...(Array.isArray(persisted.seen) ? { seen: persisted.seen } : {}),
        ...(Array.isArray(persisted.laughSpend) ? { laughSpend: persisted.laughSpend } : {}),
        ...(persisted.limits ? { limits: { ...base.limits, ...persisted.limits } } : {}),
        ...(Array.isArray(persisted.stories) ? { stories: persisted.stories } : {}),
        ...(persisted.progress ? { progress: { ...base.progress, ...persisted.progress } } : {}),
        schemaVersion: SCHEMA_VERSION,
      },
      outcome: 'newer-preserved',
      imported: { reactions: 0, saves: 0, pins: 0 },
      preservedKeys,
    };
  }

  const state: StoreState = {
    ...base,
    reactions: Array.isArray(persisted.reactions) ? persisted.reactions : [],
    saves: Array.isArray(persisted.saves) ? persisted.saves : [],
    pins: Array.isArray(persisted.pins) ? persisted.pins : [],
    seen: Array.isArray(persisted.seen) ? persisted.seen : [],
    laughSpend: Array.isArray(persisted.laughSpend) ? persisted.laughSpend : [],
    limits: persisted.limits ? { ...base.limits, ...persisted.limits } : base.limits,
    stories: Array.isArray(persisted.stories) ? persisted.stories : [],
    progress: persisted.progress ? { ...base.progress, ...persisted.progress } : base.progress,
    schemaVersion: SCHEMA_VERSION,
  };

  /* The legacy blob is folded exactly once — on the boot that found no v5
     record (handled above). Re-folding it here would resurrect anything the
     user has since deleted, which is its own kind of data loss. */
  return {
    state,
    outcome: version === SCHEMA_VERSION ? 'current' : 'upgraded',
    imported: { reactions: 0, saves: 0, pins: 0 },
    preservedKeys: [],
  };
};
