/**
 * Haptics: one module, named patterns, no-op everywhere `navigator.vibrate`
 * is missing (iOS Safari, desktop). Call sites say *what happened*, never a
 * millisecond array — that keeps the vocabulary consistent and makes the
 * Settings toggle and `prefers-reduced-motion` the only two gates.
 *
 * Patterns are deliberately short. A phone in a pocket should feel a tick, not
 * a massage.
 */

export type HapticPattern = 'tick' | 'light' | 'medium' | 'thud' | 'success' | 'laugh' | 'chord';

/** ms. `tick` is the tray-focus step; `chord` is the mutual-match moment. */
export const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 6,
  light: 10,
  medium: 18,
  thud: [14, 24, 10],
  success: [10, 30, 16],
  laugh: [8, 20, 8, 20, 12],
  chord: [12, 40, 12, 40, 20],
};

export interface HapticsOptions {
  /** Settings toggle. Defaults to on, matching the existing `set.haptics`. */
  enabled?: boolean;
  /** Suppress everything regardless of the toggle. */
  reducedMotion?: boolean;
  /** Deliberately looser than `Pick<Navigator,'vibrate'>`: lib.dom types it
   *  with `Iterable<number>` overloads, which a test double should not need. */
  navigator?: { vibrate?: (pattern: number | number[]) => boolean } | null;
  matchMedia?: (query: string) => { matches: boolean } | null;
}

export interface Haptics {
  /** Fires a named pattern. Returns false when it could not (no API, off). */
  play(pattern: HapticPattern): boolean;
  /** Fires a raw pattern. Exists for the intro's one bespoke beat. */
  raw(pattern: number | number[]): boolean;
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;
}

export const createHaptics = (options: HapticsOptions = {}): Haptics => {
  // `navigator: null` is an explicit "there is no vibration API here", so it
  // must not fall through to the global. Hence the `in` check rather than `??`.
  const nav =
    'navigator' in options
      ? options.navigator ?? null
      : typeof navigator === 'undefined'
        ? null
        : navigator;
  const mql =
    'matchMedia' in options
      ? options.matchMedia ?? null
      : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null;

  let enabled = options.enabled ?? true;
  const reduced = options.reducedMotion ?? !!mql?.('(prefers-reduced-motion: reduce)')?.matches;

  const canVibrate = typeof nav?.vibrate === 'function';

  const fire = (pattern: number | number[]): boolean => {
    if (!canVibrate || !enabled || reduced) return false;
    try {
      return nav?.vibrate?.(pattern) ?? false;
    } catch {
      return false;
    }
  };

  return {
    play: (pattern) => fire(PATTERNS[pattern]),
    raw: (pattern) => fire(pattern),
    setEnabled(next) {
      enabled = next;
    },
    get enabled() {
      return enabled && !reduced;
    },
  };
};

let singleton: Haptics | null = null;

/** The app-wide instance. Screens import this, never `navigator.vibrate`. */
export const haptics: Haptics = createHaptics();

export const getHaptics = (): Haptics => (singleton ??= haptics);
