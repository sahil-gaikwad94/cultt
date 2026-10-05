/**
 * Candidate pipeline (PDF §6.3): hard filters -> score -> diversify -> freshness
 * boost -> pacing -> top N. Runs on the client in the mock adapter and as the
 * `candidates` RPC in production.
 *
 * Two rules here are product decisions, not optimisations:
 *
 * - **Freshness boost.** A new user whose profile has 5 events outranks a
 *   5,000-event veteran with the same taste, for the first week. Without it a
 *   cold start is a dry deck.
 * - **Gender-ratio pacing.** When the pool is imbalanced, the over-represented
 *   side's deck is throttled rather than flooding the other side. This is the
 *   fairness guardrail from the Schmooze post-mortem: the metric that killed
 *   that product was female retention, not signups.
 */

import { DEFAULT_WEIGHTS, type TasteProfile, type TasteTwinsBreakdown, tasteTwins, type TasteTwinsWeights } from './tasteTwins';

export type Mode = 'dating' | 'friends' | 'both';

export interface Candidate extends TasteProfile {
  displayName: string;
  bio: string;
  age: number;
  city: string;
  distanceKm: number;
  gender: string;
  lookingFor: readonly Mode[];
  photoChecked: boolean;
  onboarded: boolean;
  deletedAt: number | null;
  deactivatedAt: number | null;
}

export interface Viewer {
  userId: string;
  mode: Mode;
  radiusKm: number;
  ageMin: number;
  ageMax: number;
  onboarded: boolean;
  photoChecked: boolean;
}

export interface CandidateRequest extends Viewer {
  /** The viewer's own taste. Scoring is always viewer-against-candidate. */
  taste: TasteProfile;
  limit?: number;
  weights?: TasteTwinsWeights;
  now?: number;
}

export interface CandidateResult {
  id: string;
  profile: Candidate;
  tasteTwins: TasteTwinsBreakdown;
}

export interface CandidateDeck {
  candidates: CandidateResult[];
  /** How many passed the hard filters before ranking. */
  poolSize: number;
  /** Cards the pacing guardrail held back from an imbalanced pool. */
  paced: number;
  /** Why the deck came back the way it did, for analytics and debugging. */
  diagnostics: {
    rejected: Record<string, number>;
    poolGenderRatio: number;
    pacingApplied: boolean;
  };
}

export const MIN_AGE = 18;
export const DEFAULT_LIMIT = 20;
export const DEFAULT_POOL = 200;
/** Days a new user gets the freshness boost. */
export const FRESHNESS_WINDOW_DAYS = 7;
/** Below this event count a profile counts as fresh. */
export const FRESHNESS_EVENT_THRESHOLD = 20;
/** Pool gender ratio outside this band triggers pacing. */
export const RATIO_PACING_THRESHOLD = 1.6;
/** Most cards in a row that may share a top genre. */
export const MAX_SAME_GENRE_RUN = 2;

/** Hard filters. Anything that fails here is never scored. */
export const hardFilters = (viewer: Viewer, candidate: Candidate, now: number): string | null => {
  if (candidate.userId === viewer.userId) return 'self';
  if (candidate.deletedAt !== null || candidate.deactivatedAt !== null) return 'inactive';
  if (!candidate.onboarded) return 'not_onboarded';
  // The Matrix requires a photo check; a candidate without one is invisible.
  if (!candidate.photoChecked) return 'not_photo_checked';
  if (candidate.age < MIN_AGE) return 'under_18';
  if (candidate.age < viewer.ageMin || candidate.age > viewer.ageMax) return 'age_range';
  if (candidate.distanceKm > viewer.radiusKm) return 'too_far';
  if (!modeMatches(viewer.mode, candidate.lookingFor)) return 'mode';
  if (candidate.lastActiveAt < now - ACTIVE_WINDOW_MS) return 'stale';
  return null;
};

export const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const modeMatches = (viewerMode: Mode, candidateModes: readonly Mode[]): boolean => {
  if (viewerMode === 'both') return true;
  if (candidateModes.includes('both')) return true;
  return candidateModes.includes(viewerMode);
};

const ratioFor = (value: number, total: number): number =>
  total === 0 ? 0 : (value / total) * 2;

export interface PacingDecision {
  /** Cap applied to this side of the pool, or null when no pacing is needed. */
  cap: number | null;
  ratio: number;
  dominantGender: string | null;
}

/**
 * Gender-ratio pacing. An imbalanced pool throttles the side that is over
 * represented so the scarce side never runs out of people to see.
 */
