/**
 * Embeddings: turning taxonomy tags into vectors.
 *
 * Every provider (manual chips, Last.fm, Apple Music, Spotify-alpha, the
 * moderation taxonomy) funnels into these functions, so the matching engine
 * never sees provider-specific data. That is the normalised
 * `{artists, genres, tracks}` contract the build brief requires.
 */

import {
  ARTIST_BUCKETS,
  AXIS_BLOCK_WEIGHT,
  GENRES,
  HUMOR_CONTENT,
  HUMOR_DIMS,
  HUMOR_STYLE_AXES,
  HUMOR_STYLES,
  HUMOR_TAG_INDEX,
  MUSIC_BEHAVIOR,
  artistBlockStart,
  behaviorBlockStart,
  isGenre,
  normalizeGenre,
  normalizeHumorTag,
} from './taxonomy';
import {
  type HumorVector,
  type MusicVector,
  magnitude,
  normalize,
  projectSimplex,
  roundVector,
  zeroHumor,
  zeroMusic,
} from './vector';

export interface TasteTags {
  /** Humor style axes, already summing to 1 in a healthy profile. */
  styles?: Partial<Record<string, number>>;
  /** Content families: absurd, deadpan, niche_hobby, ... */
  content?: readonly string[];
  /** Format features: text_post, deep_fried, ... */
  formats?: readonly string[];
}

export interface MusicTags {
  genres?: readonly string[];
  artists?: readonly string[];
  behavior?: Partial<Record<string, number>>;
}

/** What a piece of content looks like once tagged. */
export interface ContentEmbedding {
  humor: HumorVector;
  music: MusicVector;
}

const STYLE_COUNT = HUMOR_STYLES.length;
const CONTENT_COUNT = HUMOR_CONTENT.length;
const GENRE_COUNT = GENRES.length;
const CONTENT_START = STYLE_COUNT;
const FORMAT_START = CONTENT_START + CONTENT_COUNT;

/**
 * The profile's humor style, as a distribution over the four HSQ axes. This is
 * what the Fingerprint shows and what `humor_style` stores, and it is always a
 * valid distribution regardless of what the events did to the vector.
 */
export const humorAxes = (vector: readonly number[]): number[] =>
  projectSimplex(vector.slice(0, HUMOR_STYLE_AXES) as number[]);

/**
 * Writes the weighted axis block back into a humor vector. Applying this before
 * the final normalise is what keeps the vector unit length *and* the axes a
 * proper distribution at the same time.
 */
const applyAxisBlock = (vector: number[]): number[] => {
  const axes = projectSimplex(vector.slice(0, HUMOR_STYLE_AXES));
  for (let i = 0; i < HUMOR_STYLE_AXES; i++) vector[i] = (axes[i] ?? 0) * AXIS_BLOCK_WEIGHT;
  return vector;
};

/**
 * A meme's style vector: 1.0 on every tag it carries, then a gentle lift on the
 * non-style block so a one-tag meme still carries real weight in a 32-d cosine.
 */
export const memeStyleVector = (meme: {
  tags?: readonly string[];
  styles?: readonly string[];
}): HumorVector => {
  const vector = zeroHumor();
  let tagged = 0;

  for (const raw of meme.tags ?? []) {
    const tag = normalizeHumorTag(raw);
    if (!tag) continue;
    const index = HUMOR_TAG_INDEX[tag];
    if (index === undefined) continue;
    vector[index] = 1;
    tagged += 1;
  }

  if (!tagged) return vector;

  const axes = meme.styles?.length
    ? projectSimplex(meme.styles.map((style) => (normalizeHumorTag(style) ? 1 : 0)))
    : inferAxesFromContent(vector);
  for (let i = 0; i < STYLE_COUNT; i++) vector[i] = axes[i] ?? 0;

  // A meme is tagged sparsely; lift the taxonomy block so one tag still carries
  // real weight against a profile that has thirty dims populated.
  for (let i = STYLE_COUNT; i < HUMOR_DIMS; i++) vector[i] *= 1.15;
  return roundVector(normalize(applyAxisBlock(vector)));
};

/** Content families imply a humor style; used when a meme lists no explicit axis. */
const inferAxesFromContent = (vector: HumorVector): number[] => {
  const implied = new Array<number>(STYLE_COUNT).fill(0);
  const at = (tag: string) => {
    const index = HUMOR_TAG_INDEX[tag as keyof typeof HUMOR_TAG_INDEX];
    return index === undefined ? 0 : vector[index];
  };
  implied[0] = at('wholesome') + 0.5 * at('relatable') + 0.4 * at('observational');
  implied[1] = at('stonks') + 0.5 * at('hyperbole') + 0.5 * at('edgelord');
  implied[2] = at('dark') + 0.6 * at('edgelord') + 0.4 * at('boomer');
  implied[3] = at('absurd') + 0.7 * at('relatable') + 0.5 * at('romance_disaster');
  return projectSimplex(implied);
};

