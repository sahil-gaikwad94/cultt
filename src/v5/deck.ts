/**
 * The Deck (build brief §6.2).
 *
 * A full-height card stack that mixes memes and songs ~3:1, cycles categories
 * for variety, weights toward the axes the user reacts to, and never repeats
 * within the persisted `seen` set. When the catalog runs out it says so and
 * gives the next drop time — it does not loop silently.
 *
 * The ordering is a pure, seeded function (`orderDeck`) so it is deterministic,
 * debuggable and testable; the DOM layer only renders what it returns and logs
 * why each item was chosen.
 */

import { copy, impactLine } from '../copy/index.ts';
import { memeCategoryName } from '../copy/taxonomy.ts';
import type { MemeEntry, SongEntry } from '../content/types.ts';
import { REACTION_AXES } from './reactions.ts';
import { getStore } from '../store/index.ts';
import { laughBudget } from '../store/selectors.ts';
import type { StoreState } from '../store/index.ts';
import { v5config } from '../store/config.ts';

export type DeckItemKind = 'meme' | 'song';

export interface DeckItem {
  kind: DeckItemKind;
  id: string;
  /** Why this item is here. Logged under `?perf=1` and in the deck inspector. */
  reason: string;
  meme?: MemeEntry;
  song?: SongEntry;
}

export interface DeckSource {
  memes: MemeEntry[];
  songs: SongEntry[];
}

/** Deterministic PRNG so a given user + day sees the same deck. */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const localDayKey = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

/**
 * Axis affinity from the user's own reactions, normalised to sum to 1.
 * The weights are the same table the reaction tray uses, so reacting to
 * something measurably changes what the Deck serves next.
 */
export const axisAffinity = (state: StoreState): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const reaction of state.reactions) {
    const weights = REACTION_AXES[reaction.emoji];
    if (!weights) continue;
    for (const [axis, value] of Object.entries(weights)) out[axis] = (out[axis] ?? 0) + (value ?? 0);
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (!total) return out;
  for (const key of Object.keys(out)) out[key] /= total;
  return out;
};

export interface OrderOptions {
  source: DeckSource;
  seen: readonly string[];
  state?: StoreState;
  /** Seed; defaults to the local day so everyone gets the same drop order. */
  seed?: string;
  limit?: number;
  /** Meme:song ratio, as "one song every N items". */
  songEvery?: number;
  now?: number;
}

export interface OrderedDeck {
  items: DeckItem[];
  /** True when the catalog is exhausted and the user has seen everything. */
  exhausted: boolean;
  /** Count the Deck shows: "N in the gallery". */
  galleryCount: number;
}

/**
 * Builds the deck order. Pure: same inputs, same output.
 *
 * Rules, in order:
 *  1. Drop anything in `seen`.
 *  2. Interleave songs at roughly 1-in-4.
 *  3. Within memes, prefer categories that have appeared least so far.
 *  4. Weight by the user's axis affinity, deterministically.
 *  5. Never repeat inside the returned list.
 */
