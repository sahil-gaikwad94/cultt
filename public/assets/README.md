# Art slots

Procedural art ships by default. Raster and video overrides live in this folder and are wired through `manifest.json`.

## Current slots

- `feedAmbience` / `feedVideo` — feed ambience. `feed-ambience-v2.webp` is a procedural brand-palette still (blobs, paper strips, bokeh, grain); `feed-loop.mp4` is a seamless 8s silent Ken-Burns loop cut from it with FFmpeg.
- `matrixBg` / `matrixVideo` — Matrix ambience. `matrix-ribbons-v2.webp` is an AI-generated resonance-ribbon still; `matrix-loop.mp4` is its seamless 8s silent loop.
- `profileHeader` — `profile-header-v2.webp`, an AI-generated warm cultural-archive header.
- `matchMoment`, `heroImage`, `heroVideo` — still procedural/none.

## Rules

- Stills: WebP, max 1080px wide, under 150KB where possible, no UI copy, faces, brands, or recognizable memes.
- Video: MP4, H.264, muted, `+faststart`, portrait 540x960, under 150KB, loop-safe (ping-pong), no audio track.
- Both layers render behind the interface at low opacity with blur/tint so content stays readable; Calm Mode and `prefers-reduced-motion` disable motion.

### `tomorrowBg` — the Tomorrow page scene
- Where: the locked-day card on the home tab (below the deck).
- Expects: a 9:16 still, 540–1080 px wide, WebP/AVIF, under 80 KB. Moody night-drive
  mood: dark purple/ink with one warm coral light source upper-right, heavy grain,
  empty at the top for the tease cards, darker at the bottom for the countdown.
- Rendering: sits under the scrim (`.tm-art::after`), which fades it into ink at the
  bottom 30% so text contrast stays above 4.5:1. A slow ken-burns drift runs unless
  Calm Mode or reduced motion is on.
- Leave `file: null` to fall back to the procedural night gradient (`.tm-media-fallback`).
