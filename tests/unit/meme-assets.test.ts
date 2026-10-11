/**
 * Regression cover for the "meme images do not render" defect.
 *
 * There were two independent causes and both are asserted here, because either
 * one on its own was enough to paint twenty broken-image rectangles:
 *
 *  1. `src/data/seed/memes.ts` resolved `img` to `variants.at(-1).webp`, i.e. a
 *     file under `public/memes/gen/` — generated, gitignored, and absent from a
 *     fresh checkout.
 *  2. `scripts/prune-demo-assets.mjs` deleted `dist/memes` wholesale, so even a
 *     correct build served no meme bytes at all. It was written when all twenty
 *     seed memes were unlicensed; the rights have since been cleared.
 *
 * The fix is three-layered: the pipeline runs in dev and build, the prune is
 * per-file and manifest-driven, and every meme `<img>` carries a `data-fbk`
 * original that `main.ts` swaps in on `error`. These tests pin layers 2 and 3
 * and the manifest's rights state, which is the part a human has to keep true.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/* Import through the barrel rather than the raw JSON: the barrel casts the
   manifest to `MemeManifest`, which narrows `kind` to 'image' | 'video'. */
import { memes, memeThumb } from '../../src/content/index.ts';
import { SEED_MEMES } from '../../src/data/seed/memes.ts';

const ROOT = resolve(import.meta.dirname, '..', '..');
const memeManifest = memes;
const PRUNE = join(ROOT, 'scripts', 'prune-demo-assets.mjs');

describe('the meme corpus is rights-cleared', () => {
  it('marks every meme cleared, so the build gate and the prune agree', () => {
    const uncleared = memeManifest.items.filter((item) => item.rightsCleared !== true);
    expect(uncleared.map((item) => item.src)).toEqual([]);
  });

  it('has a committed original on disk for every entry', () => {
    // `src` is the original; `variants` are generated. Only the original is in git.
    for (const item of memeManifest.items) {
      expect(existsSync(join(ROOT, 'public', item.src)), `${item.src} missing from public/`).toBe(true);
    }
  });
});

describe('memeThumb', () => {
  it('prefers the largest variant and always reports the original as the fallback', () => {
    const meme = memeManifest.items[0];
    const thumb = memeThumb(meme);
    expect(thumb.src).toBe(meme.variants.at(-1)?.webp ?? meme.src);
    expect(thumb.fb).toBe(meme.src);
  });

  it('falls back to the original when a meme has no generated variants', () => {
    const source = memeManifest.items[0];
    const thumb = memeThumb({ ...source, variants: [] });
    expect(thumb.src).toBe(source.src);
    expect(thumb.fb).toBe(source.src);
  });
});

describe('the seed adapter the legacy seam renders from', () => {
  it('carries a fallback that points at a file that exists right now', () => {
    expect(SEED_MEMES.length).toBeGreaterThan(0);
    for (const meme of SEED_MEMES) {
      expect(meme.fb).toBeTruthy();
      expect(existsSync(join(ROOT, 'public', meme.fb)), `${meme.fb} does not exist`).toBe(true);
    }
  });

  it('never points the fallback at the generated directory', () => {
    for (const meme of SEED_MEMES) expect(meme.fb).not.toContain('/memes/gen/');
  });
});

describe('scripts/prune-demo-assets.mjs', () => {
  const setup = (files: Record<string, string>) => {
    const dist = mkdtempSync(join(tmpdir(), 'cultured-prune-'));
    for (const [path, body] of Object.entries(files)) {
      const target = join(dist, path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, body);
    }
    return dist;
  };

  const run = (cwd: string) => {
    // The script is root-relative, so it is copied into a fake repo whose
    // `dist/` is the temp dir and whose manifest is the real, committed one.
    const repo = mkdtempSync(join(tmpdir(), 'cultured-repo-'));
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    mkdirSync(join(repo, 'src', 'content'), { recursive: true });
    cpSync(PRUNE, join(repo, 'scripts', 'prune-demo-assets.mjs'));
    cpSync(join(ROOT, 'src', 'content', 'memes.manifest.json'), join(repo, 'src', 'content', 'memes.manifest.json'));
    cpSync(join(cwd, 'memes'), join(repo, 'dist', 'memes'), { recursive: true });
    const out = execFileSync(process.execPath, [join(repo, 'scripts', 'prune-demo-assets.mjs')], { encoding: 'utf8' });
    const remaining = existsSync(join(repo, 'dist', 'memes'))
      ? execFileSync('find', [join(repo, 'dist', 'memes'), '-type', 'f'], { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean)
          .map((f) => f.replace(`${join(repo, 'dist', 'memes')}/`, ''))
          .sort()
      : [];
    rmSync(repo, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    return { out, remaining };
  };

  it('keeps a rights-cleared meme and its variant', () => {
    const dist = setup({
      'memes/meme-01.webp': 'original',
      'memes/gen/meme-01-480.webp': 'variant',
    });
    const { out, remaining } = run(dist);
    expect(remaining).toEqual(['gen/meme-01-480.webp', 'meme-01.webp']);
    expect(out).toContain('nothing to prune');
  });

  it('deletes a file the manifest does not vouch for', () => {
    const dist = setup({
      'memes/meme-01.webp': 'original',
      'memes/stolen-from-the-internet.webp': 'no licence',
    });
    const { out, remaining } = run(dist);
    expect(remaining).toEqual(['meme-01.webp']);
    expect(out).toContain('unlicensed media file(s) removed');
  });

  it('keeps the cleared art but drops dev provenance files', () => {
    const dist = setup({
      'memes/meme-01.webp': 'original',
      'memes/gen/meme-01-480.avif': 'variant',
      'memes/sources.json': '{}',
      'memes/README.md': 'notes',
    });
    const { out, remaining } = run(dist);
    expect(remaining).toEqual(['gen/meme-01-480.avif', 'meme-01.webp']);
    expect(out).toContain('provenance file(s) removed');
  });
});

describe('the shipped meme URLs', () => {
  it('are reachable relative to the dev server root', () => {
    // A cheap structural check: every resolved path must start with /memes/ and
    // the fallback must be the committed original. Catches a manifest that was
    // generated against a different public root.
    for (const item of memeManifest.items) {
      const thumb = memeThumb(item);
      expect(thumb.src.startsWith('/memes/')).toBe(true);
      expect(thumb.fb).toBe(item.src);
    }
  });

  it('records real intrinsic dimensions and a blurhash for every image meme', () => {
    for (const item of memeManifest.items.filter((m) => m.kind === 'image')) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
      expect(item.blurhash).toBeTruthy();
    }
  });

  it('keeps the manifest readable by the app', () => {
    const raw = JSON.parse(readFileSync(join(ROOT, 'src', 'content', 'memes.manifest.json'), 'utf8'));
    expect(raw.count).toBe(raw.items.length);
  });
});
