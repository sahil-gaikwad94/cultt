/**
 * Cultured taste taxonomy.
 *
 * Vector budgets (see DECISIONS.md "vector layout"):
 *   humor: 34-d  = 4 style axes + the 30-category humor taxonomy
 *   music: 48-d  = 24 genres + 16 artist-affinity buckets + 8 behavioural features
 *
 * The 30 categories are the taxonomy the PDF and the build brief both call for:
 * 20 content families plus 10 format/pace features. Format features are
 * categories in their own right (the PDF lists "reaction memes, deep-fried,
 * wholesome-comic, text-post, video-clip" as taxonomy entries), so they share
 * the same block rather than getting a fourth region of the vector.
 */

export const HUMOR_DIMS = 34;
export const MUSIC_DIMS = 48;

/* ------------------------------------------------------------------ humor */

/** Humor Styles Questionnaire axes. Dims 0-3. */
export const HUMOR_STYLES = [
  'affiliative',
  'self_enhancing',
  'aggressive',
  'self_defeating',
] as const;
export type HumorStyle = (typeof HUMOR_STYLES)[number];

/** Content families. Dims 4-23 (20 of the 30 categories). */
export const HUMOR_CONTENT = [
  'absurd',
  'deadpan',
  'wholesome',
  'dark',
  'surreal',
  'relatable',
  'niche_hobby',
  'wordplay',
  'anti_humor',
  'meta',
  'observational',
  'hyperbole',
  'cringe_irony',
  'boomer',
  'edgelord',
  'work_horror',
  'money_pain',
  'romance_disaster',
  'gaming',
  'pet_energy',
] as const;
export type HumorContent = (typeof HUMOR_CONTENT)[number];

/** Format / pace features. Dims 24-33 (the other 10 categories). */
export const HUMOR_FORMATS = [
  'reaction_meme',
  'deep_fried',
  'wholesome_comic',
  'text_post',
  'two_panel',
  'absurd_surreal',
  'screenshot',
  'stonks',
  'mashup',
  'video_clip',
] as const;
export type HumorFormat = (typeof HUMOR_FORMATS)[number];

export const HUMOR_TAGS = [
  ...HUMOR_STYLES,
  ...HUMOR_CONTENT,
  ...HUMOR_FORMATS,
] as const;
export type HumorTag = (typeof HUMOR_TAGS)[number];

const buildIndex = <T extends string>(values: readonly T[]): Readonly<Record<T, number>> =>
  Object.freeze(
    values.reduce<Record<string, number>>((acc, value, i) => {
      acc[value] = i;
      return acc;
    }, {}) as Record<T, number>,
  );

export const HUMOR_TAG_INDEX: Readonly<Record<HumorTag, number>> = buildIndex(HUMOR_TAGS);

/** User-facing labels for culture tabs, chips and the Taste Card. */
export const HUMOR_TOPICS: Readonly<Record<string, string>> = Object.freeze({
  absurd: 'Absurd',
  deadpan: 'Deadpan',
  wholesome: 'Wholesome',
  dark: 'Dark',
  surreal: 'Surreal',
  relatable: 'Relatable',
  niche_hobby: 'Niche hobby',
  wordplay: 'Wordplay',
  'anti-humor': 'Anti-humor',
  meta: 'Meta',
  observational: 'Observational',
  hyperbole: 'Hyperbole',
  'cringe-irony': 'Cringe irony',
  boomer: 'Boomer',
  edgelord: 'Edgelord',
  'work-horror': 'Work horror',
  'money-pain': 'Money pain',
  'romance-disaster': 'Romance disaster',
});

