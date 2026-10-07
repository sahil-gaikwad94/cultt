/**
 * Selectors: every read of store state goes through here.
 *
 * They are pure functions of `(state, …args)` so a screen, a test and the
 * fingerprint engine all get the same answer. Nothing in `src/` should reach
 * into `state.reactions` directly any more — that is precisely how the "You tab
 * shows 0" bug happened (two writers, three readers, no shared derivation).
 */

import type { ItemKind, Pin, Reaction, StoreState } from './types';
import { itemKey } from './types';

/* The legacy emoji constants live in `migrate.ts` (they are migration policy),
   but every reader of a reaction needs them, so they are re-exported here
   rather than imported from the migration module by half the codebase. */
export { LEGACY_LAUGH_EMOJI, LEGACY_LIKE_EMOJI } from './migrate';

/** `❤️` is the legacy "like" carried over by the migration; it is not a laugh. */
export const LEGACY_LIKE = '❤️';

/** Reactions from the meme tray. */
export const MEME_TRAY = ['💀', '😭', '🗿', '🤡', '🧠', '🫠', '🥹', '🔥'] as const;
/** Reactions from the song tray. */
export const SONG_TRAY = ['🔥', '🎧', '🥹', '😭', '🤌', '🫠', '🕺', '💀'] as const;

export const trayFor = (kind: ItemKind): readonly string[] => (kind === 'song' ? SONG_TRAY : MEME_TRAY);

/** Picking any tray reaction on an item spends one laugh. `❤️` never does. */
export const spendsLaugh = (emoji: string): boolean => emoji !== LEGACY_LIKE;

/* ------------------------------------------------------------- reactions */

/** The user's current reaction per item, keyed `kind:id`. Latest wins. */
export const reactionIndex = (state: StoreState): Map<string, Reaction> => {
  const index = new Map<string, Reaction>();
  for (const reaction of state.reactions) {
    const key = itemKey(reaction.kind, reaction.itemId);
    const existing = index.get(key);
    if (!existing || reaction.ts >= existing.ts) index.set(key, reaction);
  }
  return index;
};

export const reactionFor = (state: StoreState, kind: ItemKind, itemId: string): Reaction | null =>
  reactionIndex(state).get(itemKey(kind, itemId)) ?? null;

export const reactedItemKeys = (state: StoreState): string[] => [...reactionIndex(state).keys()];

/** Items the user laughed at — every reaction except the legacy heart. */
export const laughedItemKeys = (state: StoreState): string[] =>
  [...reactionIndex(state).values()].filter((r) => spendsLaugh(r.emoji)).map((r) => itemKey(r.kind, r.itemId));

/** How many laughs were *given* (the You-tab stat). */
export const laughsGivenCount = (state: StoreState): number => laughedItemKeys(state).length;

/** Distinct emoji the user has used, most recent first. */
export const usedReactions = (state: StoreState): string[] => {
  const sorted = [...state.reactions].sort((a, b) => b.ts - a.ts);
  const seen: string[] = [];
  for (const r of sorted) if (!seen.includes(r.emoji)) seen.push(r.emoji);
  return seen;
};

/** The single most-used reaction, for the Weekly recap. Null when there is none. */
export const topReaction = (state: StoreState): { emoji: string; count: number } | null => {
  const counts = new Map<string, number>();
  for (const key of laughedItemKeys(state)) {
    const reaction = reactionIndex(state).get(key);
    if (!reaction) continue;
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }
  let best: { emoji: string; count: number } | null = null;
  for (const [emoji, count] of counts) if (!best || count > best.count) best = { emoji, count };
  return best;
};

/* ----------------------------------------------------------------- saves */

export const savedItemKeys = (state: StoreState): string[] =>
  [...state.saves].sort((a, b) => b.ts - a.ts).map((s) => itemKey(s.kind, s.itemId));

export const isSaved = (state: StoreState, kind: ItemKind, itemId: string): boolean =>
  state.saves.some((s) => s.itemId === itemId && s.kind === kind);

export const savedCount = (state: StoreState): number => state.saves.length;

export const savedByKind = (state: StoreState, kind: ItemKind): string[] =>
  [...state.saves].filter((s) => s.kind === kind).sort((a, b) => b.ts - a.ts).map((s) => s.itemId);

/* ------------------------------------------------------------------ pins */

export const PINK_CAPS = { meme: 6, song: 6, anthem: 1 } as const;

/** Pins grouped by slot kind, ordered by slot. */
export const pinsByKind = (state: StoreState): Record<Pin['kind'], Pin[]> => {
  const out: Record<Pin['kind'], Pin[]> = { meme: [], song: [], anthem: [] };
  for (const pin of state.pins) (out[pin.kind] ??= []).push(pin);
  for (const kind of Object.keys(out) as Pin['kind'][]) out[kind].sort((a, b) => a.slot - b.slot);
  return out;
};

export const isPinned = (state: StoreState, kind: ItemKind, itemId: string): boolean =>
  state.pins.some((p) => p.itemId === itemId && (p.kind === kind || (kind === 'song' && p.kind === 'anthem')));

export const canPin = (state: StoreState, kind: Pin['kind']): boolean =>
  pinsByKind(state)[kind].length < PINK_CAPS[kind as keyof typeof PINK_CAPS];

/* ----------------------------------------------------------------- limits */

/** Local `YYYY-MM-DD`, from a timestamp. */
export const localDay = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The effective limits record for "now".
 *
 * `Math.max(now, lastObservedTs)` is the monotonic guard: rolling the device
 * clock backwards cannot hand out a second budget for a day already spent.
 */
export const effectiveLimits = (state: StoreState, now: number) => {
  const monotonic = Math.max(now, state.limits.lastObservedTs || 0);
  const day = localDay(monotonic);
  if (day === state.limits.day) return state.limits;
  return { ...state.limits, day, laughsUsed: 0, resonatesUsed: 0, lastObservedTs: monotonic };
};

export interface Budget {
  cap: number;
  used: number;
  left: number;
  /** ms until the next local midnight, for the limit sheet countdown. */
  msUntilReset: number;
}

const msUntilMidnight = (now: number): number => {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now);
};

export const laughBudget = (state: StoreState, cap: number, now: number): Budget => {
  const limits = effectiveLimits(state, now);
  const used = Math.min(cap, Math.max(0, limits.laughsUsed));
  return { cap, used, left: cap - used, msUntilReset: msUntilMidnight(now) };
};

export const resonateBudget = (state: StoreState, cap: number, now: number): Budget => {
  const limits = effectiveLimits(state, now);
  const used = Math.min(cap, Math.max(0, limits.resonatesUsed));
  return { cap, used, left: cap - used, msUntilReset: msUntilMidnight(now) };
};

/* ------------------------------------------------------------------- seen */

export const seenCount = (state: StoreState): number => state.seen.length;
export const isSeen = (state: StoreState, itemId: string): boolean => state.seen.includes(itemId);

/* ---------------------------------------------------------------- stories */

export const liveStories = (state: StoreState, now: number, ownerId?: string) =>
  state.stories.filter((s) => s.expiresAt > now && (!ownerId || s.ownerId === ownerId));
