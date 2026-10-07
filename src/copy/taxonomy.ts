/**
 * Vocabularies from `v5Direction/copy_deck.md`: the 15 meme display
 * categories, the 31 genre slugs and their display names, the six humor axes
 * and the 15 archetypes derived from the top two.
 *
 * These are content, not decoration — the meme pipeline validates its
 * `category` field against `MEME_CATEGORIES`, the song pipeline against
 * `GENRES`, and the Fingerprint reveal against `ARCHETYPES`.
 */

export const HUMOR_AXES = ['deadpan', 'absurdist', 'dry_wit', 'chaotic', 'wholesome', 'niche_refs'] as const;
export type HumorAxis = (typeof HUMOR_AXES)[number];

/** Single-letter codes used by the archetype table. */
export const AXIS_CODE: Record<HumorAxis, string> = {
  deadpan: 'D',
  absurdist: 'A',
  dry_wit: 'W',
  chaotic: 'C',
  wholesome: 'H',
  niche_refs: 'N',
};

export interface MemeCategory {
  slug: string;
  name: string;
  intent: string;
}

export const MEME_CATEGORIES: readonly MemeCategory[] = [
  { slug: 'corporate-hostage', name: 'Corporate Hostage Situation', intent: 'work' },
  { slug: 'dev-tears', name: 'Dev Tears', intent: 'programming / tech' },
  { slug: 'brain-rot', name: 'Brain Rot Reserve', intent: 'absurdist' },
  { slug: 'wholesome-hazmat', name: 'Wholesome Hazmat', intent: 'wholesome' },
  { slug: 'situationship', name: 'Situationship Studies', intent: 'dating' },
  { slug: '3am-philosophy', name: '3 AM Philosophy', intent: 'existential' },
  { slug: 'group-chat-crimes', name: 'Group Chat Crimes', intent: 'social' },
  { slug: 'campus-survival', name: 'Campus Survival', intent: 'college life' },
  { slug: 'pet-court', name: 'Pet Court', intent: 'animals' },
  { slug: 'gym-delusion', name: 'Gym Delusion', intent: 'fitness' },
  { slug: 'kitchen-crimes', name: 'Kitchen Crimes', intent: 'food' },
  { slug: 'cursed-images', name: 'Cursed Images', intent: 'cursed' },
  { slug: 'old-internet', name: 'Old Internet Museum', intent: 'nostalgia' },
  { slug: 'niche-refs', name: 'Niche Reference Club', intent: 'deep cuts' },
  { slug: 'main-character', name: 'Main Character Moments', intent: 'relatable wins' },
];

export const MEME_CATEGORY_SLUGS: readonly string[] = MEME_CATEGORIES.map((c) => c.slug);

export interface Genre {
  slug: string;
  name: string;
}

export const GENRES: readonly Genre[] = [
  { slug: 'pop', name: 'Main Character Pop' },
  { slug: 'indie', name: 'Rainy Window Indie' },
  { slug: 'hiphop', name: 'Bars & Brags' },
  { slug: 'rnb', name: 'Slow Burn' },
  { slug: 'rock', name: 'Air Guitar Hazard' },
  { slug: 'metal', name: 'Mosh Pit Therapy' },
  { slug: 'punk', name: 'Three Chords, Zero Chill' },
  { slug: 'emo', name: 'Eyeliner Era' },
  { slug: 'electronic', name: 'Dancefloor Diplomacy' },
  { slug: 'dnb', name: 'Heartbeat at 174' },
  { slug: 'lofi', name: 'Study Cat Radio' },
  { slug: 'ambient', name: 'Staring at the Ceiling' },
  { slug: 'jazz', name: 'Coffee Shop Intellectual' },
  { slug: 'classical', name: 'Dramatic Entrance' },
  { slug: 'country', name: 'Porch Confessions' },
  { slug: 'folk', name: 'Campfire Feelings' },
  { slug: 'latin', name: 'Dembow Distractions' },
  { slug: 'kpop', name: 'Choreo Brain' },
  { slug: 'citypop', name: 'Neon Drive 1984' },
  { slug: 'bollywood', name: 'Filmi Feelings' },
  { slug: 'afrobeats', name: 'Late Night Lagos' },
  { slug: 'reggae', name: 'Island Time' },
  { slug: 'hyperpop', name: 'Glitchcore Gremlin' },
  { slug: 'synthwave', name: 'Retro Night Drive' },
  { slug: 'sadcore', name: 'Cry in the Shower' },
  { slug: 'workout', name: 'Gym Delusion' },
  { slug: 'showtunes', name: 'Theatre Kid Residue' },
  { slug: 'ost', name: 'Side Quest Soundtrack' },
  { slug: 'phonk', name: 'Drift Brain' },
  { slug: 'soul', name: 'Heart on Vinyl' },
  { slug: 'disco', name: 'Mirror Ball Mandatory' },
];