/** Taxonomy id -> label, used wherever a dim is shown as a chip. */
export const HUMOR_LABELS: Readonly<Record<HumorTag, string>> = Object.freeze({
  affiliative: 'Affiliative',
  self_enhancing: 'Self-enhancing',
  aggressive: 'Aggressive',
  self_defeating: 'Self-defeating',
  absurd: 'Absurd',
  deadpan: 'Deadpan',
  wholesome: 'Wholesome',
  dark: 'Dark',
  surreal: 'Surreal',
  relatable: 'Relatable',
  niche_hobby: 'Niche hobby',
  wordplay: 'Wordplay',
  anti_humor: 'Anti-humor',
  meta: 'Meta',
  observational: 'Observational',
  hyperbole: 'Hyperbole',
  cringe_irony: 'Cringe irony',
  boomer: 'Boomer',
  edgelord: 'Edgelord',
  work_horror: 'Work horror',
  money_pain: 'Money pain',
  romance_disaster: 'Romance disaster',
  gaming: 'Gaming',
  pet_energy: 'Pet energy',
  reaction_meme: 'Reaction meme',
  deep_fried: 'Deep-fried',
  wholesome_comic: 'Wholesome comic',
  text_post: 'Text post',
  two_panel: 'Two-panel',
  absurd_surreal: 'Absurd surreal',
  screenshot: 'Screenshot',
  stonks: 'Stonks',
  mashup: 'Mashup',
  video_clip: 'Video clip',
});

/** Culture Feed tabs. Keys are taxonomy ids, values are the copy v3 shipped. */
export const MEME_TABS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['all', 'For You'],
  ['work', '9-5 Cyber'],
  ['music', 'Main Character Audio'],
  ['screen', 'Couch Canon'],
  ['life', 'Third Space'],
  ['love', 'Situationship HQ'],
  ['money', 'Ramen Budget'],
]);

/* ------------------------------------------------------------------ music */

/** Genre affinities. Dims 0-23. */
export const GENRES = [
  'indie_rock',
  'dream_pop',
  'hyperpop',
  'shoegaze',
  'bedroom_pop',
  'neo_soul',
  'amapiano',
  'jungle',
  'drum_and_bass',
  'hip_hop',
  'r_and_b',
  'funk',
  'disco',
  'house',
  'techno',
  'ambient',
  'classical',
  'jazz',
  'folk',
  'country',
  'metal',
  'punk',
  'k_pop',
  'latin',
] as const;
export type Genre = (typeof GENRES)[number];

export const GENRE_INDEX: Readonly<Record<Genre, number>> = buildIndex(GENRES);
export const GENRE_COUNT = GENRES.length;

/** Artist affinity is hashed into this many buckets. Dims 24-39. */
export const ARTIST_BUCKETS = 16;

/** Behavioural features derived from listening behaviour. Dims 40-47. */
export const MUSIC_BEHAVIOR = [
  'discovery_appetite',
  'nostalgia_skew',
  'mainstream_index',
  'session_receptivity',
  'repeat_artist_rate',
  'live_attendance',
  'long_tail_dive',
  'playlist_depth',
] as const;
export type MusicBehavior = (typeof MUSIC_BEHAVIOR)[number];

export const GENRE_LABELS: Readonly<Record<Genre, string>> = Object.freeze({
  indie_rock: 'Indie rock',
  dream_pop: 'Dream pop',
  hyperpop: 'Hyperpop',
  shoegaze: 'Shoegaze',
  bedroom_pop: 'Bedroom pop',
  neo_soul: 'Neo-soul',
  amapiano: 'Amapiano',
  jungle: 'Jungle',
  drum_and_bass: 'Drum & bass',
  hip_hop: 'Hip-hop',
  r_and_b: 'R&B',
  funk: 'Funk',
  disco: 'Disco',
  house: 'House',
  techno: 'Techno',
  ambient: 'Ambient',
  classical: 'Classical',
  jazz: 'Jazz',
  folk: 'Folk',
  country: 'Country',
  metal: 'Metal',
  punk: 'Punk',
  k_pop: 'K-pop',
  latin: 'Latin',
});

