/**
 * Runtime helpers for the NHIE bank (build brief §8.2).
 *
 * These live in `src/content` rather than in the pipeline so the app never
 * imports from `scripts/`. `scripts/build-nhie.ts` re-exports them, so there is
 * one definition and two consumers — the same arrangement as `types.ts`.
 */

import { nhie } from './index.ts';
import type { NhieManifest, NhieQuestion } from './types.ts';

/** One round is 12 cards; the bank holds eight rounds before it repeats. */
export const ROUND_SIZE = 12;

export const roundCount = (bank: NhieManifest = nhie): number =>
  Math.floor(bank.questions.length / ROUND_SIZE);

export interface PickRoundOptions {
  asked?: readonly string[];
  categories?: readonly string[];
  maxSpice?: number;
  /** Fixed seed, so a shared friend-mode link deals the same twelve cards. */
  seed?: number;
}

export interface Round {
  questions: NhieQuestion[];
  /** True when the filtered pool ran out and had to restart. */
  bankExhausted: boolean;
}

/** Deterministic PRNG — same seed, same round, on any device. */
const prng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Picks twelve cards: filtered by category and spice, minus anything already
 * asked, with no repeats until the filtered bank is exhausted.
 *
 * When the filtered pool runs dry it restarts rather than repeating inside a
 * round, and says so, so the UI can tell the user the bank was exhausted
 * instead of quietly dealing a card they just saw.
 */
export const pickRound = (bank: NhieManifest = nhie, options: PickRoundOptions = {}): Round => {
  const asked = new Set(options.asked ?? []);
  const pool = bank.questions.filter((question) => {
    if (options.categories?.length && !options.categories.includes(question.category)) return false;
    if (options.maxSpice !== undefined && question.spice > options.maxSpice) return false;
    return true;
  });

  let available = pool.filter((question) => !asked.has(question.id));
  let bankExhausted = false;
  if (available.length < ROUND_SIZE) {
    bankExhausted = true;
    available = pool;
  }

  const random = prng(options.seed ?? 0x9e3779b9);

  // Fisher–Yates on a copy, then take the first ROUND_SIZE.
  const deck = [...available];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return { questions: deck.slice(0, ROUND_SIZE), bankExhausted };
};

/** Card text as the UI shows it: the bank's prefix plus the question. */
export const cardText = (question: NhieQuestion, bank: NhieManifest = nhie): string =>
  `${bank.prefix}${question.text.startsWith('…') ? question.text : `… ${question.text}`}`;

/** Spice level name, straight from the bank's own legend. */
export const spiceLabel = (question: NhieQuestion, bank: NhieManifest = nhie): string =>
  bank.spiceLegend[String(question.spice)] ?? '';
