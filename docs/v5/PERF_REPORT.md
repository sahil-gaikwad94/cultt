# Perf report — cultured v5

Measured on the production build (`ALLOW_UNLICENSED=1 npm run build`) at commit
`77f0f32`. This report separates what was measured from what could not be.

## How to read this

The §10 budgets are LCP, INP, CLS and p95 frame rate. Those need a real browser
on a throttled CPU. **This sandbox has none** — Chromium cannot be downloaded
here, so Lighthouse, CDP tracing and the Playwright viewport suite were never
executed. The Playwright specs that assert them are committed and will run in
CI, but their numbers are not in this document, because a number nobody measured
is not a result.

What *was* measured directly: transfer size of every shipped chunk, the real
import graph, and which chunks actually block first content. Those are the
inputs to LCP rather than LCP itself, and they are reported as such.

## First-paint JavaScript

All sizes in this report are `gzip` level 9 computed over the file bytes with no
filename stored in the header, which is what an HTTP server sends under
`Content-Encoding: gzip`. Vite's own build log prints slightly larger figures
(e.g. 58.77 kB vs 58,476 B here) because it counts the gzip header differently;
the two agree to within a fraction of a percent and neither changes any
conclusion.

Chunk membership was resolved by parsing real `import` statements out of the
built files — `import"./x.js"`, `import{…}from"./x.js"`, `import("./x.js")` —
starting from the script tag in `dist/index.html`.

**A warning if you re-measure this.** Scanning chunks for string literals that
look like paths also matches the `__vite__mapDeps` precache array at the top of
every entry. Doing that made the transitive closure swallow all 18 chunks and
reported two different configurations as identical at 226.16 KiB. Parse import
syntax; do not grep.

### Critical path

`main.ts` awaits `import('./legacy')` before any content renders, so legacy is
on the critical path even though the import is dynamic. With `?v5=1` it then
awaits `./v5/mount`, which statically pulls the store chunk and dynamically
loads Home.

| configuration | first-paint JS | JS + CSS | headroom vs 180 KiB |
|---|---:|---:|---:|
| v5 flags off (main today) | **87.84 KiB gz** | 113.82 KiB | +92.16 |
| v5 flags on (`?v5=1`) | **124.77 KiB gz** | 150.75 KiB | +55.23 |

Budget is initial JS ≤ 180 KiB gz. Both configurations pass.

v5-off breakdown:

| chunk | gz |
|---|---:|
| `index-CDkEbrMh.js` (entry) | 28,921 |
| `legacy-DBtgHg5R.js` | 58,476 |
| `card-CCieP3o4.js` | 2,275 |
| `index-_a0El2Wm.css` | 26,600 |

v5-on adds:

| chunk | gz |
|---|---:|
| `mount-4ZaX3b-U.js` | 1,093 |
| `index-B2UTco5i.js` (store/content) | 14,999 |
| `home-DBolJmgy.js` | 9,996 |
| `contour-Y-2bnIX6.js` | 6,907 |
| `taxonomy-CaK9XhXD.js` | 1,865 |
| `waapi-uLwIGtM2.js` | 2,530 |

### Not on the critical path

Everything below is a dynamic edge and is fetched after first content:

| chunk | gz | when |
|---|---:|---|
| `supabaseRepo-DgVUYSGW.js` | 62,799 | only if `backend === 'supabase'` |
| `stories-BYGeRrLB.js` | 3,023 | Stories rail |
| `intro-DyMnZRB9.js` | 2,967 | first-run intro, once per install |
| `page-D6aQvK0I.js` | 2,768 | duel deep link |
| `profile-BW2ydbcU.js` | 2,495 | Profile tab |
| `vault-Czbu7DT1.js` | 2,491 | Vault |
| `matrix-CIZqHTZm.js` | 2,104 | Matrix tab |
| `nhie-screen-f5qHLxHX.js` | 2,012 | NHIE arena |

## The regression that was found and fixed

The first measurement of the v5-enabled path was **184.81 KiB gz — 4.81 KiB over
budget**. The cause was `src/data/index.ts` statically importing `SupabaseRepo`,
whose `@supabase/supabase-js` import put 63.03 KiB gz into the entry chunk.
Supabase is the optional backend, constructed only when the host page sets
`CULTURED_CONFIG.backend === 'supabase'`, so the default install paid for a
client it never used.

`createRepo()` is now async and imports the client dynamically. That single
change took the v5-on path from 184.81 to 124.08 KiB gz and left the client
available to the configuration that actually needs it.

An earlier figure of 150.9 KB recorded in these docs was also wrong: it summed
two chunks and missed `card`, the v5 chain, and the awaited legacy import.

## CSS

One sheet, `index-_a0El2Wm.css`, 130,074 B raw / **26,600 B gz**. It ships on
first paint in both configurations. The v5 screens add a second, lazily imported
sheet, `mount-Bg8jdxzk.css`, 33,495 B raw / 5,918 B gz, which does not load
unless a v5 flag is on.

## Fonts

`index.html` references one Google Fonts stylesheet for Bricolage Grotesque with
`display=swap`. The budget is fonts ≤ 120 KiB. **This was not verified** — the
font files are served from `fonts.gstatic.com`, which is outside the network
allowlist here, so neither the CSS nor the woff2 payloads could be fetched or
measured. `display=swap` means text is not blocked on them, but the number is
unconfirmed and should be checked in CI.

The brief also asks for one handwritten face alongside the condensed display
face. It has not been added, so there is no second font to budget for yet.

## Runtime budgets — unmeasured

These are asserted by committed Playwright specs but were not executed:

| budget | spec | status |
|---|---|---|
| ≥55 fps p95 at 4× CPU throttle | `tests/e2e/v5.spec.ts` | not executed |
| LCP < 1.8 s | — | no spec; needs Lighthouse in CI |
| INP < 200 ms | — | no spec; needs CDP in CI |
| CLS < 0.05 | `tests/e2e/v5.spec.ts` | not executed |
| first paint < 180 KB transferred | `tests/e2e/v5.spec.ts` (CDP) | not executed; the static measurement above passes |

`npx playwright test --list` resolves **50 tests across 5 files** on the `pixel7`
and `iphone14` projects, which confirms the suites are well-formed. Listing does
not require a browser; running them does.

## Known static suspects

From `PERF_AUDIT.md`, none of these have been instrumented, so none are
confirmed costs:

- Full-screen `backdrop-filter` at `app.css:255/321/72/538`. Expensive to
  composite on mobile, and the likeliest cause of a frame-rate miss.
- `grainInit()` at `legacy.ts:263` paints a full-screen noise canvas.
- `animation: aurBg` on `#onboard.on`.
- Layout reads inside pointer handlers in the legacy drag path.
- No virtualisation on the long lists.
- `mediaLayer()` sets `preload="auto"` and `autoplay` together.
- Uncancellable rAF loops in `countTo` and `motion/micro.ts`.

## Effect caps that are enforced in code

`src/v5/quality.ts` derives a tier from the device and clamps effects, with tier
C (no particles) forced under `prefers-reduced-motion`. Caps: 300 particles,
DPR 2, 6 live Lottie, 3 decoded videos, 1 audio element. These are unit-tested
in `tests/unit/v5-foundations.test.ts`; whether the app stays inside them at
runtime is the frame-rate measurement above, which was not taken.
