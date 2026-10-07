/**
 * NHIE content pipeline (build brief §8.2).
 *
 *   node --experimental-strip-types scripts/build-nhie.ts
 *
 * Validates `v5Direction/nhie_questions.json` and writes
 * `src/content/nhie.manifest.json`, which the app imports directly.
 *
 * Validation is strict on purpose — the bank is hand-written content and a
 * typo in a category slug would silently drop ten cards from a round:
 *   - ids unique, every question has text + sub + axis + spice
 *   - every `category` matches a declared category slug
 *   - every `axis` is one of the six humor axes
 *   - every `spice` is a declared level
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HUMOR_AXES } from '../src/copy/taxonomy.ts';

const ROOT = process.cwd();
const CONTENT_DIR = process.env.CONTENT_DIR ?? join(ROOT, 'v5Direction');
const SOURCE = join(CONTENT_DIR, 'nhie_questions.json');
const OUT_DIR = join(ROOT, 'src', 'content');
const OUT = join(OUT_DIR, 'nhie.manifest.json');

/** One round is 12 cards; the bank must hold several rounds without repeats. */
export const ROUND_SIZE = 12;

export interface NhieQuestion {
  id: string;
  category: string;
  emoji: string;
  text: string;
  sub: string;
  axis: (typeof HUMOR_AXES)[number];
  spice: number;
}

export interface NhieManifest {
  version: number;
  prefix: string;
  axes: string[];
  categories: { slug: string; name: string }[];
  spiceLegend: Record<string, string>;
  questions: NhieQuestion[];
  /** Rounds available before the bank repeats. */
  rounds: number;
}

interface RawBank {
  version?: number;
  prefix?: string;
  axes?: string[];
  spice_legend?: Record<string, string>;
  categories?: { slug: string; name: string }[];
  questions?: NhieQuestion[];
}

export const validateBank = (raw: RawBank): NhieManifest => {
  const questions = raw.questions ?? [];
  const categories = raw.categories ?? [];
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const spiceLevels = new Set(Object.keys(raw.spice_legend ?? {}));
  const errors: string[] = [];

  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id) errors.push('a question is missing an id');
    else if (ids.has(question.id)) errors.push(`duplicate id ${question.id}`);
    else ids.add(question.id);

    if (!question.text?.trim()) errors.push(`${question.id}: empty text`);
    if (!question.sub?.trim()) errors.push(`${question.id}: empty sub`);
    if (!categorySlugs.has(question.category)) errors.push(`${question.id}: unknown category "${question.category}"`);
    if (!HUMOR_AXES.includes(question.axis)) errors.push(`${question.id}: unknown axis "${question.axis}"`);
    if (!spiceLevels.has(String(question.spice))) errors.push(`${question.id}: unknown spice ${question.spice}`);
  }

  if (errors.length) throw new Error(`nhie_questions.json is invalid:\n  ${errors.join('\n  ')}`);
  if (questions.length < ROUND_SIZE) {
    throw new Error(`nhie_questions.json needs at least ${ROUND_SIZE} questions for one round; found ${questions.length}`);
  }

  return {
    version: raw.version ?? 1,
    prefix: raw.prefix ?? 'Never have I ever',
    axes: raw.axes ?? [...HUMOR_AXES],
    categories,
    spiceLegend: raw.spice_legend ?? {},
    questions,
    rounds: Math.floor(questions.length / ROUND_SIZE),
  };
};

/**
 * Picks 12 cards for a round: filtered by category and spice, minus anything
 * already asked, with no repeats until the filtered bank is exhausted.
 *
 * Deterministic for a given seed so a shared friend-mode link deals the same
 * twelve cards to both players.
 */
export const pickRound = (
  bank: NhieManifest,
  options: { asked?: readonly string[]; categories?: readonly string[]; maxSpice?: number; seed?: number } = {},
): { questions: NhieQuestion[]; bankExhausted: boolean } => {
  const asked = new Set(options.asked ?? []);
  const pool = bank.questions.filter((question) => {
    if (options.categories?.length && !options.categories.includes(question.category)) return false;
    if (options.maxSpice !== undefined && question.spice > options.maxSpice) return false;
    return true;
  });

  let available = pool.filter((question) => !asked.has(question.id));
  let exhausted = false;
  if (available.length < ROUND_SIZE) {
    // The filtered bank ran out: start it over rather than repeating inside a
    // round, and tell the caller so the UI can say the bank was exhausted.
    exhausted = true;
    available = pool;
  }

  let a = (options.seed ?? 0x9e3779b9) >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Fisher–Yates on a copy, then take the first ROUND_SIZE.
  const deck = [...available];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return { questions: deck.slice(0, ROUND_SIZE), bankExhausted: exhausted };
};

/** Card text as the UI shows it: `prefix + text`. */
export const cardText = (bank: NhieManifest, question: NhieQuestion): string =>
  `${bank.prefix}${question.text.startsWith('…') ? question.text : `… ${question.text}`}`;

const main = (): void => {
  const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as RawBank;
  const manifest = validateBank(raw);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `wrote ${relative(ROOT, OUT)} — ${manifest.questions.length} questions, ` +
      `${manifest.categories.length} categories, ${manifest.rounds} full rounds\n`,
  );
};

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
