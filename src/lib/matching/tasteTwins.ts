/**
 * The Taste Twins score (PDF §6.3) and everything the Match Matrix card needs
 * to explain it: the percentage, a free "why you match" line, and the
 * shared-artist / shared-meme-category chips that act as the icebreaker.
 *
 *   H = cosine(humor_a, humor_b)
 *   M = cosine(music_a, music_b)
 *   S = jaccard(top_artists_a, top_artists_b)
 *   C = calibration_confidence(min(events_a, events_b))   0.5 -> 1.0 over 50 events
 *   P = -0.25 * fraction of b.top_genres that a has blocked
 *   V = -0.10 when a vibe-reported a lookalike cluster
 *   raw = 0.45H + 0.35M + 0.20S + P + V
 *   TasteTwins = round(100 * C * sigmoid(6 * (raw - 0.5)))
 */

import {
  type HumorVector,
  type MusicVector,
  clamp,
  cosine,
  jaccard,
  magnitude,
  overlapFraction,
  round,
  sigmoid,
} from './vector';
import { HUMOR_LABELS, type HumorTag, normalizeHumorTag } from './taxonomy';

export interface TasteProfile {
  userId: string;
  humor: HumorVector;
  music: MusicVector;
  eventCount: number;
  topArtists: readonly string[];
  topGenres: readonly string[];
  topCategories: readonly string[];
  antiGenres: readonly string[];
  /** Ids of people this user vibe-reported: a quality signal, never a punishment. */
  vibeReported: readonly string[];
  /** Cluster of lookalikes this user vibe-reported; drives the V penalty. */
  vibeReportedLookalikes?: readonly string[];
  lastActiveAt: number;
}

export interface TasteTwinsWeights {
  humor: number;
  music: number;
  shared: number;
  antiGenrePenalty: number;
  vibeReportPenalty: number;
  sigmoidSlope: number;
  sigmoidMidpoint: number;
}

/** Humor is weighted above music: mismatch in humor style predicts incompatibility harder. */
export const DEFAULT_WEIGHTS: Readonly<TasteTwinsWeights> = Object.freeze({
  humor: 0.45,
  music: 0.35,
  shared: 0.2,
  antiGenrePenalty: 0.25,
  vibeReportPenalty: 0.1,
  sigmoidSlope: 6,
  sigmoidMidpoint: 0.5,
});

export interface TasteTwinsBreakdown {
  score: number;
  humor: number;
  music: number;
  shared: number;
  confidence: number;
  antiGenrePenalty: number;
  vibeReportPenalty: number;
  raw: number;
  calibrating: boolean;
  sharedArtists: string[];
  sharedGenres: string[];
  sharedCategories: string[];
}

/** Events needed before a profile is trusted; the Matrix shows "calibrating". */
export const CONFIDENCE_EVENTS = 50;
export const MIN_TRUSTED_EVENTS = 10;

/** Ramp 0.5 -> 1.0 over the first 50 events, flat afterwards. */
export const calibrationConfidence = (events: number): number => {
  const safe = Math.max(0, Math.floor(events));
  if (safe >= CONFIDENCE_EVENTS) return 1;
  return 0.5 + 0.5 * (safe / CONFIDENCE_EVENTS);
};

export const isCalibrating = (events: number): boolean => events < MIN_TRUSTED_EVENTS;

export const tasteTwins = (
  a: TasteProfile,
  b: TasteProfile,
  weights: TasteTwinsWeights = DEFAULT_WEIGHTS,
): TasteTwinsBreakdown => {
  const humor = cosine(a.humor, b.humor);
  const music = cosine(a.music, b.music);
  const sharedArtists = intersect(a.topArtists, b.topArtists);
  const shared = jaccard(a.topArtists, b.topArtists);
  const sharedGenres = intersect(a.topGenres, b.topGenres);
  const sharedCategories = intersect(a.topCategories, b.topCategories);

  const confidence = calibrationConfidence(Math.min(a.eventCount, b.eventCount));

  // The lookalike of someone a already vibe-reported is worth less, but this
  // is deliberately a small penalty on the *viewer*, never a sanction on the
  // person being viewed.
  const blockedByViewer = overlapFraction(b.topGenres, a.antiGenres);
  const antiGenrePenalty = -weights.antiGenrePenalty * blockedByViewer;

  const lookalikes = a.vibeReportedLookalikes ?? [];
  const vibeReportPenalty =
    lookalikes.includes(b.userId) || a.vibeReported.includes(b.userId)
      ? -weights.vibeReportPenalty
      : 0;

  const raw =
    weights.humor * humor +
    weights.music * music +
    weights.shared * shared +
    antiGenrePenalty +
    vibeReportPenalty;

  const shaped = sigmoid(weights.sigmoidSlope * (raw - weights.sigmoidMidpoint));
  const score = clamp(Math.round(100 * confidence * shaped), 0, 100);

  return {
    score,
    humor: round(humor),
    music: round(music),
    shared: round(shared),
    confidence: round(confidence, 3),
    antiGenrePenalty: round(antiGenrePenalty),
    vibeReportPenalty: round(vibeReportPenalty),
    raw: round(raw),
    calibrating: isCalibrating(Math.min(a.eventCount, b.eventCount)),
    sharedArtists,
    sharedGenres,
    sharedCategories,
  };
};

/**
 * One free line explaining the score. Never reveals a raw vector, a blocked
 * genre or a vibe-report: the product says "this didn't feel like a match" to
 * the reporter and stays silent everywhere else.
 */
export const whyYouMatch = (
  breakdown: TasteTwinsBreakdown,
  options: { theirName?: string } = {},
): string => {
  const name = options.theirName ? options.theirName.trim() : 'They';
  const who = name && name !== 'They' ? name : 'you two';

  if (breakdown.calibrating) {
    return 'Still calibrating — react to a few more things and the read sharpens.';
  }
  if (breakdown.antiGenrePenalty < -0.05) {
    return 'A genre you filtered out is in their rotation.';
  }
  if (breakdown.sharedArtists.length) {
    const artists = listOf(breakdown.sharedArtists);
    return `You both listen to ${artists}.`;
  }
  if (breakdown.sharedCategories.length) {
    const category = breakdown.sharedCategories[0];
    const label = HUMOR_LABELS[(normalizeHumorTag(category) ?? 'relatable') as HumorTag];
    return `Same taste in ${label.toLowerCase()} humour.`;
  }
  if (breakdown.sharedGenres.length) {
    return `Both all-in on ${listOf(breakdown.sharedGenres)}.`;
  }
  if (breakdown.humor >= breakdown.music) {
    return `Your humour lands the same way. Give ${who} a listen anyway.`;
  }
  return `Close enough on sound to be worth a message.`;
};

const listOf = (values: readonly string[]): string => {
  const clean = values.filter(Boolean);
  if (!clean.length) return 'the same things';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, 2).join(', ')} and ${clean.length - 2} more`;
};

const intersect = (a: readonly string[], b: readonly string[]): string[] => {
  if (!a.length || !b.length) return [];
  const lookup = new Set(a.map((value) => value.toLowerCase()));
  return b.filter((value) => lookup.has(value.toLowerCase()));
};

/** Label the Matrix card uses for a score band. Copy is v3's. */
export const scoreLabel = (score: number): string =>
  score >= 90 ? 'Taste twin' : score >= 80 ? 'Strong overlap' : 'Worth a listen';

/** A profile with no signal cannot be scored; guard instead of scoring 0. */
export const hasSignal = (profile: TasteProfile): boolean =>
  magnitude(profile.humor) > 1e-9 || magnitude(profile.music) > 1e-9;