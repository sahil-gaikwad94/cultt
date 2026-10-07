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

/* One definition, two consumers: the runtime helpers live in src/content so
   the app never imports from scripts/. Re-exported here for the script's own
   callers and for the tests. */
export { ROUND_SIZE, cardText, pickRound, roundCount, spiceLabel } from '../src/content/nhie.ts';
export type { PickRoundOptions, Round } from '../src/content/nhie.ts';
import { ROUND_SIZE } from '../src/content/nhie.ts';

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
