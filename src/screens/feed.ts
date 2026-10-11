/**
 * The Culture Feed — typed core, extracted from the legacy seam.
 *
 * `src/legacy.ts` is 2,385 lines of `@ts-nocheck` and owns the whole app, so it
 * cannot be lifted out in one move. What *can* move is the part that decides
 * what the feed shows — and that is the part that was wrong. Until now:
 *
 *   - the Daily Drop hero drew its art from four hand-written text memes
 *     (`MEMES`, `legacy.ts:204`) rendered as procedural typographic cards, while
 *     the licensed corpus sat in a separate strip one scroll down;
 *   - that strip was capped at `mmList().slice(0,6)` and advertised itself as
 *     "6 of 20 in the gallery";
 *   - the topic tabs were stubbed to a toast: "Topic tabs are off in this
 *     phase" (`legacy.ts:2161`).
 *
 * Every one of those rules now lives here, typed and unit-tested. The seam
 * keeps what it is genuinely good at and genuinely entangled: pointer
 * gestures, deck physics, the tint layer, haptics, and the one delegated
 * `data-act` listener.
 *
 * DEPENDENCY RULE — do not break this. This module imports the manifests
 * directly and never the `src/content` barrel, the v5 screens or the store. The
 * barrel pulls in the 208-track and 100-question manifests, and `src/v5/deck.ts`
 * pulls in the reaction FX engine; both would land on the first-paint path,
 * which is exactly what `src/data/seed/memes.ts` was written to avoid. Anything
 * that needs persisted state takes it as a parameter instead.
 */

import memeManifest from '../content/memes.manifest.json';
import type { MemeEntry, MemeManifest } from '../content/types.ts';
import { memeCategoryName } from '../copy/taxonomy.ts';

const manifest = memeManifest as unknown as MemeManifest;

/** The rights gate already blocks an unlicensed build; this is the second line. */
export const corpus = (): readonly MemeEntry[] => manifest.items.filter((meme) => meme.rightsCleared);

export const memeById = (id: string): MemeEntry | null => manifest.items.find((meme) => meme.id === id) ?? null;

/* ------------------------------------------------------------------ topics */

/**
 * The six Culture Feed tabs the legacy shell filters on, plus `all`.
 *
 * These are the seam's existing topic ids — `TOPIC_EMOJI` in `legacy.ts:2144`
 * keys off the same strings — so the tab bar and the stickers keep working.
 * They are deliberately *not* the fifteen display categories: a feed with
 * fifteen tabs is not a feed.
 */
export const FEED_TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'work', label: 'Work' },
  { id: 'music', label: 'Music' },
  { id: 'screen', label: 'Screen' },
  { id: 'life', label: 'Life' },
  { id: 'love', label: 'Love' },
  { id: 'money', label: 'Money' },
] as const;

export type FeedTopic = (typeof FEED_TOPICS)[number]['id'];

/**
 * Display category → feed tab. Explicit rather than inferred, so a new category
 * has to be placed on purpose and an unmapped one lands in `life` instead of
 * silently vanishing from the feed.
 */
export const TOPIC_FOR_CATEGORY: Record<string, Exclude<FeedTopic, 'all'>> = {
  'dev-tears': 'work',
  'corporate-hostage': 'work',
  'old-internet': 'screen',
  'niche-refs': 'screen',
  'cursed-images': 'screen',
  'group-chat-crimes': 'life',
  'brain-rot': 'life',
  'main-character': 'life',
  situationship: 'love',
};

/** The display name for a meme's category — used on chips and in the detail page. */
export const categoryLabel = (meme: MemeEntry): string => memeCategoryName(meme.category);

export const topicOf = (meme: MemeEntry): Exclude<FeedTopic, 'all'> =>
  TOPIC_FOR_CATEGORY[meme.category] ?? 'life';

/** Tabs that actually have something behind them. An empty tab is a dead end. */
export const nonEmptyTopics = (items: readonly MemeEntry[] = corpus()): readonly FeedTopic[] => {
  const present = new Set(items.map(topicOf));
  return FEED_TOPICS.filter((topic) => topic.id === 'all' || present.has(topic.id)).map((topic) => topic.id);
};

