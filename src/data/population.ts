/**
 * The offline candidate population.
 *
 * These are not hard-coded scores. Each person gets a deterministic taste built
 * from the same taxonomy the real engine uses, so the Match Matrix ranking you
 * see offline is a genuine Taste Twins computation over real vectors. Swap in
 * `SupabaseRepo` and the same query runs over Postgres.
 *
 * Everything here is deterministic: the same seed always produces the same
 * people, which is what makes the engine tests reproducible.
 */

import { HUMOR_CONTENT, HUMOR_FORMATS, HUMOR_STYLES, GENRES, type Genre } from '../lib/matching/taxonomy';
import { tasteHumorVector, tasteMusicVector } from '../lib/matching/embed';
import { roundVector } from '../lib/matching/vector';
import type { Candidate, Mode } from '../lib/matching/candidates';
import { SEED_ARTISTS } from './seed/tracks';

/** Mulberry32: same seeded stream in Node, the browser and the test runner. */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const pick = <T>(random: () => number, pool: readonly T[], count: number): T[] => {
  const copy = [...pool];
  const out: T[] = [];
  for (let i = 0; i < count && copy.length; i++) {
    const index = Math.floor(random() * copy.length);
    out.push(copy.splice(index, 1)[0]);
  }
  return out;
};

const NAMES = [
  'Ines', 'Kai', 'Dev', 'Noor', 'Saoirse', 'Mateo', 'Wren', 'Idris', 'Lena', 'Sol',
  'Priya', 'Omar', 'Mara', 'Jo', 'Theo', 'Nina', 'Zaid', 'Bea', 'Rafa', 'Yuki',
  'Cleo', 'Milo', 'Ada', 'Tomas', 'Esme', 'Hugo', 'Iris', 'Levi', 'Nour', 'Sana',
  'Bram', 'Kit', 'Ola', 'Rune', 'Talia', 'Moss', 'Juno', 'Casper', 'Eden', 'Flynn',
  'Anouk', 'Bodhi', 'Cora', 'Dara', 'Ellis', 'Frida', 'Gus', 'Halle', 'Indra', 'Jonas',
] as const;

const BIOS = [
  'Keeps a spreadsheet of songs that make them want to leave the party.',
  'Will defend one questionable album forever.',
  'Commute DJ. Has been asked to stop.',
  'Makes playlists for weather that has not happened yet.',
  'Explains the lore of a song they heard once on a bus.',
  'Responsible for three of your saved songs.',
  'Nostalgic for decades they were not alive for.',
  'Deadpan in three languages.',
  'Thinks every road trip needs an official opening track.',
  'Sends voice notes that are just the chorus, over and over.',
  'Has a rule about the bridge. You will hear about the bridge.',
  'Cooks one meal well and eleven meals adequately.',
  'Runs a tiny zine about local buses and is not afraid to admit it.',
  'Can name the venue, the year and the weather of a show they attended once.',
  'Believes every bad mood deserves a specific tempo.',
  'Has never once recommended a song without warning you first.',
  'Two playlists only. One for the gym, one for everything else.',
  'Types in lowercase because caps feel like too much effort at 2am.',
] as const;

const CITIES = ['Lisbon', 'Porto', 'Berlin', 'Rotterdam'] as const;

/** Deliberately uneven, so the pacing guardrail has something to do. */
const GENDER_MIX: ReadonlyArray<readonly [string, number]> = [
  ['woman', 0.44],
  ['man', 0.47],
  ['nonbinary', 0.09],
];

const MODES: ReadonlyArray<readonly Mode[]> = [
  ['dating', 'friends'],
  ['friends'],
  ['dating'],
  ['dating', 'friends', 'both'],
];

/**
 * Builds the offline population. `now` is injected so tests are time-stable.
 */
export const buildPopulation = (now: number, size = 48): Candidate[] => {
  const out: Candidate[] = [];
  for (let i = 0; i < size; i++) {
    const name = NAMES[i % NAMES.length] as string;
    const userId = `u_${name.toLowerCase().replace(/[^a-z]/g, '')}_${i}`;
    const random = seededRandom(hashString(`${userId}:population`));

    // Humor: 3-6 content families, 2-3 formats, 2-3 style axes.
    const content = pick(random, HUMOR_CONTENT, 3 + Math.floor(random() * 4));
    const formats = pick(random, HUMOR_FORMATS, 2 + Math.floor(random() * 2));
    const styles = pick(random, HUMOR_STYLES, 2 + Math.floor(random() * 2));
    const styleWeights: Record<string, number> = {};
    for (const style of styles) styleWeights[style] = 0.3 + random() * 0.7;

    // Music: 2-5 genres and 3-7 artists.
    const genres = pick(random, GENRES, 2 + Math.floor(random() * 4)) as Genre[];
    const artists = pick(random, SEED_ARTISTS, 3 + Math.floor(random() * 5));

    // Newer accounts have fewer events; the freshness boost keys off this.
    const isNew = random() < 0.25;
    const eventCount = isNew ? 4 + Math.floor(random() * 16) : 40 + Math.floor(random() * 360);

    const gender = pickGender(random, i);

    out.push({
      userId,
      displayName: name,
      age: 21 + Math.floor(random() * 16),
      city: CITIES[Math.floor(random() * CITIES.length)] as string,
      distanceKm: Number((0.4 + random() * 34).toFixed(1)),
      gender,
      lookingFor: MODES[Math.floor(random() * MODES.length)] as readonly Mode[],
      photoChecked: random() > 0.06,
      onboarded: true,
      deletedAt: null,
      deactivatedAt: null,
      lastActiveAt: now - Math.floor(random() * 26) * 24 * 60 * 60 * 1000,
      eventCount,
      humor: roundVector(tasteHumorVector({ content, formats, styles: styleWeights })),
      music: roundVector(tasteMusicVector({ genres, artists })),
      topArtists: artists,
      topGenres: genres,
      topCategories: content,
      antiGenres: [],
      vibeReported: [],
      bio: BIOS[Math.floor(random() * BIOS.length)] as string,
    });
  }
  return out;
};

/** Deterministic assignment that reproduces the intended ratio exactly. */
const pickGender = (random: () => number, index: number): string => {
  const slot = (index * 0.618033988749895) % 1;
  let cumulative = 0;
  for (const [gender, share] of GENDER_MIX) {
    cumulative += share;
    if (slot < cumulative) return gender;
  }
  return GENDER_MIX[GENDER_MIX.length - 1][0];
};

/**
 * A handful of people in the population who already resonate with the shipped
 * demo profile (Deadpan / Niche refs / Dry wit, indie + dream pop). They exist
 * so a fresh offline install has a deck that is not empty; they are ranked by
 * the engine like everyone else.
 */
export const SEED_MATCH_IDS = ['u_ines_0', 'u_kai_1', 'u_dev_2', 'u_noor_3', 'u_saoirse_4'] as const;