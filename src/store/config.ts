/**
 * Remote-configurable limits and flags for v5.
 *
 * Everything here has a build-time default and can be overridden by
 * `window.CULTURED_CONFIG` — the same seam the existing app already uses for
 * the backend selection, so no new config plumbing is introduced.
 *
 * The client is advisory: when a backend enforces limits it wins. Until one
 * does, these numbers are the product's limits and the store is the only
 * place they are read from.
 */

export interface V5Config {
  /** Likes on memes/songs. Resets at local midnight. */
  laughsPerDay: number;
  /** Likes on people/pins in Matrix. Separate counter, same reset. */
  resonatesPerDay: number;
  hours: {
    storyTtl: number;
  };
  home: {
    /** Y1 Receipts | Y2 The Verdict */
    yesterdaySubPage: 'receipts' | 'verdict';
    /** T1 The Draft | T2 Forecast */
    tomorrowSubPage: 'draft' | 'forecast';
    /** All four exist behind flags; only the chosen pair is enabled. */
    enabledSubPages: string[];
  };
  /** Sign in after the reveal, if the age check allows an anonymous session. */
  deferAuthToAfterReveal: boolean;
  /** `?demo=1` or an explicit opt-in. Never on by default. */
  demo: boolean;
  /**
   * v5 screen rollout. v5 *is* the app: every screen defaults on. The flags
   * remain as a kill-switch — `?v5=0` (or an explicit `false` per screen) drops
   * back to the legacy shell — so a regression on one surface can be turned off
   * without a redeploy. They are no longer a rollout gate.
   */
  v5: {
    intro: boolean;
    home: boolean;
    vault: boolean;
    profile: boolean;
    stories: boolean;
    matrix: boolean;
    people: boolean;
    arena: boolean;
  };
}

export const DEFAULT_CONFIG: V5Config = {
  laughsPerDay: 15,
  resonatesPerDay: 15,
  hours: { storyTtl: 12 },
  home: {
    yesterdaySubPage: 'receipts',
    tomorrowSubPage: 'draft',
    enabledSubPages: ['receipts', 'today', 'draft'],
  },
  deferAuthToAfterReveal: true,
  demo: false,
  /* v5 is the app: every screen is on by default. `?v5=0` is the kill-switch
     back to the legacy shell; see readV5Config. */
  v5: { intro: true, home: true, vault: true, profile: true, stories: true, matrix: true, people: true, arena: true },
};

interface RawConfig {
  laughsPerDay?: number;
  resonatesPerDay?: number;
  storyTtlHours?: number;
  homeYesterdaySubPage?: string;
  homeTomorrowSubPage?: string;
  deferAuthToAfterReveal?: boolean;
  demo?: boolean;
  v5?: { intro?: boolean; home?: boolean; vault?: boolean; profile?: boolean; stories?: boolean; matrix?: boolean; people?: boolean; arena?: boolean };
}

const isFinitePositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

const getParam = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
};

const hasParam = (name: string): boolean => getParam(name) === '1';

const hasDemoOptIn = (): boolean => hasParam('demo');

/**
 * Reads config once. Call sites import `v5config`; tests use `readV5Config()`
 * with an explicit raw object so nothing depends on `window`.
 */
export const readV5Config = (raw?: RawConfig | null): V5Config => {
  const source =
    raw ??
    (typeof window === 'undefined'
      ? null
      : ((window as Window & { CULTURED_CONFIG?: RawConfig }).CULTURED_CONFIG ?? null));

  const yesterday = source?.homeYesterdaySubPage;
  const tomorrow = source?.homeTomorrowSubPage;

  return {
    laughsPerDay: isFinitePositive(source?.laughsPerDay) ? Math.floor(source.laughsPerDay) : DEFAULT_CONFIG.laughsPerDay,
    resonatesPerDay: isFinitePositive(source?.resonatesPerDay)
      ? Math.floor(source.resonatesPerDay)
      : DEFAULT_CONFIG.resonatesPerDay,
    hours: {
      storyTtl: isFinitePositive(source?.storyTtlHours) ? source.storyTtlHours : DEFAULT_CONFIG.hours.storyTtl,
    },
    home: {
      yesterdaySubPage: yesterday === 'verdict' ? 'verdict' : 'receipts',
      tomorrowSubPage: tomorrow === 'forecast' ? 'forecast' : 'draft',
      enabledSubPages: [
        yesterday === 'verdict' ? 'verdict' : 'receipts',
        'today',
        tomorrow === 'forecast' ? 'forecast' : 'draft',
      ],
    },
    deferAuthToAfterReveal:
      source?.deferAuthToAfterReveal === undefined ? DEFAULT_CONFIG.deferAuthToAfterReveal : !!source.deferAuthToAfterReveal,
    demo: source?.demo === true || hasDemoOptIn(),
    /* v5 is the app, so the shell is on by default. `?v5=0` is the kill-switch
       back to the legacy shell; an explicit per-screen value in the config
       object overrides either way (so one surface can be turned off, or turned
       back on under `?v5=0`, without touching the others). */
    v5: (() => {
      const shellDefault = getParam('v5') !== '0';
      const explicit = source?.v5;
      return {
        intro: explicit?.intro ?? shellDefault,
        home: explicit?.home ?? shellDefault,
        vault: explicit?.vault ?? shellDefault,
        profile: explicit?.profile ?? shellDefault,
        stories: explicit?.stories ?? shellDefault,
        matrix: explicit?.matrix ?? shellDefault,
        people: explicit?.people ?? shellDefault,
        arena: explicit?.arena ?? shellDefault,
      };
    })(),
  };
};

export const v5config: V5Config = readV5Config();