const GENRE_ALIASES: Readonly<Record<string, Genre>> = Object.freeze({
  rnb: 'r_and_b',
  randb: 'r_and_b',
  r_and_b: 'r_and_b',
  hiphop: 'hip_hop',
  hip_hop: 'hip_hop',
  rap: 'hip_hop',
  kpop: 'k_pop',
  dnb: 'drum_and_bass',
  drum_bass: 'drum_and_bass',
  electronic: 'house',
  edm: 'house',
  indie: 'indie_rock',
  indie_folk: 'folk',
  alt_rock: 'indie_rock',
  post_rock: 'ambient',
  singer_songwriter: 'folk',
  lo_fi: 'bedroom_pop',
  lofi: 'bedroom_pop',
});

/** Normalises loose provider strings ("Neo Soul", "R&B", "drum & bass") onto a taxonomy id. */
export const normalizeGenre = (raw: string): Genre | null => {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (GENRE_ALIASES[key]) return GENRE_ALIASES[key];
  return (GENRES as readonly string[]).includes(key) ? (key as Genre) : null;
};

/* ------------------------------------------------------- vector helpers */

export const humorContentStart = HUMOR_STYLES.length;
export const humorFormatStart = humorContentStart + HUMOR_CONTENT.length;
export const artistBlockStart = GENRES.length;
export const behaviorBlockStart = artistBlockStart + ARTIST_BUCKETS;

/** The four Humor Styles Questionnaire axes that open every humor vector. */
export const HUMOR_STYLE_AXES = HUMOR_STYLES.length;

/**
 * How much of the unit humor vector the style-axis block is allowed to occupy.
 *
 * The axes are a probability distribution (they sum to 1), so they cannot be
 * mixed into a unit-length cosine vector at full scale or the vector stops
 * being unit length. Giving the block a fixed share keeps the axes stable and
 * bounded while leaving the 30 taxonomy dims to do the differentiating work.
 */
export const AXIS_BLOCK_WEIGHT = 0.4;

/** 4 style axes + 30 categories. Asserted so a taxonomy edit cannot drift. */
export const HUMOR_CATEGORY_COUNT = HUMOR_CONTENT.length + HUMOR_FORMATS.length;
if (humorFormatStart + HUMOR_FORMATS.length !== HUMOR_DIMS) {
  throw new Error(`humor taxonomy is ${humorFormatStart + HUMOR_FORMATS.length}-d, expected ${HUMOR_DIMS}`);
}

const artistBucketCache = new Map<string, number>();

/** Deterministic 0-based index inside the artist block (dims 24-39). */
export const artistBucketOf = (artistName: string): number => {
  const key = artistName.toLowerCase().trim();
  const cached = artistBucketCache.get(key);
  if (cached !== undefined) return cached;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (h >>> 0) % ARTIST_BUCKETS;
  artistBucketCache.set(key, bucket);
  return bucket;
};

export const behaviorIndex = (behavior: MusicBehavior): number =>
  behaviorBlockStart + MUSIC_BEHAVIOR.indexOf(behavior);

export const isHumorStyle = (tag: string): tag is HumorStyle =>
  (HUMOR_STYLES as readonly string[]).includes(tag);

export const isHumorContent = (tag: string): tag is HumorContent =>
  (HUMOR_CONTENT as readonly string[]).includes(tag);

export const isHumorFormat = (tag: string): tag is HumorFormat =>
  (HUMOR_FORMATS as readonly string[]).includes(tag);

export const isHumorTag = (tag: string): tag is HumorTag =>
  (HUMOR_TAGS as readonly string[]).includes(tag);

export const isGenre = (raw: string): raw is Genre =>
  (GENRES as readonly string[]).includes(raw);

/** Accepts "anti-humor" from copy and maps it onto the anti_humor dimension. */
export const normalizeHumorTag = (tag: string): HumorTag | null => {
  const key = tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return isHumorTag(key) ? key : null;
};