/* --------------------------------------------------------------------- art */

export interface MemeArt {
  src: string;
  /** The committed original. `public/memes/gen/` is generated and gitignored. */
  fb: string;
  srcset: string | null;
  sizes: string;
  /** Average colour, for the placeholder behind a not-yet-decoded image. */
  dominant: string | null;
  alt: string;
  width: number;
  height: number;
}

/**
 * One place resolves a meme's `<img>` attributes.
 *
 * The legacy seam used to emit a bare `<img src>` pointing at the 480 px
 * variant, which the browser then upscaled into a card 61 % of the viewport.
 * This emits the full AVIF/WebP `srcset` with `sizes`, the same way
 * `src/v5/deck.ts` already did for the v5 Deck.
 */
export const memeArt = (meme: MemeEntry): MemeArt => {
  const variants = meme.variants ?? [];
  const srcset = variants.length
    ? variants
        .map((v) => `${v.avif} ${v.width}w`)
        .concat(variants.map((v) => `${v.webp} ${v.width}w`))
        .join(', ')
    : null;
  return {
    src: variants.at(-1)?.webp ?? meme.src,
    fb: meme.src,
    srcset,
    sizes: '(max-width: 480px) 100vw, 480px',
    dominant: meme.dominant,
    alt: meme.alt,
    width: meme.width,
    height: meme.height,
  };
};

const esc = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * The `<img>` itself, shared by every meme surface in the feed.
 *
 * `data-fbk` is read by the capture-phase `error` listener in `main.ts`, which
 * drops `srcset`/`sizes` before swapping — while `srcset` is present the browser
 * resolves the request from it and ignores `src`, so the swap would otherwise be
 * invisible and the error would fire again.
 */
export const imgAttrs = (meme: MemeEntry, extraClass = ''): string => {
  const art = memeArt(meme);
  const style = art.dominant ? ` style="background:${esc(art.dominant)}"` : '';
  return [
    `class="mm-photo${extraClass ? ` ${extraClass}` : ''}"`,
    `src="${esc(art.src)}"`,
    art.srcset ? `srcset="${esc(art.srcset)}" sizes="${esc(art.sizes)}"` : '',
    `data-fbk="${esc(art.fb)}"`,
    `width="${art.width}" height="${art.height}"`,
    `alt="${esc(art.alt)}"`,
    'loading="lazy" decoding="async"',
    style.trim(),
  ]
    .filter(Boolean)
    .join(' ');
};

/** The framed photo block the card, the shelf and the rewind strip all reuse. */
export const memeVisualHTML = (meme: MemeEntry): string =>
  `<div class="mm-photo-wrap"><img ${imgAttrs(meme)}></div>`;

/* ----------------------------------------------------------------- gallery */

export interface GalleryPage {
  items: readonly MemeEntry[];
  /**
   * The `limit` to ask for next, or `null` when the topic is exhausted. The
   * pager is a "show more", not a page turn: the next call renders everything
   * so far *plus* one more page, so the count in the header always matches the
   * number of cards actually on screen.
   */
  next: number | null;
  shown: number;
  total: number;
  remaining: number;
  exhausted: boolean;
}

export interface GalleryOptions {
  topic?: FeedTopic;
  /** How many items to render, counting from the first. Never an offset. */
  limit?: number;
  /** How many "Show more" adds. */
  pageSize?: number;
  /** Items to leave out — the ones the drop deck is already showing. */
  exclude?: ReadonlySet<string>;
  source?: readonly MemeEntry[];
}

export const GALLERY_PAGE_SIZE = 6;

/**
 * The gallery, from the first item to `limit`. Pure: the same topic and limit
 * always return the same items, so a re-render cannot shuffle the order under
 * the user's finger mid-scroll — which is what makes it safe for the seam to
 * re-run this on every tab change.
 *
 * `limit` is a count, not an offset. An earlier version sliced
 * `[cursor, cursor + pageSize)` and labelled the header with the cumulative
 * total, so the second page read "12 of 17 shown" over six cards. A count
 * cannot disagree with what is rendered.
 */