/** A track's music embedding: genres, hashed artist buckets, behaviour. */
export const trackEmbedding = (track: {
  title?: string;
  artist?: string;
  genres?: readonly string[];
  behavior?: Partial<Record<string, number>>;
}): MusicVector => {
  const vector = zeroMusic();

  for (const raw of track.genres ?? []) {
    const genre = normalizeGenre(raw);
    if (genre) vector[GENRES.indexOf(genre)] = 1;
  }

  if (track.artist) {
    vector[artistBlockStart + artistBucket(track.artist)] = 1;
    for (const collaborator of collaboratorsOf(track.title ?? '')) {
      const slot = artistBlockStart + artistBucket(collaborator);
      vector[slot] = Math.min(1, vector[slot] + 0.6);
    }
  }

  for (const [key, value] of Object.entries(track.behavior ?? {})) {
    const index = (MUSIC_BEHAVIOR as readonly string[]).indexOf(key);
    if (index >= 0 && typeof value === 'number' && Number.isFinite(value)) {
      vector[behaviorBlockStart + index] = Math.max(0, value);
    }
  }

  return roundVector(normalize(vector));
};

const artistBucketCache = new Map<string, number>();

const artistBucket = (artist: string): number => {
  const key = artist.toLowerCase().trim();
  const hit = artistBucketCache.get(key);
  if (hit !== undefined) return hit;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (h >>> 0) % ARTIST_BUCKETS;
  artistBucketCache.set(key, bucket);
  return bucket;
};

/** "Artist A & Artist B" / "A, B" / "A feat. B" -> extra credited artists. */
const collaboratorsOf = (title: string): string[] =>
  title
    .split(/\s(?:feat|ft|with|&|,|and|x)\.?\s/i)
    .slice(1)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length < 40);

/**
 * A whole taste profile -> the two vectors the Resonance Engine compares.
 * Onboarding, imports and re-calibration all go through here so they agree.
 */
export const tasteEmbeddings = (taste: {
  humor: TasteTags;
  music: MusicTags;
}): ContentEmbedding => ({
  humor: roundVector(tasteHumorVector(taste.humor)),
  music: roundVector(tasteMusicVector(taste.music)),
});

export const tasteHumorVector = (taste: TasteTags): HumorVector => {
  const vector = zeroHumor();

  const rawAxes = new Array<number>(STYLE_COUNT).fill(0);
  for (let i = 0; i < STYLE_COUNT; i++) {
    const value = taste.styles?.[HUMOR_STYLES[i]];
    rawAxes[i] = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  const hasStyles = magnitude(rawAxes) > 1e-9;
  for (let i = 0; i < STYLE_COUNT; i++) vector[i] = hasStyles ? (rawAxes[i] ?? 0) : 0;

  for (const raw of taste.content ?? []) {
    const index = contentIndex(raw);
    if (index >= 0) vector[index] += 1;
  }
  for (const raw of taste.formats ?? []) {
    const index = formatIndex(raw);
    if (index >= 0) vector[index] += 1;
  }

  const hasTaxonomy = magnitude(vector) > 1e-9;
  // No taste given at all means no signal. Fabricating a default axis
  // distribution here would make two brand-new profiles look identical and
  // match each other on nothing.
  if (!hasTaxonomy) return roundVector(vector);

  // With taxonomy signal but no explicit axes, infer a readable distribution
  // from the content families rather than inventing one.
  if (!hasStyles) for (let i = 0; i < STYLE_COUNT; i++) vector[i] = inferAxesFromContent(vector)[i] ?? 0;

  return roundVector(normalize(applyAxisBlock(vector)));
};

export const tasteMusicVector = (taste: MusicTags): MusicVector => {
  const vector = zeroMusic();

  for (const raw of taste.genres ?? []) {
    const genre = isGenre(raw) ? raw : normalizeGenre(raw);
    if (genre) vector[GENRES.indexOf(genre)] += 1;
  }

  for (const artist of taste.artists ?? []) {
    if (typeof artist !== 'string' || !artist.trim()) continue;
    vector[artistBlockStart + artistBucket(artist)] += 1;
  }

  for (const [key, value] of Object.entries(taste.behavior ?? {})) {
    const index = (MUSIC_BEHAVIOR as readonly string[]).indexOf(key);
    if (index >= 0 && typeof value === 'number' && Number.isFinite(value)) {
      vector[behaviorBlockStart + index] = Math.max(0, value);
    }
  }

  if (magnitude(vector) < 1e-9) return roundVector(vector);
  return roundVector(normalize(vector));
};

const contentIndex = (raw: string): number => {
  const tag = normalizeHumorTag(raw);
  if (!tag) return -1;
  const index = HUMOR_TAG_INDEX[tag];
  if (index === undefined || index < CONTENT_START || index >= FORMAT_START) return -1;
  return index;
};

const formatIndex = (raw: string): number => {
  const tag = normalizeHumorTag(raw);
  if (!tag) return -1;
  const index = HUMOR_TAG_INDEX[tag];
  if (index === undefined || index < FORMAT_START || index >= HUMOR_DIMS) return -1;
  return index;
};

export { STYLE_COUNT, CONTENT_COUNT, GENRE_COUNT, applyAxisBlock };