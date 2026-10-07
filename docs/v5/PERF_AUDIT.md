# v5 — performance audit

**Status: blocked in this sandbox.** The audit the brief asks for is a Chrome
performance trace recorded through Playwright's CDP with 4× CPU throttle. That
requires a browser binary, and `npx playwright install chromium` fails here:

```
Error: Failed to download Chrome for Testing 153.0.8010.12 (playwright chromium v1243)
  code: 'ECONNRESET', host: 'cdn.playwright.dev'
```

`cdn.playwright.dev` is not on this sandbox's outbound allowlist
(`github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`,
`files.pythonhosted.org`). No system Chrome/Chromium is installed either
(`ls /usr/bin | grep -i chrom` → nothing).

Everything below the line "Static analysis" is therefore derived from reading
the code and the shipped CSS, **not measured**, and is labelled as such. The
trace itself has to be run on a machine with network; the config for it is
already committed (`playwright.config.ts`, `tests/visual/playwright.config.ts`).

---

## What was verified by running something

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 problems |
| `npx vitest run` | **198 passed** / 9 files (baseline before v5 work: 140 / 6) |
| `npm run build` | OK. `legacy` chunk 175.9 kB (60.1 kB gz); `index` 344.4 kB (95.7 kB gz) |
| `npm run dev` + `GET /` | HTTP 200; all new modules transform and serve (200 on `/src/store/index.ts`, `/src/lib/overlay.ts`, `/src/lib/haptics.ts`, `/src/copy/taxonomy.ts`) |

The bundle number matters against §10's budget: **initial JS must be ≤ 180 kB
gz**. The entry chunk is 95.7 kB gz and `legacy` is 60.1 kB gz, so the app is
at ~156 kB gz before the intro/Lottie/WebGL chunks the later phases add. That
is inside budget today but has ~24 kB of headroom, which is why Phase 1's intro
must be a lazy chunk.

## Static analysis (unmeasured — reading, not profiling)

These are the suspects for the "very laggy intro" and the Home jank. Each one
names the file and line so the trace can confirm or clear it.

1. **Full-screen `backdrop-filter` in the hot path.** `src/styles/app.css:255`
   (`.sheet`), `:321` (`#mini-player`), `:72` (`#nav`) and `:538` (`.ses-end`)
   all use `backdrop-filter: blur(20–30px) saturate(1.4–1.5)`. On a mid-range
   Android these are composited every frame the layer moves. The sheet's
   `transform: translateY(100%) → none` transition animates *through* the blur.
2. **A permanently-running grain canvas.** `grainInit()`
   (`src/legacy.ts:263`) draws a full-screen noise canvas; `src/motion/timeline.ts`
   adds a second canvas layer for motes and ribbons during the Cold Open. Two
   full-viewport canvases on the main thread is the most likely source of the
   intro's dropped frames.
3. **`animation: aurBg` on `#onboard.on`** (`src/styles/app.css:680`) animates
   `background-position`/`background-size` on a full-screen element — a paint
   every frame, not a compositor-only property.
4. **Layout reads inside pointer handlers.** `relRect()` (`src/legacy.ts:606`)
   calls `getBoundingClientRect()` on the element *and* `#phone`; `fitMeme`
   (`:474`) and `layoutDeck` (`:462`) measure every card. `layoutTabs` is bound
   to `resize` and to `document.fonts.ready`. Individually fine; during a card
   swap they interleave with writes.
5. **No virtualisation anywhere.** `mmHTML()` renders 6 cards, but `meme-pick`
   renders up to ~46 in one sheet, and `renderYou()` re-renders the entire You
   tab (`innerHTML =` on the whole section) on every like/save — now called
   from four handlers. This is the biggest Phase 2 target.
6. **Oversized video layers.** `mediaLayer()` (`src/legacy.ts:122`) sets
   `preload="auto"` and `autoplay` on hero loops. §4.3 requires
   `preload="metadata"`, one playing video, and a 60%-visible gate.
7. **`countTo` recursion.** `src/legacy.ts:78` and `src/motion/micro.ts` both
   drive number ticks with a raw `requestAnimationFrame` loop and no
   cancellation; several can run at once.

## Fix plan (ordered by expected win)

| # | Fix | Phase |
|---|---|---|
| 1 | One shared `Contour` renderer replacing the two ad-hoc canvases; `OffscreenCanvas` where available; paused when offscreen | 1 |
| 2 | Quality ladder on boot (`deviceMemory` / `hardwareConcurrency` + a 500 ms frame-time probe) gating tier A/B/C | 0/1 |
| 3 | Deck virtualisation: render ≤ 3 cards, preload 2, drop `innerHTML` re-renders in favour of targeted patches | 2 |
| 4 | `backdrop-filter` only on layers that are static while blurred; animate a pre-blurred snapshot instead | 2 |
| 5 | `?perf=1` HUD: FPS, long tasks, memory, live Lottie/video/particle counts | 0 |
| 6 | Video: `preload="metadata"`, poster first, one at a time, ≤ 3 decoded, pause on tab hide | 0/2 |

## How to actually run this audit

On a machine with network:

```bash
npx playwright install chromium --with-deps
npm run test:e2e            # Pixel 7 emulation, writes docs/v5/screens/
# then record a trace with 4x throttle:
CULTURED_CHROME=$(which chromium) npx playwright test tests/visual --config tests/visual/playwright.config.ts
```

`scripts/perf-trace.mjs` (Phase 0.2) is intended to wrap the CDP session,
apply `Emulation.setCPUThrottlingRate: 4`, and write FPS/long-task numbers to
`docs/v5/PERF_REPORT.md`.