export const planGallery = (options: GalleryOptions = {}): GalleryPage => {
  const source = options.source ?? corpus();
  const topic = options.topic ?? 'all';
  const pageSize = Math.max(1, options.pageSize ?? GALLERY_PAGE_SIZE);
  const limit = Math.max(1, options.limit ?? GALLERY_PAGE_SIZE);
  const exclude = options.exclude;

  const pool = source.filter(
    (meme) => (topic === 'all' || topicOf(meme) === topic) && !(exclude?.has(meme.id) ?? false),
  );
  const items = pool.slice(0, limit);
  const remaining = pool.length - items.length;
  return {
    items,
    next: remaining > 0 ? items.length + pageSize : null,
    shown: items.length,
    total: pool.length,
    remaining,
    exhausted: remaining <= 0,
  };
};

/* -------------------------------------------------------------------- drop */

export interface DropOptions {
  /** How many memes the hero deck should hand the seam. */
  count?: number;
  /** Seed. Defaults to the local day, so everyone gets the same drop. */
  seed?: string;
  /**
   * Per-axis weights, normalised. The seam derives these from the store's
   * reactions; this module stays dependency-free by taking them as input.
   */
  affinity?: Record<string, number>;
  /** Meme ids already consumed, so a re-render does not serve the same drop. */
  seen?: ReadonlySet<string>;
  source?: readonly MemeEntry[];
}

