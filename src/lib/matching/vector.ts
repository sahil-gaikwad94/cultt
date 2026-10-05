/**
 * Vector primitives for the Resonance Engine.
 *
 * Everything here is deterministic and dependency-free so the exact same code
 * runs in the browser, in unit tests, and in the plpgsql mirror that lives in
 * supabase/migrations/0004_rpc.sql.
 */

import { HUMOR_DIMS, MUSIC_DIMS } from './taxonomy';

export type HumorVector = number[];
export type MusicVector = number[];

/** Below this magnitude a vector carries no direction and normalizing would amplify noise. */
export const EPSILON = 1e-9;

export const zeroHumor = (): HumorVector => new Array<number>(HUMOR_DIMS).fill(0);
export const zeroMusic = (): MusicVector => new Array<number>(MUSIC_DIMS).fill(0);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const dot = (a: number[], b: number[]): number => {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
};

export const magnitude = (v: number[]): number => Math.sqrt(dot(v, v));

/** Scales a vector in place and returns it; callers pass owned copies. */
export const scale = (v: number[], factor: number): number[] => {
  for (let i = 0; i < v.length; i++) v[i] *= factor;
  return v;
};

/**
 * Unit-length projection with a zero guard.
 * `fallback` is used when the input has no direction, which is the case on a
 * brand-new profile and after a long run of negative (meh/skip) events.
 */
export const normalize = (v: number[], fallback?: number[]): number[] => {
  const mag = magnitude(v);
  if (!Number.isFinite(mag) || mag < EPSILON) {
    const fb = fallback ?? zeroOfLength(v.length);
    const fbMag = magnitude(fb);
    return fbMag < EPSILON ? fb.slice() : scale(fb.slice(), 1 / fbMag);
  }
  return scale(v.slice(), 1 / mag);
};

/** Cosine similarity mapped to [-1, 1]. Zero vectors yield 0, never NaN. */
export const cosine = (a: number[], b: number[]): number => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA < EPSILON || magB < EPSILON) return 0;
  const value = dot(a, b) / (magA * magB);
  return Number.isFinite(value) ? clamp(value, -1, 1) : 0;
};

/** Jaccard index over two small sets; empty-vs-empty is 0, not NaN. */
export const jaccard = <T>(a: readonly T[], b: readonly T[]): number => {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const value of a) if (setB.has(value)) intersection += 1;
  const union = a.length + b.length - intersection;
  return union === 0 ? 0 : intersection / union;
};

/** Fraction of `pool` that appears in `anti` (0 when the pool is empty). */
export const overlapFraction = (pool: readonly string[], anti: readonly string[]): number => {
  if (!pool.length || !anti.length) return 0;
  const blocked = new Set(anti.map((value) => value.toLowerCase()));
  let hits = 0;
  for (const value of pool) if (blocked.has(value.toLowerCase())) hits += 1;
  return hits / pool.length;
};

/** Sigmoid used by the Taste Twins curve. */
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Projection onto the probability simplex: clamps to [0, 1] then rescales so
 * the entries sum to 1. A zero-sum input falls back to an even distribution
 * rather than dividing by zero. The 4 humor style axes live on this simplex.
 */
export const projectSimplex = (values: number[], fallback?: number[]): number[] => {
  const clamped = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const sum = clamped.reduce((total, value) => total + value, 0);
  if (sum < EPSILON) {
    const fb = fallback ?? clamped.map(() => 1 / clamped.length);
    const fbSum = fb.reduce((total, value) => total + Math.max(0, value), 0);
    if (fbSum < EPSILON) return clamped.map(() => 1 / clamped.length);
    return fb.map((value) => Math.max(0, value) / fbSum);
  }
  return clamped.map((value) => value / sum);
};

/** Sums a slice of a vector. */
export const blockSum = (v: number[], start: number, length: number): number => {
  let sum = 0;
  for (let i = start; i < start + length && i < v.length; i++) sum += v[i];
  return sum;
};

const zeroOfLength = (length: number): number[] => new Array<number>(length).fill(0);

/** Rounds for display/serialisation without changing the stored value's sign. */
export const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const roundVector = (v: number[], digits = 4): number[] => v.map((value) => round(value, digits));

/** Validates a vector coming back from storage or the database. */
export const isUsableVector = (value: unknown, dims: number): value is number[] =>
  Array.isArray(value) &&
  value.length === dims &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));