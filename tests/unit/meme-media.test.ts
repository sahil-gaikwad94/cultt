/**
 * Meme media URLs.
 *
 * The bug this pins: the adapter used to hand `<img>` a `/memes/gen/*` URL for
 * every meme. That directory is gitignored and is not written by `npm run
 * build`, so the SPA host answered `200 text/html` with index.html, the decoder
 * received HTML, and every meme card rendered an empty frame. The resolver now
 * only ever returns a file that exists unless a deploy explicitly opts in to the
 * generated variants.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { memeRatio, memeSrc, memeSrcSet } from '../../src/content/media';
import { memes, servableMemes } from '../../src/content/index';
import { SEED_MEMES } from '../../src/data/seed/memes';

const setConfig = (config: unknown) => {
  (window as unknown as { CULTURED_CONFIG?: unknown }).CULTURED_CONFIG = config;
};

afterEach(() => setConfig(undefined));

describe('the meme URL resolver', () => {
  it('serves the committed original by default, never the unbuilt variant folder', () => {
    for (const meme of memes.items) {
      expect(memeSrc(meme)).toBe(meme.src);
      expect(memeSrc(meme).startsWith('/memes/gen/')).toBe(false);
    }
  });

  it('emits no srcset while the responsive pipeline has not run', () => {
    for (const meme of memes.items) expect(memeSrcSet(meme)).toBeNull();
  });

  it('uses the generated variants only when the deploy opts in', () => {
    setConfig({ assets: { variants: true } });
    const meme = memes.items[0]!;
    expect(memeSrc(meme)).toBe(meme.variants.at(-1)!.webp);
    expect(memeSrcSet(meme)).toContain(`${meme.variants[0]!.width}w`);
  });

  it('honours an explicit variant base for a CDN build', () => {
    setConfig({ assets: { variants: true, variantBase: 'https://cdn.example/memes' } });
    const meme = memes.items[0]!;
    expect(memeSrc(meme)).toBe(`https://cdn.example/memes${meme.variants.at(-1)!.webp}`);
  });

  it('reports the intrinsic ratio so a card can reserve space', () => {
    const meme = memes.items[0]!;
    expect(memeRatio(meme)).toBe(`${meme.width} / ${meme.height}`);
  });
});

describe('the shipped meme corpus', () => {
  it('is licensed, so the gate passes and the art is not pruned', () => {
    expect(memes.items.length).toBeGreaterThan(0);
    expect(memes.items.every((meme) => meme.rightsCleared)).toBe(true);
    expect(servableMemes()).toHaveLength(memes.items.length);
  });

  it('gives every seed meme a real image path', () => {
    expect(SEED_MEMES.length).toBe(memes.items.length);
    for (const meme of SEED_MEMES) {
      expect(meme.img).toMatch(/^\/memes\/[^/]+\.webp$/);
      expect(meme.alt.length).toBeGreaterThan(0);
    }
  });
});