/** Deterministic PRNG — the same construction `src/v5/deck.ts` uses. */
const seededRandom = (seed: number): (() => number) => {
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

export const localDaySeed = (now: number = Date.now()): string => {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

/**
 * The memes the Daily Drop hero shows.
 *
 * Deterministic per day, rotates categories so the deck is not four dev-tears
 * cards in a row, and weights toward the axes the user actually reacts to.
 * Falls back to the whole corpus when `seen` has eaten it, rather than handing
 * back an empty deck — a blank hero is worse than a repeat, and the repeat is
 * honest because the user caused it.
 */
export const planDrop = (options: DropOptions = {}): readonly MemeEntry[] => {
  const source = options.source ?? corpus();
  const count = Math.max(1, options.count ?? 2);
  const seed = options.seed ?? localDaySeed();
  const affinity = options.affinity ?? {};
  const seen = options.seen;

  const pick = (pool: readonly MemeEntry[]): MemeEntry[] => {
    /* Affinity ranks memes *within* a category; rotation decides the order the
       categories are drawn from. Keeping those two decisions separate matters:
       an earlier version added the rotation jitter to the category-use metric
       and compared on that, which let the jitter overrule a full point of
       affinity and serve a deadpan card where the user had reacted wholesome
       four times. */
    const byCategory = new Map<string, MemeEntry[]>();
    for (const meme of pool) {
      const list = byCategory.get(meme.category);
      if (list) list.push(meme);
      else byCategory.set(meme.category, [meme]);
    }
    for (const list of byCategory.values()) {
      list.sort(
        (a, b) =>
          (affinity[b.axis] ?? 0) - (affinity[a.axis] ?? 0) ||
          hashString(`${seed}:${b.id}`) - hashString(`${seed}:${a.id}`),
      );
    }

    // A deterministic shuffle, so the first card of the day is not always the
    // same category — but the same for everyone on the same day.
    const rand = seededRandom(hashString(seed));
    const order = [...byCategory.keys()]
      .map((category) => ({ category, key: rand() }))
      .sort((a, b) => a.key - b.key);

    const chosen: MemeEntry[] = [];
    // Round-robin: one from each category before a second from any.
    while (chosen.length < count) {
      let added = false;
      for (const { category } of order) {
        const next = byCategory.get(category)?.shift();
        if (!next) continue;
        chosen.push(next);
        added = true;
        if (chosen.length >= count) break;
      }
      if (!added) break;
    }
    return chosen;
  };

  const fresh = source.filter((meme) => !(seen?.has(meme.id) ?? false));
  return pick(fresh.length >= count ? fresh : source);
};

/* --------------------------------------------------------------- rendering */

export interface CardState {
  liked: boolean;
  saved: boolean;
}

/**
 * The seam's inline SVG icon set. Passed in rather than imported: the icons
 * live inside the `@ts-nocheck` seam, and duplicating them here would be a
 * second source of truth for the same three glyphs.
 */
export interface CardIcons {
  like: string;
  save: string;
  share: string;
}

/**
 * A gallery card. Class names are the seam's existing ones (`.mm-card`,
 * `.mm-visual`, `.mm-bar`, `.mm-b`) so the shipped CSS applies unchanged — this
 * is an extraction, not a redesign.
 */
export const memeCardHTML = (
  meme: MemeEntry,
  index: number,
  state: CardState = { liked: false, saved: false },
  icons?: CardIcons,
): string => {
  const cat = memeCategoryName(meme.category);
  return [
    `<article class="mm-card has-photo" data-m="${esc(meme.id)}" data-rxn-kind="meme" style="--i:${index}">`,
    `<div class="mm-visual">${memeVisualHTML(meme)}</div>`,
    `<p class="mm-cap">${esc(meme.title)}</p>`,
    '<div class="mm-bar">',
    `<span class="mm-k">${esc(cat)}</span><span class="sp"></span>`,
    `<button class="mm-b ${state.liked ? 'on' : ''}" data-act="mm-like" data-fx="like" data-id="${esc(meme.id)}" aria-label="Like" aria-pressed="${state.liked}">${icons?.like ?? ''}</button>`,
    `<button class="mm-b ${state.saved ? 'on' : ''}" data-act="mm-save" data-fx="pin" data-id="${esc(meme.id)}" aria-label="Save" aria-pressed="${state.saved}">${icons?.save ?? ''}</button>`,
    `<button class="mm-b" data-act="mm-share" data-fx="share" data-id="${esc(meme.id)}" aria-label="Share this meme">${icons?.share ?? ''}</button>`,
    '</div>',
    '</article>',
  ].join('');
};

export interface GallerySectionOptions extends GalleryOptions {
  state?: (meme: MemeEntry) => CardState;
  icons?: CardIcons;
  /** Rendered when the topic has nothing in it. Honest, never fabricated. */
  emptyHTML?: string;
}

/**
 * The "Today's memes" section, minus the tab bar — the seam owns the tabs
 * because they are wired into its delegated `data-act` listener and its
 * `.fblob` sliding indicator.
 */
export const gallerySectionHTML = (options: GallerySectionOptions = {}): string => {
  const page = planGallery(options);
  const stateFor = options.state ?? (() => ({ liked: false, saved: false }));

  if (!page.items.length) {
    return (
      options.emptyHTML ??
      `<section class="mm stg" style="--d:2"><div class="mm-h"><h2 class="sec" style="padding:0">Today’s memes</h2></div>
       <p class="hint" style="padding:0 20px 16px">Nothing in this corner yet. The gallery fills as the corpus grows.</p></section>`
    );
  }

  const cards = page.items.map((meme, i) => memeCardHTML(meme, i, stateFor(meme), options.icons)).join('');
  const more = page.next === null
    ? ''
    : `<div class="mm-more"><button class="chipg" data-act="mm-more" data-next="${page.next}" aria-label="Show ${page.remaining} more memes">Show more · ${page.remaining} left</button></div>`;
  const label = page.shown >= page.total ? `${page.total} in this corner` : `${page.shown} of ${page.total} shown`;

  return `<section class="mm stg" style="--d:2"><div class="mm-h"><h2 class="sec" style="padding:0">Today’s memes</h2><span class="mm-n">${esc(label)}</span></div><div class="mm-row" id="mmrow">${cards}</div>${more}</section>`;
};

/**
 * Real art for a Daily Drop card, replacing the procedural text card the seam
 * used to draw. Same `.art` wrapper the existing `.dcard` CSS expects.
 */
export const dropArtHTML = (meme: MemeEntry): string =>
  `<div class="art"><div class="memeart has-photo"><img ${imgAttrs(meme, 'drop-photo')}></div></div>`;

/** The label the seam puts under a drop card and in the share sheet. */
export const dropLabel = (meme: MemeEntry): string => meme.title;
