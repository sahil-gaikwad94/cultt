/**
 * Incremental vector updates.
 *
 * The architecture PDF (§6.2) specified:
 *   humor_vec := normalize(0.995 * humor_vec + w * meme.style_vec)
 *   music_vec := normalize(0.997 * music_vec + w * track.embedding)
 *
 * That rule has five defects that matter at launch. The corrected rule below
 * fixes each one; see DECISIONS.md for the full write-up.
 *
 *  1. One `w` for both blocks means reacting to a meme needs a track embedding.
 *     Fix: an event names a domain and only moves that domain's block.
 *  2. The 4 humor style axes are a probability distribution but are decayed,
 *     blended and cosine-compared as if they were magnitudes, so they drift
 *     negative and "renormalize axes from dims 0-3" produces noise.
 *     Fix: the axes are re-projected onto the simplex after every event, and
 *     they only ever receive the target's style contribution.
 *  3. normalize() of a near-zero vector amplifies float noise. A long run of
 *     meh/skip events (w = -0.6, -0.2) can drive the vector to zero.
 *     Fix: guarded normalization that falls back to the target vector.
 *  4. Negative weights are unbounded, so one bad event can flip a profile.
 *     Fix: weights clamp to [-1, 2].
 *  5. Anti-genres were only a scoring penalty, so the disliked genre stayed in
 *     the vector and kept matching.
 *     Fix: anti-genres subtract from the genre block directly, with a floor so
 *     accumulated dislikes can never invert a user's genuine taste.
 */

import { GENRES, GENRE_COUNT, normalizeGenre } from './taxonomy';
import type { Genre } from './taxonomy';
import { type HumorVector, type MusicVector, normalize, projectSimplex, roundVector, zeroHumor, zeroMusic } from './vector';

export type EventKind =
  | 'laugh'
  | 'like'
  | 'skip'
  | 'save'
  | 'share'
  | 'meh'
  | 'duel'
  | 'co_listen'
  | 'drop_react';

export type EventDomain = 'humor' | 'music' | 'both';

export interface ContentEvent {
  kind: EventKind;
  domain: EventDomain;
  weight: number;
  /** The Daily Drop multiplier: reacting to the drop counts 1.5x. */
  dailyDrop?: boolean;
}

/** Event weights from PDF §6.2, kept verbatim. */
export const EVENT_WEIGHTS: Readonly<Record<EventKind, number>> = Object.freeze({
  laugh: 1.0,
  like: 1.0,
  save: 1.2,
  share: 1.5,
  meh: -0.6,
  skip: -0.2,
  duel: 2.0,
  co_listen: 1.8,
  drop_react: 1.0,
});

export const DAILY_DROP_MULTIPLIER = 1.5;
export const HUMOR_DECAY = 0.995;
export const MUSIC_DECAY = 0.997;
/** Weights outside this band are clamped: one event must not flip a profile. */
export const MIN_WEIGHT = -1;
export const MAX_WEIGHT = 2;
/** Anti-genres move the genre block by at most this much per event. */
export const MAX_ANTI_GENRE_SHIFT = 0.08;
/** Anti-genre subtraction stops here so dislikes can never invert real taste. */
export const ANTI_GENRE_FLOOR = 0.08;

export const eventFor = (kind: EventKind, domain: EventDomain, dailyDrop = false): ContentEvent => ({
  kind,
  domain,
  weight: EVENT_WEIGHTS[kind] * (dailyDrop ? DAILY_DROP_MULTIPLIER : 1),
  dailyDrop,
});

export const effectiveWeight = (weight: number): number =>
  Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Number.isFinite(weight) ? weight : 0));

/** The flavor a reaction moves for a given piece of content. */
export const domainOf = (content: 'meme' | 'track'): EventDomain =>
  content === 'meme' ? 'humor' : 'music';

export interface FingerprintVectors {
  humor: HumorVector;
  music: MusicVector;
  /** Increments on every applied event; drives the calibration ramp. */
  eventCount: number;
  vectorVersion: number;
}

export const emptyFingerprint = (): FingerprintVectors => ({
  humor: zeroHumor(),
  music: zeroMusic(),
  eventCount: 0,
  vectorVersion: 1,
});

export interface ApplyEventInput {
  fingerprint: FingerprintVectors;
  event: ContentEvent;
  /** Meme style vector when the event touches humor. */
  humorVector?: HumorVector;
  /** Track embedding when the event touches music. */
  musicVector?: MusicVector;
  /** Genres the user has explicitly blocked; subtracted from the music block. */
  antiGenres?: readonly string[];
}

