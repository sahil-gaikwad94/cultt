/**
 * Combos — tapping the same thing fast escalates the effect.
 *
 * Build brief §7: "tap fast on the same item and the effect escalates (x2, x3,
 * x5 UNWELL). It's cosmetic, so it never burns your laugh budget." That last
 * clause is the constraint that makes this safe: the escalation lives entirely
 * in this module and the particle layer. Nothing here touches `StoreState`,
 * `limits` or `laughSpend`, so a combo can never mint or spend a laugh.
 *
 * Pure on purpose. `levelFor` and `comboLabel` have no clock and no DOM, and
 * `createComboTracker` takes `now` as an argument, so the whole escalation
 * curve is testable without fake timers.
 */

/** Taps further apart than this are separate intentions, not a combo. */
export const COMBO_WINDOW_MS = 1400;

/**
 * The escalation curve. Deliberately not linear: the jump from 3 to 5 is the
 * joke, and a 4× tier would spend an effect for no payoff.
 */
export const COMBO_LEVELS = [1, 2, 3, 5] as const;

export type ComboLevel = (typeof COMBO_LEVELS)[number];

/** How many hits inside the window map to which level. */
export const levelFor = (hits: number): ComboLevel => {
  if (hits >= 4) return 5;
  if (hits === 3) return 3;
  if (hits === 2) return 2;
  return 1;
};

/**
 * The floating label. The first tap gets nothing — a "×1" on every like would
 * turn a reward into noise.
 */
export const comboLabel = (level: ComboLevel): string => {
  if (level === 5) return '×5 UNWELL';
  if (level === 3) return '×3';
  if (level === 2) return '×2';
  return '';
};

/** Particles for a level. Capped well under the `burst` ceiling of 10. */
export const burstCountFor = (level: ComboLevel): number => {
  if (level === 5) return 10;
  if (level === 3) return 8;
  if (level === 2) return 6;
  return 4;
};

/** Haptic pattern per level. Short and distinct; never long enough to annoy. */
export const hapticFor = (level: ComboLevel): number[] => {
  if (level === 5) return [12, 30, 12, 30, 18];
  if (level === 3) return [10, 24, 14];
  if (level === 2) return [10, 20, 10];
  return [10];
};

/** Drops taps that have fallen out of the window. Never mutates the input. */
export const pruneWindow = (
  hits: readonly number[],
  now: number,
  windowMs: number = COMBO_WINDOW_MS,
): number[] => hits.filter((ts) => now - ts <= windowMs && ts <= now);

export interface ComboTracker {
  /** Records a hit and returns the level it escalates to. */
  record(key: string, now: number): ComboLevel;
  /** Forgets a key — used when the item is un-liked, so a re-like starts fresh. */
  clear(key: string): void;
  hitsFor(key: string): number;
  /** Drops every stale key. Bounded so a long session cannot grow the map. */
  prune(now: number): void;
}

/**
 * One tracker for the whole app, keyed by whatever identifies the item — the
 * seam passes `kind:id`. Keys are dropped when they go stale, so the map stays
 * the size of what the user is actively tapping.
 */
export const createComboTracker = (windowMs: number = COMBO_WINDOW_MS): ComboTracker => {
  const hits = new Map<string, number[]>();

  return {
    record(key, now) {
      const live = [...pruneWindow(hits.get(key) ?? [], now, windowMs), now];
      hits.set(key, live);
      return levelFor(live.length);
    },
    clear(key) {
      hits.delete(key);
    },
    hitsFor(key) {
      return hits.get(key)?.length ?? 0;
    },
    prune(now) {
      for (const [key, list] of hits) {
        const live = pruneWindow(list, now, windowMs);
        if (live.length) hits.set(key, live);
        else hits.delete(key);
      }
    },
  };
};
