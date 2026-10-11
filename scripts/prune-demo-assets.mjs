/**
 * Removes UNLICENSED demo assets from a production build.
 *
 *   node scripts/prune-demo-assets.mjs
 *
 * Why this has to exist as a build step rather than a flag: Vite copies
 * `public/` verbatim, so every file under `public/memes` lands in `dist/`
 * whether or not any code references it. A flag cannot un-copy a file.
 *
 * History: this script used to delete `dist/memes` wholesale, on the assumption
 * that all twenty seed memes were unlicensed web-search material. That stopped
 * being true once the rights were purchased (`rightsCleared: true` in
 * `src/content/memes.meta.json`), and the unconditional delete meant every meme
 * image 404'd in a production build while the same build passed the rights
 * gate. The prune is now per-file and driven by the manifest, so:
 *
 *   - a rights-cleared meme ships;
 *   - an unlicensed meme is deleted from `dist/` even if it slipped past the
 *     gate under ALLOW_UNLICENSED=1;
 *   - a file on disk that the manifest does not know about is deleted too —
 *     nothing ships that the pipeline has not vouched for.
 *
 * Exits 0 even when there is nothing to prune, so it is safe to chain into the
 * build script.
 */

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'src', 'content', 'memes.manifest.json');
const memeDist = resolve(root, 'dist/memes');
const otherTargets = [resolve(root, 'dist/manus-routes.json')];
const MEDIA_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif', '.gif', '.mp4', '.webm', '.mov']);

const readClearedFiles = () => {
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cleared = new Set();
  for (const item of manifest.items ?? []) {
    if (item.rightsCleared !== true) continue;
    // `src` is `/memes/meme-01.webp`; variants are `/memes/gen/meme-01-480.webp`.
    for (const url of [item.src, ...(item.variants ?? []).flatMap((v) => [v.avif, v.webp])]) {
      if (typeof url === 'string' && url.startsWith('/memes/')) cleared.add(url.slice('/memes/'.length));
    }
  }
  return cleared;
};

let pruned = 0;

if (existsSync(memeDist)) {
  const cleared = readClearedFiles();
  if (cleared === null) {
    // No manifest means the pipeline never ran; do not guess — drop the folder.
    rmSync(memeDist, { recursive: true, force: true });
    pruned += 1;
    console.log('pruned dist/memes (no manifest found to vouch for it)');
  } else {
    const walk = (dir, prefix) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
      );
    const onDisk = walk(memeDist, '');
    const isMedia = (file) => MEDIA_EXT.has(file.slice(file.lastIndexOf('.')).toLowerCase());
    const media = onDisk.filter(isMedia);
    const unwantedMedia = media.filter((file) => !cleared.has(file));
    // `sources.json` and `README.md` document where the seed art came from. They
    // are dev provenance, not content, so they never ship — but they are not
    // "unlicensed memes" and should not be reported as such.
    const provenance = onDisk.filter((file) => !isMedia(file));
    for (const file of [...unwantedMedia, ...provenance]) rmSync(join(memeDist, file), { force: true });
    pruned += unwantedMedia.length + provenance.length;
    console.log(
      `dist/memes: ${media.length - unwantedMedia.length} rights-cleared file(s) kept` +
        (unwantedMedia.length ? `, ${unwantedMedia.length} unlicensed media file(s) removed` : '') +
        (provenance.length ? `, ${provenance.length} provenance file(s) removed` : ''),
    );
  }
}

for (const target of otherTargets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  pruned += 1;
  console.log(`pruned ${target.replace(`${root}/`, '')}`);
}

console.log(pruned ? 'unlicensed demo assets removed from dist' : 'nothing to prune');
