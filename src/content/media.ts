/**
 * Meme media URLs — one answer to "which file do we fetch".
 *
 * `meme.variants` point at `/memes/gen/*`, which `npm run content:memes` writes
 * and `.gitignore` keeps out of the repository. Pointing an `<img>` at a file
 * that was never generated is what broke every meme in the app: the SPA host
 * answers `200 text/html` with index.html, the decoder receives HTML, and the
 * card renders an empty frame.
 *
 * So the committed original (`meme.src`) is the default and the only URL the
 * app uses on its own. A deploy that *did* run the pipeline opts in to the
 * responsive variants with:
 *
 *   window.CULTURED_CONFIG = { assets: { variants: true } }
 *
 * This lives in its own module (not in `src/content/index.ts`) because
 * `src/data/seed/memes.ts` sits on the first-paint path and must not pull the
 * song and question manifests in with it.
 */

import type { MemeEntry } from './types.ts';

interface VariantConfig {
  assets?: { variants?: boolean; variantBase?: string };
}

const variantBase = (): string | null => {
  if (typeof window === 'undefined') return null;
  const config = (window as Window & { CULTURED_CONFIG?: VariantConfig }).CULTURED_CONFIG;
  const assets = config?.assets;
  if (!assets?.variants) return null;
  return assets.variantBase ?? '';
};

/** The one URL to fetch for a meme. Always resolves to a file that exists. */
export const memeSrc = (meme: MemeEntry): string => {
  const base = variantBase();
  if (base === null) return meme.src;
  const variant = meme.variants.at(-1);
  return variant ? `${base}${variant.webp}` : meme.src;
};

/**
 * `srcset` for the same meme, or `null` when the responsive files were not
 * built. Never mixes missing files with present ones.
 */
export const memeSrcSet = (meme: MemeEntry): string | null => {
  const base = variantBase();
  if (base === null || !meme.variants.length) return null;
  return meme.variants.map((variant) => `${base}${variant.webp} ${variant.width}w`).join(', ');
};

/** The intrinsic size, so a card can reserve space before the image lands. */
export const memeRatio = (meme: MemeEntry): string | null =>
  meme.width && meme.height ? `${meme.width} / ${meme.height}` : null;