export const GENRE_SLUGS: readonly string[] = GENRES.map((g) => g.slug);

export const genreName = (slug: string): string => GENRES.find((g) => g.slug === slug)?.name ?? slug;

export const memeCategoryName = (slug: string): string =>
  MEME_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

export interface Archetype {
  /** Two axis codes, e.g. `DA`. */
  code: string;
  name: string;
  line: string;
}

export const ARCHETYPES: readonly Archetype[] = [
  { code: 'DA', name: '3 AM Philosopher', line: 'Existential dread, but make it funny.' },
  { code: 'DW', name: 'Sarcasm Sommelier', line: 'Notes of irony, long finish.' },
  { code: 'DC', name: 'Feral Straight Man', line: 'Flat voice. Unhinged content.' },
  { code: 'DH', name: 'The Soft Deadpan', line: 'Soft heart, flat delivery.' },
  { code: 'DN', name: 'Niche Archivist', line: 'Knows the reference. Knows you don\u2019t.' },
  { code: 'AW', name: 'Surreal Sniper', line: 'Absurd, but precise.' },
  { code: 'AC', name: 'Chaos Goblin', line: 'Treats the group chat like a trampoline.' },
  { code: 'AH', name: 'Absurdist Jester', line: 'Logic left. Joy stayed.' },
  { code: 'AN', name: 'Lore Goblin', line: 'Deep-cut nonsense, lovingly curated.' },
  { code: 'WC', name: 'Group Chat Gremlin', line: 'Fastest reply. Worst timing. Best line.' },
  { code: 'WH', name: 'Pun Raider', line: 'Will pun. Cannot be stopped.' },
  { code: 'WN', name: 'Dry-Wit Detective', line: 'Noticed the joke before it was a joke.' },
  { code: 'CH', name: 'Wholesome Menace', line: 'Sweetest in the room. Plotting something.' },
  { code: 'CN', name: 'Cringe Connoisseur', line: 'Collects the awkward like fine wine.' },
  { code: 'HN', name: 'Cozy Archivist', line: 'Wholesome deep cuts.' },
];

/**
 * Archetype from the top two axes, order-insensitive.
 *
 * Returns null rather than inventing one when fewer than two axes have any
 * weight — the app says nothing instead of guessing (brief rule 6).
 */
export const archetypeFor = (
  axes: Partial<Record<HumorAxis, number>>,
): { archetype: Archetype; axes: [HumorAxis, HumorAxis] } | null => {
  const ranked = HUMOR_AXES.filter((axis) => (axes[axis] ?? 0) > 0)
    .map((axis) => ({ axis, weight: axes[axis] ?? 0 }))
    .sort((a, b) => b.weight - a.weight || HUMOR_AXES.indexOf(a.axis) - HUMOR_AXES.indexOf(b.axis));

  if (ranked.length < 2) return null;
  const [first, second] = ranked;
  const code = `${AXIS_CODE[first.axis]}${AXIS_CODE[second.axis]}`;
  const reversed = `${AXIS_CODE[second.axis]}${AXIS_CODE[first.axis]}`;
  const found = ARCHETYPES.find((a) => a.code === code) ?? ARCHETYPES.find((a) => a.code === reversed);
  if (!found) return null;
  return { archetype: found, axes: [first.axis, second.axis] };
};

/**
 * Rarity line. Only shown once real distribution data exists for ≥ 200 users;
 * before that the honest line is "Among the first {n} to get this one."
 * Inventing a percentage is explicitly forbidden by the copy deck.
 */
export const rarityLine = (sampleSize: number, nth: number | null): string | null => {
  if (sampleSize < 200) return nth === null ? null : `Among the first ${nth} to get this one.`;
  return null;
};