export const pacingDecision = (pool: readonly Candidate[], limit: number): PacingDecision => {
  if (pool.length < 4) return { cap: null, ratio: 1, dominantGender: null };
  const counts = new Map<string, number>();
  for (const candidate of pool) {
    counts.set(candidate.gender, (counts.get(candidate.gender) ?? 0) + 1);
  }
  let dominantGender: string | null = null;
  let dominantCount = 0;
  for (const [gender, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantGender = gender;
    }
  }
  const ratio = ratioFor(dominantCount, pool.length);
  if (ratio < RATIO_PACING_THRESHOLD) return { cap: null, ratio, dominantGender };
  const scarce = pool.length - dominantCount;
  if (scarce === 0) return { cap: 0, ratio, dominantGender };
  return { cap: Math.max(2, Math.min(limit, Math.round(scarce * 1.5))), ratio, dominantGender };
};

/**
 * Freshness boost: a brand-new profile with real signal outranks an
 * identically-tasting veteran during its first week.
 */
export const freshnessBoost = (candidate: Candidate, now: number): number => {
  const ageMs = now - candidate.lastActiveAt;
  const isNew = candidate.eventCount < FRESHNESS_EVENT_THRESHOLD;
  if (!isNew) return 0;
  const days = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
  if (days > FRESHNESS_WINDOW_DAYS) return 0;
  // Strongest on day one, fading to nothing by the end of the window.
  return 0.08 * (1 - days / FRESHNESS_WINDOW_DAYS);
};

/**
 * No more than MAX_SAME_GENRE_RUN cards in a row may lead with the same genre.
 * Rank order is otherwise preserved, so diversity never outranks relevance.
 */
export const diversify = <T extends CandidateResult>(
  ranked: readonly T[],
  topGenreOf: (candidate: Candidate) => string | null,
  maxRun = MAX_SAME_GENRE_RUN,
): T[] => {
  const out: T[] = [];
  const deferred: T[] = [];
  let runGenre: string | null = null;
  let runLength = 0;

  for (const item of ranked) {
    const genre = topGenreOf(item.profile);
    if (genre !== null && genre === runGenre && runLength >= maxRun) {
      deferred.push(item);
      continue;
    }
    if (genre !== null && genre === runGenre) runLength += 1;
    else {
      runGenre = genre;
      runLength = genre === null ? 0 : 1;
    }
    out.push(item);
  }
  // Anything held back for diversity still gets shown once the runs break.
  return [...out, ...deferred];
};

export const rankCandidates = (
  viewer: CandidateRequest,
  pool: readonly Candidate[],
): CandidateDeck => {
  const now = viewer.now ?? Date.now();
  const limit = viewer.limit ?? DEFAULT_LIMIT;
  const weights = viewer.weights ?? DEFAULT_WEIGHTS;

  const rejected: Record<string, number> = {};
  const passed: Candidate[] = [];
  for (const candidate of pool) {
    const reason = hardFilters(viewer, candidate, now);
    if (reason) rejected[reason] = (rejected[reason] ?? 0) + 1;
    else passed.push(candidate);
  }

  const scored: CandidateResult[] = passed.map((profile) => ({
    id: profile.userId,
    profile,
    tasteTwins: tasteTwins(viewer.taste, profile, weights),
  }));

  for (const item of scored) {
    const boost = freshnessBoost(item.profile, now);
    item.tasteTwins = {
      ...item.tasteTwins,
      raw: roundTo(item.tasteTwins.raw + boost),
    };
  }

  scored.sort((a, b) => b.tasteTwins.raw - a.tasteTwins.raw || a.profile.userId.localeCompare(b.profile.userId));

  const pacing = pacingDecision(passed, limit);
  const scoped = pacing.cap === null ? scored : paceByGender(scored, pacing.dominantGender, pacing.cap);
  const diversified = diversify(scoped, topGenreOf);
  const candidates = diversified.slice(0, limit);

  return {
    candidates,
    poolSize: passed.length,
    paced: Math.max(0, scoped.length - candidates.length),
    diagnostics: {
      rejected,
      poolGenderRatio: roundTo(pacing.ratio),
      pacingApplied: pacing.cap !== null,
    },
  };
};

/**
 * Pacing keeps relevance order intact and only caps how many cards from the
 * dominant side can appear. Scarce-side cards are never dropped by this rule.
 */
const paceByGender = <T extends CandidateResult>(
  ranked: readonly T[],
  dominant: string | null,
  cap: number,
): T[] => {
  if (!dominant) return [...ranked];
  let seen = 0;
  return ranked.filter((item) => {
    if (item.profile.gender !== dominant) return true;
    seen += 1;
    return seen <= cap;
  });
};

export const topGenreOf = (candidate: Candidate): string | null =>
  candidate.topGenres.length ? (candidate.topGenres[0] ?? null) : null;

const roundTo = (value: number): number => Math.round(value * 10000) / 10000;



/**
 * Drops anyone either side blocked. The relation is symmetric in storage; the
 * caller supplies both directions so this stays a pure function.
 */
export const applyBlocks = (
  pool: readonly Candidate[],
  blocked: ReadonlySet<string>,
): Candidate[] => pool.filter((candidate) => !blocked.has(candidate.userId));