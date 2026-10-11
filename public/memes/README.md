# Meme layer

The feed bundles 20 image memes under `/memes/*.webp`, so users see them without
leaving the app or depending on remote image URLs. Files are optimized to WebP,
max 1080px wide, and lazy-loaded in the Culture Feed and chat picker.

**Rights: cleared.** The rights to all twenty images were purchased by the owner
(October 2026), and every entry in `src/content/memes.meta.json` carries
`rightsCleared: true`. `/memes/sources.json` keeps the original source context
for the record. `npm run content:gate` therefore passes, and
`scripts/prune-demo-assets.mjs` no longer deletes `dist/memes`.

Responsive variants (`480 / 960 / 1440`) are generated into `/memes/gen/` by
`npm run content:memes`. That directory is gitignored, so the app serves the
committed originals by default and only uses the variants when a deploy opts in
with `window.CULTURED_CONFIG.assets.variants = true` — see
`src/content/media.ts`.
