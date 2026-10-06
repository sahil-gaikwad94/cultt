/**
 * Removes demo-only assets from a production build.
 *
 *   node scripts/prune-demo-assets.mjs
 *
 * Why this has to exist as a build step rather than a flag: Vite copies
 * `public/` verbatim, so the twenty images under `public/memes` land in `dist/`
 * whether or not any code references them. A flag cannot un-copy a file.
 *
 * Those twenty images were collected from public web image search (see
 * public/memes/sources.json) and have no licence. They are fine for a local demo
 * and not fine in a shipped artifact, so they are deleted from the output after
 * the build. They stay in the repository so `npm run dev` can still use them.
 *
 * Exits 0 even when there is nothing to prune, so it is safe to chain into the
 * build script.
 */

import { rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  resolve(root, 'dist/memes'),
  resolve(root, 'dist/manus-routes.json'),
];

let pruned = 0;
for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  pruned += 1;
  console.log(`pruned ${target.replace(`${root}/`, '')}`);
}

console.log(pruned ? 'demo assets removed from dist' : 'nothing to prune');