export interface ApplyEventResult {
  fingerprint: FingerprintVectors;
  applied: boolean;
  weight: number;
}

/**
 * Applies one event. Pure: it returns a new fingerprint and never mutates the
 * input, so the same event can be replayed in tests and in the SQL mirror.
 */
export const applyEvent = (input: ApplyEventInput): ApplyEventResult => {
  const { fingerprint, event } = input;
  const weight = effectiveWeight(event.weight);
  const next: FingerprintVectors = {
    humor: fingerprint.humor.slice(),
    music: fingerprint.music.slice(),
    eventCount: fingerprint.eventCount + 1,
    vectorVersion: fingerprint.vectorVersion + 1,
  };

  let applied = false;

  if ((event.domain === 'humor' || event.domain === 'both') && input.humorVector) {
    next.humor = updateHumor(next.humor, input.humorVector, weight);
    applied = true;
  }

  if ((event.domain === 'music' || event.domain === 'both') && input.musicVector) {
    next.music = updateMusic(next.music, input.musicVector, weight);
    applied = true;
  }

  if (input.antiGenres?.length) {
    next.music = applyAntiGenres(next.music, input.antiGenres, Math.abs(weight));
    applied = true;
  }

  return { fingerprint: roundFingerprint(next), applied, weight };
};

const roundFingerprint = (fingerprint: FingerprintVectors): FingerprintVectors => ({
  humor: roundVector(fingerprint.humor),
  music: roundVector(fingerprint.music),
  eventCount: fingerprint.eventCount,
  vectorVersion: fingerprint.vectorVersion,
});

/** Humor update: decay, blend, then force the style axes back onto the simplex. */
export const updateHumor = (current: HumorVector, target: HumorVector, weight: number): HumorVector => {
  const blended = current.map((value, i) => HUMOR_DECAY * value + weight * (target[i] ?? 0));
  const out = normalize(blended, target);
  const axes = projectSimplex(out.slice(0, STYLE_AXIS_COUNT), target.slice(0, STYLE_AXIS_COUNT));
  for (let i = 0; i < STYLE_AXIS_COUNT; i++) out[i] = axes[i];
  return out;
};

const STYLE_AXIS_COUNT = 4;

/** Music update: decay and blend, then a full renormalise. */
export const updateMusic = (current: MusicVector, target: MusicVector, weight: number): MusicVector =>
  normalize(
    current.map((value, i) => MUSIC_DECAY * value + weight * (target[i] ?? 0)),
    target,
  );

/**
 * Anti-genre subtraction.
 *
 * Dislikes are first-class: a blocked genre leaves the music vector instead of
 * only costing points at scoring time. The shift is bounded per call and floored
 * so a long history of dislikes can push a dim down but never through zero.
 */
export const applyAntiGenres = (
  current: MusicVector,
  antiGenres: readonly string[],
  magnitudeScale = 1,
): MusicVector => {
  const indices = new Set<number>();
  for (const raw of antiGenres) {
    const genre: Genre | null = normalizeGenre(raw);
    if (genre) indices.add(GENRES.indexOf(genre));
  }
  if (!indices.size) return current.slice();

  const scale = Math.min(1, Math.max(0, magnitudeScale));
  const out = current.slice();
  for (const index of indices) {
    const target = out[index] - MAX_ANTI_GENRE_SHIFT * scale;
    out[index] = Math.max(ANTI_GENRE_FLOOR * out[index], target);
  }
  for (let i = GENRE_COUNT; i < out.length; i++) out[i] = Math.max(0, out[i]);
  return normalize(out, current);
};

/**
 * Replays a whole event log onto a fresh fingerprint. Onboarding and
 * re-calibration use this so a wipe-and-rebuild is reproducible.
 */
export const replayEvents = (
  events: readonly ApplyEventInput[],
  seed: FingerprintVectors = emptyFingerprint(),
): FingerprintVectors =>
  events.reduce<FingerprintVectors>(
    (fingerprint, event) => applyEvent({ ...event, fingerprint }).fingerprint,
    seed,
  );

/** Real rebuild of the humor vector: discards history and starts from the tags. */
export const rebuildFromTaste = (
  seed: FingerprintVectors,
  humor: HumorVector,
  music: MusicVector,
): FingerprintVectors => ({
  humor: roundVector(normalize(humor)),
  music: roundVector(normalize(music)),
  eventCount: seed.eventCount,
  vectorVersion: seed.vectorVersion + 1,
});