export const orderDeck = (options: OrderOptions): OrderedDeck => {
  const { source, seen } = options;
  const limit = options.limit ?? 40;
  const songEvery = Math.max(2, options.songEvery ?? 4);
  const now = options.now ?? Date.now();
  const seed = options.seed ?? localDayKey(now);
  const galleryCount = source.memes.length + source.songs.length;

  const seenSet = new Set(seen);
  const affinity = options.state ? axisAffinity(options.state) : {};

  const memes = source.memes
    .filter((meme) => !seenSet.has(meme.id))
    .map((meme) => ({
      // Affinity dominates; the seeded hash only breaks ties deterministically.
      meme,
      score: (affinity[meme.axis] ?? 0) + hashString(`${seed}:${meme.id}`) / 4294967296 / 1000,
    }))
    .sort((a, b) => b.score - a.score);

  const songs = source.songs
    .filter((song) => !seenSet.has(song.id))
    .map((song) => ({ song, score: hashString(`${seed}:${song.id}`) / 4294967296 }))
    .sort((a, b) => b.score - a.score);

  // Category rotation: keep a running tally and pull from the least-used bucket.
  const categoryUse = new Map<string, number>();
  const usedIds = new Set<string>();
  const items: DeckItem[] = [];
  let songCursor = 0;

  /* Scans the whole remaining pool every time. A monotonic cursor would
     permanently skip any meme whose category was over-used at the moment it
     was passed over, and the deck would silently under-deliver. */
  const nextMeme = (): DeckItem | null => {
    let best: { index: number; use: number; score: number } | null = null;
    for (let i = 0; i < memes.length; i += 1) {
      const meme = memes[i].meme;
      if (usedIds.has(meme.id)) continue;
      const use = categoryUse.get(meme.category) ?? 0;
      // Least-used category first; the affinity-weighted score breaks ties.
      if (!best || use < best.use || (use === best.use && memes[i].score > best.score)) {
        best = { index: i, use, score: memes[i].score };
      }
    }
    if (!best) return null;
    const meme = memes[best.index].meme;
    usedIds.add(meme.id);
    categoryUse.set(meme.category, (categoryUse.get(meme.category) ?? 0) + 1);
    return {
      kind: 'meme',
      id: meme.id,
      meme,
      reason: `category:${meme.category} axis:${meme.axis} affinity:${(affinity[meme.axis] ?? 0).toFixed(2)}`,
    };
  };

  const nextSong = (): DeckItem | null => {
    while (songCursor < songs.length) {
      const song = songs[songCursor].song;
      songCursor += 1;
      if (usedIds.has(song.id)) continue;
      usedIds.add(song.id);
      return {
        kind: 'song',
        id: song.id,
        song,
        reason: `genre:${song.genre}${song.resolved ? '' : ' unresolved'}`,
      };
    }
    return null;
  };

  for (let i = 0; i < limit; i += 1) {
    const wantSong = (i + 1) % songEvery === 0;
    const item = wantSong ? (nextSong() ?? nextMeme()) : (nextMeme() ?? nextSong());
    if (!item) break;
    items.push(item);
  }

  return { items, exhausted: items.length === 0, galleryCount };
};

/* ------------------------------------------------------------ rendering -- */

export const MEME_RATIO_LABEL = 'roughly 3 memes to every song';

export interface CardArt {
  src: string;
  srcset: string | null;
  sizes: string;
  blurhashCss: string | null;
  dominant: string | null;
  alt: string;
  width: number;
  height: number;
}

/** `<img>` attributes for a meme, with the AVIF/WebP variants when present. */
export const memeArt = (meme: MemeEntry): CardArt => {
  const variants = meme.variants ?? [];
  const srcset = variants.length
    ? variants
        .map((v) => `${v.avif} ${v.width}w`)
        .concat(variants.map((v) => `${v.webp} ${v.width}w`))
        .join(', ')
    : null;
  return {
    src: variants.length ? variants[variants.length - 1].webp : meme.src,
    srcset,
    sizes: '(max-width: 480px) 100vw, 480px',
    blurhashCss: null,
    dominant: meme.dominant,
    alt: meme.alt,
    width: meme.width,
    height: meme.height,
  };
};

export const placardFor = (item: DeckItem, index: number): string =>
  item.kind === 'meme' && item.meme
    ? copy.placard.format(index + 1, memeCategoryName(item.meme.category), item.meme.mood)
    : item.kind === 'song' && item.song
      ? copy.placard.format(index + 1, item.song.genreName, item.song.vibe)
      : '';

export const impactFor = (item: DeckItem): string =>
  item.kind === 'meme' && item.meme ? item.meme.placard : impactLine(item.id);

/* -------------------------------------------------------------- gestures - */

export const COMMIT_DISTANCE_FRACTION = 0.28;
export const COMMIT_VELOCITY_PX_PER_MS = 0.5;
export const NEXT_CARD_SCALE_FROM = 0.94;

export type GestureDirection = 'right' | 'left' | 'up';

