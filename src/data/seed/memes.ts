/**
 * The meme corpus, as the app sees it.
 *
 * There is exactly one source of truth: `src/content/memes.manifest.json`,
 * generated from the real image/video files in `public/memes/` by
 * `npm run content:memes`. This module adapts that manifest to the shape the
 * feed, the mock repo and the seed SQL consume.
 *
 * The previous version of this file was a 2000-line list of generated
 * typographic text cards with invented like/laugh counts. It is gone: cultured
 * only shows real image and video memes now (build brief §0.3), and nothing in
 * the app reports a count nobody produced.
 */

/* Import the meme manifest directly rather than the `src/content` barrel: the
   barrel also pulls in the 208-track and 100-question manifests, and this
   module sits on the first-paint path through the legacy shell. Keeping the
   import narrow leaves those two JSON files in the lazy v5 chunk. */
import memeManifest from '../../content/memes.manifest.json';
import type { MemeEntry, MemeManifest } from '../../content/types.ts';

/** Shapes for the meme corpus. Mirrors public/memes/sources.json. */
export interface SeedMeme {
  readonly id: string;
  /** Culture Feed tab: work | music | screen | life | love | money. */
  readonly topic: string;
  /** Short human-written title. The image carries the joke. */
  readonly text: string;
  /** Text alternative: the museum placard, which doubles as the alt text. */
  readonly alt: string;
  /** Taxonomy ids: content families + format features + style axes. */
  readonly tags: readonly string[];
  readonly bg: string;
  readonly fg: string;
  readonly ac: string;
  /** Real counts only. These start at zero and grow with the user's own taps. */
  readonly likes: number;
  readonly laughs: number;
  /** The rendered image. Always present — there are no text cards any more. */
  readonly img: string;
}

/**
 * Display categories → the six Culture Feed tabs the legacy shell filters on.
 * Explicit rather than inferred, so a new category has to be placed on purpose.
 */
const TOPIC_FOR_CATEGORY: Record<string, string> = {
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

const BONE = '#EFE9DA';
const INK = '#141413';

const adapt = (meme: MemeEntry): SeedMeme => ({
  id: meme.id,
  topic: TOPIC_FOR_CATEGORY[meme.category] ?? 'life',
  text: meme.title,
  alt: meme.alt,
  tags: [meme.category, meme.axis, meme.mood],
  bg: meme.dominant ?? BONE,
  fg: BONE,
  ac: meme.dominant ?? INK,
  likes: 0,
  laughs: 0,
  img: meme.variants.at(-1)?.webp ?? meme.src,
});

export const SEED_MEMES: readonly SeedMeme[] = (memeManifest as unknown as MemeManifest).items.map(adapt);

export const seedMemeById = (id: string): SeedMeme | undefined =>
  SEED_MEMES.find((meme) => meme.id === id);
