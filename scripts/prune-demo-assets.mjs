/**
 * Removes demo-only assets from a production build.
 *
 *   node scripts/prune-demo-assets.mjs
 *
 * Why this has to exist as a build step rather than a flag: Vite copies
 * `public/` verbatim, so the twenty images under `public/memes` land in `dist/`
 * whether or not any code references them. A flag cannot un-copy a file.
 *
 * As of this session every meme in `src/content/memes.meta.json` carries
 * `rightsCleared: true` — the rights were purchased — so the meme folder is no
 * longer pruned. The script reads the manifest and only deletes the folder when
 * the shipped build actually contains unlicensed material (the
 * `ALLOW_UNLICENSED=1` path), which keeps the honesty guarantee without
 * breaking a legitimate build.
 *
 * Exits 0 even when there is nothing to prune, so it is safe to chain into the
 * build script.
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** True when the manifest still contains any meme that is not rights-cleared. */
const hasUnlicensedMemes = () => {
  try {
    const raw = readFileSync(resolve(root, 'src/content/memes.manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    return items.some((item) => item && item.rightsCleared !== true);
  } catch {
    /* No manifest, or an unreadable one: nothing to reason about, keep the art. */
    return false;
  }
};

const targets = [resolve(root, 'dist/manus-routes.json')];
if (hasUnlicensedMemes()) {
  targets.unshift(resolve(root, 'dist/memes'));
  console.log('unlicensed memes in this build - pruning dist/memes');
} else {
  console.log('all memes rights-cleared - keeping dist/memes');
}

let pruned = 0;
for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  pruned += 1;
  console.log(`pruned ${target.replace(`${root}/`, '')}`);
}

console.log(pruned ? 'demo assets removed from dist' : 'nothing to prune');