export interface GestureDecision {
  direction: GestureDirection;
  /** 'laugh' spends budget; 'pass' and 'save' never do. */
  action: 'laugh' | 'pass' | 'save';
  committed: boolean;
  /** True when the gesture was refused because the budget is gone. */
  blocked: boolean;
}

/**
 * Decides a swipe. Committing needs 28% of the card width *or* a velocity over
 * 0.5 px/ms; a right-swipe with no laughs left rubber-bands instead.
 */
export const decideGesture = (input: {
  dx: number;
  dy: number;
  velocity: number;
  cardWidth: number;
  laughsLeft: number;
}): GestureDecision => {
  const { dx, dy, velocity, cardWidth, laughsLeft } = input;
  const vertical = dy < 0 && Math.abs(dy) > Math.abs(dx);

  if (vertical) {
    const committed = Math.abs(dy) > cardWidth * COMMIT_DISTANCE_FRACTION || velocity > COMMIT_VELOCITY_PX_PER_MS;
    return { direction: 'up', action: 'save', committed, blocked: false };
  }

  const direction: GestureDirection = dx >= 0 ? 'right' : 'left';
  const committed = Math.abs(dx) > cardWidth * COMMIT_DISTANCE_FRACTION || velocity > COMMIT_VELOCITY_PX_PER_MS;

  if (direction === 'right' && committed && laughsLeft <= 0) {
    return { direction, action: 'laugh', committed: false, blocked: true };
  }
  return { direction, action: direction === 'right' ? 'laugh' : 'pass', committed, blocked: false };
};

/** Rotation proportional to horizontal drag, capped so it never looks broken. */
export const dragRotation = (dx: number, cardWidth: number): number =>
  Math.max(-18, Math.min(18, (dx / cardWidth) * 22));

/** Rubber-band offset when a gesture is refused. */
export const rubberBand = (dx: number): number => dx * 0.22;

/* ------------------------------------------------------------- the sheet - */

/** The limit sheet's copy, with a live countdown to local midnight. */
export const limitSheetCopy = (state: StoreState, now: number) => {
  const budget = laughBudget(state, v5config.laughsPerDay, now);
  const hours = Math.floor(budget.msUntilReset / 3600000);
  const minutes = Math.floor((budget.msUntilReset % 3600000) / 60000);
  return {
    title: copy.limits.title,
    body: copy.limits.body.replace('15', String(budget.cap)),
    sub: copy.limits.sub.replace('15', String(budget.cap)),
    countdown: `${hours}h ${String(minutes).padStart(2, '0')}m`,
    cta: copy.limits.cta,
    secondary: copy.limits.secondary,
    left: budget.left,
    cap: budget.cap,
  };
};

/* ------------------------------------------------------------ live store - */

export interface DeckController {
  items(): DeckItem[];
  exhausted(): boolean;
  galleryCount(): number;
  /** Marks the current head as seen and advances. */
  advance(): void;
  /** Puts the last item back (the one free undo). */
  undo(): void;
  laughsLeft(): number;
  reload(): void;
}

export const createDeck = (source: DeckSource, now: () => number = () => Date.now()): DeckController => {
  const store = getStore();
  let ordered: OrderedDeck = { items: [], exhausted: true, galleryCount: 0 };
  let cursor = 0;
  let lastId: string | null = null;

  const reload = () => {
    ordered = orderDeck({ source, seen: store.getState().seen, state: store.getState(), now: now() });
    cursor = 0;
  };
  reload();

  return {
    items: () => ordered.items.slice(cursor),
    exhausted: () => cursor >= ordered.items.length,
    galleryCount: () => ordered.galleryCount,
    advance() {
      const current = ordered.items[cursor];
      if (!current) return;
      store.markSeen([current.id]);
      lastId = current.id;
      cursor += 1;
    },
    undo() {
      if (!lastId || cursor === 0) return;
      cursor -= 1;
      lastId = null;
    },
    laughsLeft: () => laughBudget(store.getState(), v5config.laughsPerDay, now()).left,
    reload,
  };
};
